from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Depends, Header, Query
from fastapi.responses import FileResponse as FastAPIFileResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from passlib.context import CryptContext
from jose import JWTError, jwt
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
import os
import logging
import uuid
import shutil
import io
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Guest data limit (2GB in bytes)
GUEST_DATA_LIMIT = 2 * 1024 * 1024 * 1024  # 2GB

# Create the main app
app = FastAPI(title="UniShare API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ============================================================================
# WebSocket Connection Manager for WebRTC Signaling
# ============================================================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_info: Dict[str, dict] = {}
    
    async def connect(self, user_id: str, websocket: WebSocket, username: str = None, emoji: str = None):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_info[user_id] = {
            "username": username or "Anonymous",
            "emoji": emoji or "👤",
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        logger.info(f"User {user_id} ({username}) connected")
        # Notify all users about new connection
        await self.broadcast_online_users()
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_info:
            del self.user_info[user_id]
        logger.info(f"User {user_id} disconnected")
    
    async def send_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast_online_users(self):
        """Notify all connected users about who's online"""
        online_users = [
            {"id": uid, **info} 
            for uid, info in self.user_info.items()
        ]
        message = {"type": "online_users", "users": online_users}
        for user_id in list(self.active_connections.keys()):
            await self.send_message(user_id, message)
    
    def get_online_users(self):
        return [{"id": uid, **info} for uid, info in self.user_info.items()]

manager = ConnectionManager()

# ============================================================================
# Pydantic Models
# ============================================================================

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None

class UserCreate(UserBase):
    password: Optional[str] = None  # Optional for guests

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GuestCreate(BaseModel):
    username: str
    emoji: str = "👤"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    password_hash: Optional[str] = None
    is_guest: bool = True
    emoji: str = "👤"
    total_data_shared: int = 0  # in bytes
    google_drive_connected: bool = False
    google_id: Optional[str] = None  # Google OAuth ID
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    is_guest: bool
    emoji: str
    total_data_shared: int
    google_drive_connected: bool
    created_date: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class FileMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_filename: str
    size: int
    content_type: Optional[str] = None
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    owner_id: str
    owner_username: str
    owner_type: str = "guest"  # "guest" or "user"
    session_id: Optional[str] = None  # For guest tracking
    is_public: bool = True
    shared_with_users: List[str] = Field(default_factory=list)
    source: str = "upload"  # "upload" or "google_drive"
    drive_file_id: Optional[str] = None

class FileResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    size: int
    content_type: Optional[str]
    upload_date: str
    download_url: str
    share_url: str
    owner_username: str
    owner_type: str
    is_public: bool
    source: str
    drive_file_id: Optional[str] = None

class DriveFileInfo(BaseModel):
    id: str
    name: str
    mimeType: str
    size: Optional[int] = 0
    webViewLink: Optional[str] = None
    iconLink: Optional[str] = None

# ============================================================================
# Helper Functions
# ============================================================================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current user from JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

async def get_optional_user(authorization: str = Header(None)) -> Optional[User]:
    """Get current user if token provided, otherwise None"""
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        return None
    
    return User(**user_doc)

async def check_data_limit(user: User, file_size: int) -> bool:
    """Check if user can upload more data (2GB limit for guests)"""
    if not user.is_guest:
        return True  # No limit for logged-in users
    
    if user.total_data_shared + file_size > GUEST_DATA_LIMIT:
        return False
    
    return True

async def update_user_data_shared(user_id: str, file_size: int):
    """Update user's total data shared"""
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"total_data_shared": file_size}}
    )

# ============================================================================
# Authentication Routes
# ============================================================================

@api_router.post("/auth/guest", response_model=Token)
async def create_guest(guest: GuestCreate):
    """Create a guest user with username and emoji"""
    try:
        # Create guest user
        user = User(
            username=guest.username,
            emoji=guest.emoji,
            is_guest=True
        )
        
        doc = user.model_dump()
        doc['created_date'] = doc['created_date'].isoformat()
        await db.users.insert_one(doc)
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_guest=user.is_guest,
            emoji=user.emoji,
            total_data_shared=user.total_data_shared,
            google_drive_connected=user.google_drive_connected,
            created_date=doc['created_date']
        )
        
        return Token(access_token=access_token, token_type="bearer", user=user_response)
    
    except Exception as e:
        logger.error(f"Guest creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Guest creation failed: {str(e)}")

@api_router.post("/auth/register", response_model=Token)
async def register(user_create: UserCreate):
    """Register a new user account"""
    try:
        # Check if email already exists
        existing_user = await db.users.find_one({"email": user_create.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user
        user = User(
            username=user_create.username,
            email=user_create.email,
            password_hash=hash_password(user_create.password),
            is_guest=False,
            emoji="👤"
        )
        
        doc = user.model_dump()
        doc['created_date'] = doc['created_date'].isoformat()
        await db.users.insert_one(doc)
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_guest=user.is_guest,
            emoji=user.emoji,
            total_data_shared=user.total_data_shared,
            google_drive_connected=user.google_drive_connected,
            created_date=doc['created_date']
        )
        
        return Token(access_token=access_token, token_type="bearer", user=user_response)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    """Login with email and password"""
    try:
        # Find user by email
        user_doc = await db.users.find_one({"email": user_login.email}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        user = User(**user_doc)
        
        # Verify password
        if not user.password_hash or not verify_password(user_login.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_guest=user.is_guest,
            emoji=user.emoji,
            total_data_shared=user.total_data_shared,
            google_drive_connected=user.google_drive_connected,
            created_date=user_doc['created_date']
        )
        
        return Token(access_token=access_token, token_type="bearer", user=user_response)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_guest=current_user.is_guest,
        emoji=current_user.emoji,
        total_data_shared=current_user.total_data_shared,
        google_drive_connected=current_user.google_drive_connected,
        created_date=current_user.created_date.isoformat()
    )

@api_router.get("/auth/google")
async def google_auth():
    """Initiate Google OAuth flow for login/signup"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = f"{os.getenv('REACT_APP_BACKEND_URL', os.getenv('FRONTEND_URL', ''))}/api/auth/google/callback"
        
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=500,
                detail="Google OAuth not configured"
            )
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=[
                'openid',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile'
            ],
            redirect_uri=redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        logger.info(f"Google OAuth initiated")
        return {"authorization_url": authorization_url, "state": state}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate Google OAuth: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate Google OAuth: {str(e)}")

@api_router.get("/auth/google/callback")
async def google_auth_callback(code: str = Query(...), state: str = Query(None)):
    """Handle Google OAuth callback for login/signup"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = f"{os.getenv('REACT_APP_BACKEND_URL', os.getenv('FRONTEND_URL', ''))}/api/auth/google/callback"
        frontend_url = os.getenv('FRONTEND_URL', os.getenv('REACT_APP_BACKEND_URL', ''))
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=None,
            redirect_uri=redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user info from Google
        import requests
        userinfo_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {credentials.token}'}
        )
        userinfo = userinfo_response.json()
        
        google_id = userinfo.get('id')
        email = userinfo.get('email')
        name = userinfo.get('name', email.split('@')[0])
        
        # Check if user exists
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            # Existing user - login
            user = User(**user_doc)
        else:
            # New user - register
            user = User(
                username=name,
                email=email,
                is_guest=False,
                emoji="👤",
                google_id=google_id
            )
            
            doc = user.model_dump()
            doc['created_date'] = doc['created_date'].isoformat()
            await db.users.insert_one(doc)
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        
        # Redirect to frontend with token
        return RedirectResponse(url=f"{frontend_url}?google_auth=success&token={access_token}&user_id={user.id}&google_drive_prompt=true")
    
    except Exception as e:
        logger.error(f"Google OAuth callback failed: {e}")
        frontend_url = os.getenv('FRONTEND_URL', os.getenv('REACT_APP_BACKEND_URL', ''))
        return RedirectResponse(url=f"{frontend_url}?google_auth=error&error={str(e)}")

# ============================================================================
# File Management Routes
# ============================================================================

@api_router.post("/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a file"""
    try:
        # Check data limit
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if not await check_data_limit(current_user, file_size):
            raise HTTPException(
                status_code=403, 
                detail=f"Guest data limit exceeded (2GB). Please create an account to continue sharing."
            )
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        stored_filename = f"{file_id}{file_extension}"
        file_path = UPLOAD_DIR / stored_filename
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Create metadata
        file_metadata = FileMetadata(
            id=file_id,
            filename=stored_filename,
            original_filename=file.filename,
            size=file_size,
            content_type=file.content_type,
            owner_id=current_user.id,
            owner_username=current_user.username,
            owner_type="guest" if current_user.is_guest else "user",
            is_public=True,
            source="upload"
        )
        
        # Save metadata to MongoDB
        doc = file_metadata.model_dump()
        doc['upload_date'] = doc['upload_date'].isoformat()
        await db.files.insert_one(doc)
        
        # Update user's total data shared
        await update_user_data_shared(current_user.id, file_size)
        
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
            owner_username=current_user.username,
            owner_type="guest" if current_user.is_guest else "user",
            is_public=True,
            source="upload"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@api_router.get("/files", response_model=List[FileResponse])
async def get_files(current_user: Optional[User] = Depends(get_optional_user)):
    """Get files based on user permissions"""
    try:
        query = {}
        
        # If user is authenticated, show their files
        if current_user:
            query = {"owner_id": current_user.id}
        else:
            # If no user, return empty list
            return []
        
        files = await db.files.find(query, {"_id": 0}).sort("upload_date", -1).to_list(1000)
        
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
                share_url=f"/api/files/{file_doc['id']}/download",
                owner_username=file_doc.get('owner_username', 'Unknown'),
                owner_type=file_doc.get('owner_type', 'guest'),
                is_public=file_doc.get('is_public', True),
                source=file_doc.get('source', 'upload'),
                drive_file_id=file_doc.get('drive_file_id')
            ))
        
        return file_responses
    
    except Exception as e:
        logger.error(f"Failed to fetch files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch files: {str(e)}")

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str):
    """Download a file"""
    try:
        # Get file metadata from MongoDB
        file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # If it's a Google Drive file, redirect to Drive download
        if file_doc.get('source') == 'google_drive':
            drive_file_id = file_doc.get('drive_file_id')
            if drive_file_id:
                # Return a direct download link
                return {"download_url": f"https://drive.google.com/uc?export=download&id={drive_file_id}"}
        
        file_path = UPLOAD_DIR / file_doc['filename']
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        return FastAPIFileResponse(
            path=file_path,
            filename=file_doc['original_filename'],
            media_type=file_doc.get('content_type', 'application/octet-stream')
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Delete a file"""
    try:
        # Get file metadata from MongoDB
        file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Check ownership
        if file_doc['owner_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="You don't have permission to delete this file")
        
        # Delete file from disk (if it's an uploaded file)
        if file_doc.get('source') == 'upload':
            file_path = UPLOAD_DIR / file_doc['filename']
            if file_path.exists():
                file_path.unlink()
        
        # Delete metadata from MongoDB
        await db.files.delete_one({"id": file_id})
        
        # Update user's total data shared
        await update_user_data_shared(current_user.id, -file_doc['size'])
        
        return {"message": "File deleted successfully", "file_id": file_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

# ============================================================================
# WebSocket for WebRTC Signaling
# ============================================================================

@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for WebRTC signaling"""
    await manager.connect(user_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "offer":
                # Forward offer to target peer
                target_id = data.get("target")
                await manager.send_message(target_id, {
                    "type": "offer",
                    "offer": data.get("offer"),
                    "sender": user_id
                })
            
            elif message_type == "answer":
                # Forward answer to target peer
                target_id = data.get("target")
                await manager.send_message(target_id, {
                    "type": "answer",
                    "answer": data.get("answer"),
                    "sender": user_id
                })
            
            elif message_type == "ice-candidate":
                # Forward ICE candidate to target peer
                target_id = data.get("target")
                await manager.send_message(target_id, {
                    "type": "ice-candidate",
                    "candidate": data.get("candidate"),
                    "sender": user_id
                })
            
            elif message_type == "update_info":
                # Update user info
                username = data.get("username")
                emoji = data.get("emoji")
                if user_id in manager.user_info:
                    if username:
                        manager.user_info[user_id]["username"] = username
                    if emoji:
                        manager.user_info[user_id]["emoji"] = emoji
                    await manager.broadcast_online_users()
    
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_online_users()
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)
        await manager.broadcast_online_users()

@api_router.get("/online-users")
async def get_online_users():
    """Get list of online users"""
    return {"users": manager.get_online_users()}

# ============================================================================
# Google Drive Integration
# ============================================================================

@api_router.get("/drive/connect")
async def connect_drive(current_user: User = Depends(get_current_user)):
    """Initiate Google Drive OAuth flow"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.getenv("GOOGLE_DRIVE_REDIRECT_URI")
        
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=500,
                detail="Google Drive not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
            )
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=[
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly'
            ],
            redirect_uri=redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=current_user.id
        )
        
        logger.info(f"Drive OAuth initiated for user {current_user.id}")
        return {"authorization_url": authorization_url}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate OAuth: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate OAuth: {str(e)}")

@api_router.get("/drive/callback")
async def drive_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Google Drive OAuth callback"""
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.getenv("GOOGLE_DRIVE_REDIRECT_URI")
        frontend_url = os.getenv("FRONTEND_URL", os.getenv("REACT_APP_BACKEND_URL", ""))
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=None,
            redirect_uri=redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        logger.info(f"Drive credentials obtained for user {state}")
        
        # Store credentials in database
        await db.drive_credentials.update_one(
            {"user_id": state},
            {"$set": {
                "user_id": state,
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        # Update user's google_drive_connected status
        await db.users.update_one(
            {"id": state},
            {"$set": {"google_drive_connected": True}}
        )
        
        logger.info(f"Drive credentials stored for user {state}")
        
        # Redirect to frontend
        return RedirectResponse(url=f"{frontend_url}?drive_connected=true")
    
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        frontend_url = os.getenv("FRONTEND_URL", os.getenv("REACT_APP_BACKEND_URL", ""))
        return RedirectResponse(url=f"{frontend_url}?drive_error=true")

async def get_drive_service(current_user: User):
    """Get Google Drive service with auto-refresh credentials"""
    creds_doc = await db.drive_credentials.find_one({"user_id": current_user.id})
    if not creds_doc:
        raise HTTPException(
            status_code=400,
            detail="Google Drive not connected. Please connect your Drive first."
        )
    
    # Create credentials object
    creds = Credentials(
        token=creds_doc["access_token"],
        refresh_token=creds_doc.get("refresh_token"),
        token_uri=creds_doc["token_uri"],
        client_id=creds_doc["client_id"],
        client_secret=creds_doc["client_secret"],
        scopes=creds_doc["scopes"]
    )
    
    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        logger.info(f"Refreshing expired token for user {current_user.id}")
        creds.refresh(GoogleRequest())
        
        # Update in database
        await db.drive_credentials.update_one(
            {"user_id": current_user.id},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return build('drive', 'v3', credentials=creds)

@api_router.get("/drive/files", response_model=List[DriveFileInfo])
async def list_drive_files(current_user: User = Depends(get_current_user)):
    """List user's Google Drive files"""
    try:
        service = await get_drive_service(current_user)
        
        # List files
        results = service.files().list(
            pageSize=100,
            fields="files(id, name, mimeType, size, webViewLink, iconLink)"
        ).execute()
        
        files = results.get('files', [])
        
        return [DriveFileInfo(**file) for file in files]
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list Drive files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list Drive files: {str(e)}")

@api_router.post("/drive/share/{drive_file_id}", response_model=FileResponse)
async def share_drive_file(drive_file_id: str, current_user: User = Depends(get_current_user)):
    """Share a Google Drive file through UniShare"""
    try:
        service = await get_drive_service(current_user)
        
        # Get file metadata
        file_metadata = service.files().get(
            fileId=drive_file_id,
            fields="id, name, mimeType, size"
        ).execute()
        
        file_size = int(file_metadata.get('size', 0))
        
        # Check data limit
        if not await check_data_limit(current_user, file_size):
            raise HTTPException(
                status_code=403,
                detail=f"Guest data limit exceeded (2GB). Please create an account to continue sharing."
            )
        
        # Create metadata in our database
        file_id = str(uuid.uuid4())
        file_doc = FileMetadata(
            id=file_id,
            filename=file_metadata['name'],
            original_filename=file_metadata['name'],
            size=file_size,
            content_type=file_metadata.get('mimeType'),
            owner_id=current_user.id,
            owner_username=current_user.username,
            owner_type="guest" if current_user.is_guest else "user",
            is_public=True,
            source="google_drive",
            drive_file_id=drive_file_id
        )
        
        doc = file_doc.model_dump()
        doc['upload_date'] = doc['upload_date'].isoformat()
        await db.files.insert_one(doc)
        
        # Update user's total data shared
        await update_user_data_shared(current_user.id, file_size)
        
        return FileResponse(
            id=file_id,
            filename=file_metadata['name'],
            original_filename=file_metadata['name'],
            size=file_size,
            content_type=file_metadata.get('mimeType'),
            upload_date=doc['upload_date'],
            download_url=f"/api/files/{file_id}/download",
            share_url=f"/api/files/{file_id}/download",
            owner_username=current_user.username,
            owner_type="guest" if current_user.is_guest else "user",
            is_public=True,
            source="google_drive",
            drive_file_id=drive_file_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to share Drive file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to share Drive file: {str(e)}")

@api_router.post("/drive/save/{file_id}")
async def save_to_drive(file_id: str, current_user: User = Depends(get_current_user)):
    """Save a UniShare file to Google Drive"""
    try:
        service = await get_drive_service(current_user)
        
        # Get file from our database
        file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # If it's already a Drive file, just return the link
        if file_doc.get('source') == 'google_drive':
            drive_file_id = file_doc.get('drive_file_id')
            return {
                "success": True,
                "message": "File is already on Google Drive",
                "drive_link": f"https://drive.google.com/file/d/{drive_file_id}/view"
            }
        
        # Read the local file
        file_path = UPLOAD_DIR / file_doc['filename']
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on server")
        
        # Upload to Google Drive
        from googleapiclient.http import MediaFileUpload
        
        file_metadata = {
            'name': file_doc['original_filename']
        }
        
        media = MediaFileUpload(
            str(file_path),
            mimetype=file_doc.get('content_type', 'application/octet-stream'),
            resumable=True
        )
        
        drive_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()
        
        logger.info(f"File {file_id} saved to Drive as {drive_file.get('id')}")
        
        return {
            "success": True,
            "drive_file_id": drive_file.get('id'),
            "drive_link": drive_file.get('webViewLink'),
            "message": "File saved to Google Drive successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save to Drive: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save to Drive: {str(e)}")

# ============================================================================
# Main App Configuration
# ============================================================================

# Include API router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "UniShare API - File Sharing Made Simple"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
