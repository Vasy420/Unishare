from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import shutil
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# WebSocket connection manager for WebRTC signaling
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    def get_online_users(self):
        return list(self.active_connections.keys())

manager = ConnectionManager()

# Define Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    username: str
    created_date: str

class FileMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_filename: str
    size: int
    content_type: Optional[str] = None
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    owner_id: Optional[str] = None
    owner_username: Optional[str] = None
    is_public: bool = True
    shared_with_users: List[str] = Field(default_factory=list)

class FileResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    size: int
    content_type: Optional[str]
    upload_date: str
    download_url: str
    share_url: str
    owner_username: Optional[str] = None
    is_public: bool = True
    shared_with_users: List[str] = []

class ShareRequest(BaseModel):
    file_id: str
    is_public: bool
    shared_with_users: List[str] = []

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "File Sharing API"}

# User Management Routes
@api_router.post("/users", response_model=UserResponse)
async def create_user(username: str):
    try:
        # Check if username already exists
        existing_user = await db.users.find_one({"username": username})
        if existing_user:
            return UserResponse(
                id=existing_user['id'],
                username=existing_user['username'],
                created_date=existing_user['created_date']
            )
        
        # Create new user
        user = User(username=username)
        doc = user.model_dump()
        doc['created_date'] = doc['created_date'].isoformat()
        await db.users.insert_one(doc)
        
        return UserResponse(
            id=user.id,
            username=user.username,
            created_date=doc['created_date']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"User creation failed: {str(e)}")

@api_router.get("/users", response_model=List[UserResponse])
async def get_users():
    try:
        users = await db.users.find({}, {"_id": 0}).to_list(1000)
        return [UserResponse(**user) for user in users]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@api_router.get("/users/{username}", response_model=UserResponse)
async def get_user(username: str):
    try:
        user = await db.users.find_one({"username": username}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(**user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)}")

@api_router.post("/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    owner_id: Optional[str] = None,
    owner_username: Optional[str] = None,
    is_public: bool = True
):
    try:
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        stored_filename = f"{file_id}{file_extension}"
        file_path = UPLOAD_DIR / stored_filename
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = file_path.stat().st_size
        
        # Create metadata
        file_metadata = FileMetadata(
            id=file_id,
            filename=stored_filename,
            original_filename=file.filename,
            size=file_size,
            content_type=file.content_type,
            owner_id=owner_id,
            owner_username=owner_username,
            is_public=is_public
        )
        
        # Save metadata to MongoDB
        doc = file_metadata.model_dump()
        doc['upload_date'] = doc['upload_date'].isoformat()
        await db.files.insert_one(doc)
        
        # Return response
        return FileResponse(
            id=file_id,
            filename=stored_filename,
            original_filename=file.filename,
            size=file_size,
            content_type=file.content_type,
            upload_date=doc['upload_date'],
            download_url=f"/api/files/{file_id}/download",
            share_url=f"/api/files/{file_id}/download",
            owner_username=owner_username,
            is_public=is_public
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@api_router.get("/files", response_model=List[FileResponse])
async def get_files():
    try:
        files = await db.files.find({}, {"_id": 0}).to_list(1000)
        
        file_responses = []
        for file_doc in files:
            file_responses.append(FileResponse(
                id=file_doc['id'],
                filename=file_doc['filename'],
                original_filename=file_doc['original_filename'],
                size=file_doc['size'],
                content_type=file_doc.get('content_type'),
                upload_date=file_doc['upload_date'],
                download_url=f"/api/files/{file_doc['id']}/download",
                share_url=f"/api/files/{file_doc['id']}/download"
            ))
        
        return file_responses
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch files: {str(e)}")

@api_router.get("/files/{file_id}/download", response_class=FileResponse)
async def download_file(file_id: str):
    try:
        # Get file metadata from MongoDB
        file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path = UPLOAD_DIR / file_doc['filename']
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        from fastapi.responses import FileResponse as FastAPIFileResponse
        return FastAPIFileResponse(
            path=file_path,
            filename=file_doc['original_filename'],
            media_type=file_doc.get('content_type', 'application/octet-stream')
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    try:
        # Get file metadata from MongoDB
        file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete file from disk
        file_path = UPLOAD_DIR / file_doc['filename']
        if file_path.exists():
            file_path.unlink()
        
        # Delete metadata from MongoDB
        await db.files.delete_one({"id": file_id})
        
        return {"message": "File deleted successfully", "file_id": file_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()