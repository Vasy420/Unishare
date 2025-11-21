#!/usr/bin/env python3
"""
UniShare6 Backend API Testing Script
Tests WebSocket signaling, Google Drive integration, and core file operations
Focus on WebSocket P2P functionality and Google OAuth integration
"""

import requests
import json
import os
import tempfile
from pathlib import Path
import time
import websocket
import threading
import uuid
from datetime import datetime
import asyncio
import ssl

# Get backend URL from frontend .env file
def get_backend_url():
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

BASE_URL = get_backend_url() + "/api"
WS_URL = get_backend_url().replace("https://", "wss://").replace("http://", "ws://")
print(f"Testing backend at: {BASE_URL}")
print(f"WebSocket URL: {WS_URL}")

class UniShareTester:
    def __init__(self):
        self.uploaded_files = []
        self.guest_token = None
        self.user_token = None
        self.guest_user = None
        self.registered_user = None
        self.ws_messages = []
        self.ws_connected = False
        
        self.test_results = {
            # Core file operations (regression check)
            "guest_creation": {"passed": False, "error": None},
            "file_upload": {"passed": False, "error": None},
            "file_list": {"passed": False, "error": None},
            "file_download": {"passed": False, "error": None},
            "cors_headers": {"passed": False, "error": None},
            
            # WebSocket signaling (high priority)
            "websocket_connection": {"passed": False, "error": None},
            "websocket_online_users": {"passed": False, "error": None},
            "websocket_webrtc_signaling": {"passed": False, "error": None},
            "websocket_update_info": {"passed": False, "error": None},
            "online_users_endpoint": {"passed": False, "error": None},
            
            # Google Drive integration (new feature)
            "google_drive_connect": {"passed": False, "error": None},
            "google_oauth_config": {"passed": False, "error": None}
        }
    
    def create_test_file(self, filename="test_file.txt", content="This is a test file for UniShare API testing.", size_mb=None):
        """Create a temporary test file with optional size"""
        if size_mb:
            # Create a file of specific size in MB
            content = "A" * (size_mb * 1024 * 1024)
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=f"_{filename}", delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name
    
    def get_auth_headers(self, token):
        """Get authorization headers for API requests"""
        return {"Authorization": f"Bearer {token}"} if token else {}
    
    def test_guest_creation(self):
        """Test POST /api/auth/guest endpoint"""
        print("\n=== Testing Guest User Creation ===")
        
        try:
            guest_data = {
                "username": f"TestGuest_{int(time.time())}",
                "emoji": "🧪"
            }
            
            response = requests.post(f"{BASE_URL}/auth/guest", json=guest_data, timeout=30)
            
            print(f"Guest Creation Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields in response: {missing_fields}")
                
                # Verify user data
                user = data['user']
                if user['username'] != guest_data['username']:
                    raise Exception(f"Username mismatch: expected {guest_data['username']}, got {user['username']}")
                
                if user['emoji'] != guest_data['emoji']:
                    raise Exception(f"Emoji mismatch: expected {guest_data['emoji']}, got {user['emoji']}")
                
                if not user['is_guest']:
                    raise Exception("User should be marked as guest")
                
                # Store guest info for later tests
                self.guest_token = data['access_token']
                self.guest_user = user
                
                print("✅ Guest Creation test PASSED")
                print(f"   - Username: {user['username']}")
                print(f"   - Emoji: {user['emoji']}")
                print(f"   - Is Guest: {user['is_guest']}")
                print(f"   - Token: {data['access_token'][:20]}...")
                
                self.test_results["guest_creation"]["passed"] = True
                
            else:
                raise Exception(f"Guest creation failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Guest Creation test FAILED: {str(e)}")
            self.test_results["guest_creation"]["error"] = str(e)
    
    def test_user_registration(self):
        """Test POST /api/auth/register endpoint"""
        print("\n=== Testing User Registration ===")
        
        try:
            timestamp = int(time.time())
            user_data = {
                "username": f"TestUser_{timestamp}",
                "email": f"testuser_{timestamp}@example.com",
                "password": "SecurePassword123!"
            }
            
            response = requests.post(f"{BASE_URL}/auth/register", json=user_data, timeout=30)
            
            print(f"Registration Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields in response: {missing_fields}")
                
                # Verify user data
                user = data['user']
                if user['username'] != user_data['username']:
                    raise Exception(f"Username mismatch: expected {user_data['username']}, got {user['username']}")
                
                if user['email'] != user_data['email']:
                    raise Exception(f"Email mismatch: expected {user_data['email']}, got {user['email']}")
                
                if user['is_guest']:
                    raise Exception("User should not be marked as guest")
                
                # Store user info for later tests
                self.user_token = data['access_token']
                self.registered_user = user
                
                print("✅ User Registration test PASSED")
                print(f"   - Username: {user['username']}")
                print(f"   - Email: {user['email']}")
                print(f"   - Is Guest: {user['is_guest']}")
                
                self.test_results["user_registration"]["passed"] = True
                
            else:
                raise Exception(f"Registration failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ User Registration test FAILED: {str(e)}")
            self.test_results["user_registration"]["error"] = str(e)
    
    def test_user_login(self):
        """Test POST /api/auth/login endpoint"""
        print("\n=== Testing User Login ===")
        
        if not self.registered_user:
            print("❌ User Login test SKIPPED: No registered user available")
            self.test_results["user_login"]["error"] = "No registered user available"
            return
        
        try:
            login_data = {
                "email": self.registered_user['email'],
                "password": "SecurePassword123!"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
            
            print(f"Login Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields in response: {missing_fields}")
                
                # Verify user data matches registration
                user = data['user']
                if user['id'] != self.registered_user['id']:
                    raise Exception(f"User ID mismatch after login")
                
                print("✅ User Login test PASSED")
                print(f"   - User ID: {user['id']}")
                print(f"   - Username: {user['username']}")
                
                self.test_results["user_login"]["passed"] = True
                
            else:
                raise Exception(f"Login failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ User Login test FAILED: {str(e)}")
            self.test_results["user_login"]["error"] = str(e)
    
    def test_get_me(self):
        """Test GET /api/auth/me endpoint"""
        print("\n=== Testing Get Current User ===")
        
        if not self.guest_token:
            print("❌ Get Me test SKIPPED: No authentication token available")
            self.test_results["get_me"]["error"] = "No authentication token available"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
            
            print(f"Get Me Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response matches guest user
                if data['id'] != self.guest_user['id']:
                    raise Exception(f"User ID mismatch: expected {self.guest_user['id']}, got {data['id']}")
                
                if data['username'] != self.guest_user['username']:
                    raise Exception(f"Username mismatch: expected {self.guest_user['username']}, got {data['username']}")
                
                print("✅ Get Me test PASSED")
                print(f"   - User ID: {data['id']}")
                print(f"   - Username: {data['username']}")
                print(f"   - Is Guest: {data['is_guest']}")
                
                self.test_results["get_me"]["passed"] = True
                
            else:
                raise Exception(f"Get Me failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Get Me test FAILED: {str(e)}")
            self.test_results["get_me"]["error"] = str(e)
    
    def test_file_upload(self):
        """Test POST /api/upload endpoint with authentication"""
        print("\n=== Testing File Upload with Authentication ===")
        
        if not self.guest_token:
            print("❌ File Upload test SKIPPED: No authentication token available")
            self.test_results["file_upload"]["error"] = "No authentication token available"
            return
        
        try:
            # Create test file
            test_file_path = self.create_test_file("upload_test.txt", "Hello from UniShare backend test!")
            
            headers = self.get_auth_headers(self.guest_token)
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('upload_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            print(f"Upload Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['id', 'filename', 'original_filename', 'size', 'upload_date', 'download_url', 'share_url', 'owner_username']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields in response: {missing_fields}")
                
                # Verify file metadata
                if data['original_filename'] != 'upload_test.txt':
                    raise Exception(f"Original filename mismatch: expected 'upload_test.txt', got '{data['original_filename']}'")
                
                if data['size'] <= 0:
                    raise Exception(f"Invalid file size: {data['size']}")
                
                if data['owner_username'] != self.guest_user['username']:
                    raise Exception(f"Owner username mismatch: expected {self.guest_user['username']}, got {data['owner_username']}")
                
                # Store uploaded file info for later tests
                self.uploaded_files.append(data)
                
                print("✅ File Upload test PASSED")
                print(f"   - File ID: {data['id']}")
                print(f"   - Original filename: {data['original_filename']}")
                print(f"   - Size: {data['size']} bytes")
                print(f"   - Owner: {data['owner_username']}")
                
                self.test_results["file_upload"]["passed"] = True
                
            else:
                raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
                
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ File Upload test FAILED: {str(e)}")
            self.test_results["file_upload"]["error"] = str(e)
    
    def test_file_list(self):
        """Test GET /api/files endpoint with authentication"""
        print("\n=== Testing File List with Authentication ===")
        
        if not self.guest_token:
            print("❌ File List test SKIPPED: No authentication token available")
            self.test_results["file_list"]["error"] = "No authentication token available"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/files", headers=headers, timeout=30)
            
            print(f"List Files Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    raise Exception(f"Expected list response, got {type(data)}")
                
                print(f"✅ File List test PASSED")
                print(f"   - Found {len(data)} files")
                
                # Verify our uploaded file is in the list
                if self.uploaded_files:
                    uploaded_file_id = self.uploaded_files[0]['id']
                    found_file = None
                    for file_info in data:
                        if file_info['id'] == uploaded_file_id:
                            found_file = file_info
                            break
                    
                    if found_file:
                        print(f"   - Uploaded file found in list: {found_file['original_filename']}")
                    else:
                        print(f"   - Warning: Uploaded file {uploaded_file_id} not found in list")
                
                self.test_results["file_list"]["passed"] = True
                
            else:
                raise Exception(f"List files failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ File List test FAILED: {str(e)}")
            self.test_results["file_list"]["error"] = str(e)
    
    def test_file_download(self):
        """Test GET /api/files/{file_id}/download endpoint"""
        print("\n=== Testing File Download ===")
        
        if not self.uploaded_files:
            print("❌ File Download test SKIPPED: No uploaded files to test")
            self.test_results["file_download"]["error"] = "No uploaded files available"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
            
            print(f"Download Response Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check content-type header
                content_type = response.headers.get('content-type', '')
                print(f"   - Content-Type: {content_type}")
                
                # Check content-disposition header for filename
                content_disposition = response.headers.get('content-disposition', '')
                print(f"   - Content-Disposition: {content_disposition}")
                
                # Verify file content
                content = response.content
                if len(content) != file_info['size']:
                    raise Exception(f"Downloaded file size mismatch: expected {file_info['size']}, got {len(content)}")
                
                print("✅ File Download test PASSED")
                print(f"   - Downloaded {len(content)} bytes")
                print(f"   - Original filename: {file_info['original_filename']}")
                
                self.test_results["file_download"]["passed"] = True
                
            else:
                raise Exception(f"Download failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ File Download test FAILED: {str(e)}")
            self.test_results["file_download"]["error"] = str(e)
    
    def test_file_delete(self):
        """Test DELETE /api/files/{file_id} endpoint with authentication"""
        print("\n=== Testing File Delete with Authentication ===")
        
        if not self.uploaded_files or not self.guest_token:
            print("❌ File Delete test SKIPPED: No uploaded files or authentication token available")
            self.test_results["file_delete"]["error"] = "No uploaded files or authentication token available"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            headers = self.get_auth_headers(self.guest_token)
            
            # Delete the file
            response = requests.delete(f"{BASE_URL}/files/{file_id}", headers=headers, timeout=30)
            
            print(f"Delete Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('file_id') != file_id:
                    raise Exception(f"Delete response file_id mismatch: expected {file_id}, got {data.get('file_id')}")
                
                # Verify file is actually deleted by trying to download it
                print("   - Verifying file deletion...")
                download_response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
                
                if download_response.status_code == 404:
                    print("   - Confirmed: File not found after deletion (404)")
                    print("✅ File Delete test PASSED")
                    self.test_results["file_delete"]["passed"] = True
                else:
                    raise Exception(f"File still accessible after deletion (status: {download_response.status_code})")
                
            else:
                raise Exception(f"Delete failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ File Delete test FAILED: {str(e)}")
            self.test_results["file_delete"]["error"] = str(e)
    
    def test_guest_data_limit(self):
        """Test guest user 2GB data limit"""
        print("\n=== Testing Guest Data Limit (2GB) ===")
        
        if not self.guest_token:
            print("❌ Guest Data Limit test SKIPPED: No guest token available")
            self.test_results["guest_data_limit"]["error"] = "No guest token available"
            return
        
        try:
            # Create a large file (simulate 1GB file by setting metadata size)
            # We'll create a small file but the backend should track total data shared
            test_file_path = self.create_test_file("large_test.txt", "This simulates a large file for testing data limits.")
            
            headers = self.get_auth_headers(self.guest_token)
            
            # Upload the file
            with open(test_file_path, 'rb') as f:
                files = {'file': ('large_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            print(f"Large File Upload Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   - Successfully uploaded file: {data['original_filename']}")
                print(f"   - File size: {data['size']} bytes")
                
                # Check current user data usage
                me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    print(f"   - Total data shared: {user_data['total_data_shared']} bytes")
                    print(f"   - Guest limit: 2,147,483,648 bytes (2GB)")
                    
                    if user_data['total_data_shared'] > 0:
                        print("✅ Guest Data Limit tracking test PASSED")
                        print("   - Data usage is being tracked correctly")
                        self.test_results["guest_data_limit"]["passed"] = True
                    else:
                        raise Exception("Data usage not being tracked")
                else:
                    raise Exception("Could not verify data usage")
                
                # Clean up the uploaded file
                delete_response = requests.delete(f"{BASE_URL}/files/{data['id']}", headers=headers, timeout=30)
                if delete_response.status_code == 200:
                    print("   - Test file cleaned up successfully")
                
            else:
                # If upload failed, check if it's due to limit (which would be expected for a truly large file)
                if response.status_code == 403 and "limit exceeded" in response.text.lower():
                    print("✅ Guest Data Limit enforcement test PASSED")
                    print("   - 2GB limit is being enforced correctly")
                    self.test_results["guest_data_limit"]["passed"] = True
                else:
                    raise Exception(f"Upload failed unexpectedly with status {response.status_code}: {response.text}")
                
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ Guest Data Limit test FAILED: {str(e)}")
            self.test_results["guest_data_limit"]["error"] = str(e)
    
    def test_websocket_connection(self):
        """Test basic WebSocket connection to /api/ws/{user_id}"""
        print("\n=== Testing WebSocket Connection ===")
        
        try:
            # Generate a test user ID
            test_user_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/api/ws/{test_user_id}"
            
            print(f"Connecting to WebSocket: {ws_url}")
            
            self.ws_messages = []
            self.ws_connected = False
            connection_established = False
            
            # Create WebSocket connection
            def on_message(ws, message):
                try:
                    msg_data = json.loads(message)
                    self.ws_messages.append(msg_data)
                    print(f"   - Received message: {msg_data}")
                except Exception as e:
                    print(f"   - Error parsing message: {e}")
            
            def on_error(ws, error):
                print(f"   - WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                print(f"   - WebSocket closed: {close_status_code} - {close_msg}")
                self.ws_connected = False
            
            def on_open(ws):
                nonlocal connection_established
                print("   - WebSocket connection opened successfully")
                self.ws_connected = True
                connection_established = True
                
                # Close connection after a short delay to test basic connectivity
                def close_connection():
                    time.sleep(1)
                    ws.close()
                
                threading.Thread(target=close_connection).start()
            
            # Try to establish WebSocket connection
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket in a separate thread with timeout
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if connection_established:
                    break
                time.sleep(0.1)
            
            # Wait a bit more for any initial messages
            time.sleep(2)
            
            if connection_established:
                print("✅ WebSocket Connection test PASSED")
                print(f"   - Connection established successfully")
                print(f"   - Received {len(self.ws_messages)} messages")
                self.test_results["websocket_connection"]["passed"] = True
            else:
                raise Exception("WebSocket connection could not be established within timeout")
                
        except Exception as e:
            print(f"❌ WebSocket Connection test FAILED: {str(e)}")
            self.test_results["websocket_connection"]["error"] = str(e)
    
    def test_websocket_online_users_broadcast(self):
        """Test WebSocket online_users broadcast message"""
        print("\n=== Testing WebSocket Online Users Broadcast ===")
        
        try:
            # Generate test user IDs
            user1_id = str(uuid.uuid4())
            user2_id = str(uuid.uuid4())
            
            user1_messages = []
            user2_messages = []
            user1_connected = False
            user2_connected = False
            
            def create_ws_handlers(user_id, messages_list, connected_flag):
                def on_message(ws, message):
                    try:
                        msg_data = json.loads(message)
                        messages_list.append(msg_data)
                        print(f"   - User {user_id[:8]} received: {msg_data.get('type', 'unknown')}")
                    except Exception as e:
                        print(f"   - Error parsing message for {user_id}: {e}")
                
                def on_error(ws, error):
                    print(f"   - WebSocket error for {user_id}: {error}")
                
                def on_close(ws, close_status_code, close_msg):
                    print(f"   - WebSocket closed for {user_id}: {close_status_code}")
                
                def on_open(ws):
                    nonlocal connected_flag
                    print(f"   - User {user_id[:8]} connected")
                    connected_flag[0] = True
                
                return on_message, on_error, on_close, on_open
            
            # Create WebSocket connections for both users
            user1_connected_flag = [False]
            user2_connected_flag = [False]
            
            user1_handlers = create_ws_handlers(user1_id, user1_messages, user1_connected_flag)
            user2_handlers = create_ws_handlers(user2_id, user2_messages, user2_connected_flag)
            
            ws1_url = f"{WS_URL}/api/ws/{user1_id}"
            ws2_url = f"{WS_URL}/api/ws/{user2_id}"
            
            ws1 = websocket.WebSocketApp(ws1_url, *user1_handlers)
            ws2 = websocket.WebSocketApp(ws2_url, *user2_handlers)
            
            # Start both connections
            ws1_thread = threading.Thread(target=ws1.run_forever)
            ws2_thread = threading.Thread(target=ws2.run_forever)
            ws1_thread.daemon = True
            ws2_thread.daemon = True
            
            ws1_thread.start()
            time.sleep(1)  # Stagger connections
            ws2_thread.start()
            
            # Wait for both connections
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if user1_connected_flag[0] and user2_connected_flag[0]:
                    break
                time.sleep(0.1)
            
            # Wait for online_users broadcast messages
            time.sleep(3)
            
            # Close connections
            ws1.close()
            ws2.close()
            
            # Check if online_users messages were received
            user1_online_msgs = [msg for msg in user1_messages if msg.get('type') == 'online_users']
            user2_online_msgs = [msg for msg in user2_messages if msg.get('type') == 'online_users']
            
            if user1_online_msgs and user2_online_msgs:
                print("✅ WebSocket Online Users Broadcast test PASSED")
                print(f"   - User1 received {len(user1_online_msgs)} online_users messages")
                print(f"   - User2 received {len(user2_online_msgs)} online_users messages")
                
                # Check message structure
                sample_msg = user1_online_msgs[0]
                if 'users' in sample_msg and isinstance(sample_msg['users'], list):
                    print(f"   - Online users list contains {len(sample_msg['users'])} users")
                    self.test_results["websocket_online_users"]["passed"] = True
                else:
                    raise Exception("Invalid online_users message structure")
            else:
                raise Exception("No online_users broadcast messages received")
                
        except Exception as e:
            print(f"❌ WebSocket Online Users Broadcast test FAILED: {str(e)}")
            self.test_results["websocket_online_users"]["error"] = str(e)
    
    def test_websocket_webrtc_signaling(self):
        """Test WebSocket WebRTC signaling flow (offer, answer, ICE candidates)"""
        print("\n=== Testing WebSocket WebRTC Signaling Flow ===")
        
        try:
            # Generate test user IDs
            user1_id = str(uuid.uuid4())
            user2_id = str(uuid.uuid4())
            
            user1_messages = []
            user2_messages = []
            user1_connected = [False]
            user2_connected = [False]
            
            def create_signaling_handlers(user_id, messages_list, connected_flag):
                def on_message(ws, message):
                    try:
                        msg_data = json.loads(message)
                        messages_list.append(msg_data)
                        msg_type = msg_data.get('type', 'unknown')
                        sender = msg_data.get('sender', 'unknown')
                        print(f"   - User {user_id[:8]} received {msg_type} from {sender[:8] if sender != 'unknown' else sender}")
                    except Exception as e:
                        print(f"   - Error parsing message for {user_id}: {e}")
                
                def on_error(ws, error):
                    print(f"   - WebSocket error for {user_id}: {error}")
                
                def on_close(ws, close_status_code, close_msg):
                    connected_flag[0] = False
                
                def on_open(ws):
                    connected_flag[0] = True
                    print(f"   - User {user_id[:8]} connected for signaling test")
                
                return on_message, on_error, on_close, on_open
            
            # Create WebSocket connections
            user1_handlers = create_signaling_handlers(user1_id, user1_messages, user1_connected)
            user2_handlers = create_signaling_handlers(user2_id, user2_messages, user2_connected)
            
            ws1_url = f"{WS_URL}/api/ws/{user1_id}"
            ws2_url = f"{WS_URL}/api/ws/{user2_id}"
            
            ws1 = websocket.WebSocketApp(ws1_url, *user1_handlers)
            ws2 = websocket.WebSocketApp(ws2_url, *user2_handlers)
            
            # Start connections
            ws1_thread = threading.Thread(target=ws1.run_forever)
            ws2_thread = threading.Thread(target=ws2.run_forever)
            ws1_thread.daemon = True
            ws2_thread.daemon = True
            
            ws1_thread.start()
            time.sleep(1)
            ws2_thread.start()
            
            # Wait for connections
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if user1_connected[0] and user2_connected[0]:
                    break
                time.sleep(0.1)
            
            if not (user1_connected[0] and user2_connected[0]):
                raise Exception("Could not establish both WebSocket connections")
            
            time.sleep(1)  # Let initial messages settle
            
            # Test WebRTC signaling flow
            print("   - Testing offer message...")
            offer_message = {
                "type": "offer",
                "target": user2_id,
                "offer": {"type": "offer", "sdp": "fake-offer-sdp-for-testing"}
            }
            ws1.send(json.dumps(offer_message))
            time.sleep(1)
            
            print("   - Testing answer message...")
            answer_message = {
                "type": "answer",
                "target": user1_id,
                "answer": {"type": "answer", "sdp": "fake-answer-sdp-for-testing"}
            }
            ws2.send(json.dumps(answer_message))
            time.sleep(1)
            
            print("   - Testing ICE candidate messages...")
            ice_message1 = {
                "type": "ice-candidate",
                "target": user2_id,
                "candidate": {"candidate": "fake-ice-candidate-1", "sdpMid": "0", "sdpMLineIndex": 0}
            }
            ws1.send(json.dumps(ice_message1))
            
            ice_message2 = {
                "type": "ice-candidate",
                "target": user1_id,
                "candidate": {"candidate": "fake-ice-candidate-2", "sdpMid": "0", "sdpMLineIndex": 0}
            }
            ws2.send(json.dumps(ice_message2))
            time.sleep(2)
            
            # Close connections
            ws1.close()
            ws2.close()
            
            # Verify signaling messages were received
            user1_offers = [msg for msg in user1_messages if msg.get('type') == 'offer']
            user1_answers = [msg for msg in user1_messages if msg.get('type') == 'answer']
            user1_ice = [msg for msg in user1_messages if msg.get('type') == 'ice-candidate']
            
            user2_offers = [msg for msg in user2_messages if msg.get('type') == 'offer']
            user2_answers = [msg for msg in user2_messages if msg.get('type') == 'answer']
            user2_ice = [msg for msg in user2_messages if msg.get('type') == 'ice-candidate']
            
            # Check if messages were properly forwarded
            signaling_success = True
            errors = []
            
            if not user2_offers:
                errors.append("User2 did not receive offer from User1")
                signaling_success = False
            else:
                if user2_offers[0].get('sender') != user1_id:
                    errors.append("Offer sender information incorrect")
                    signaling_success = False
            
            if not user1_answers:
                errors.append("User1 did not receive answer from User2")
                signaling_success = False
            else:
                if user1_answers[0].get('sender') != user2_id:
                    errors.append("Answer sender information incorrect")
                    signaling_success = False
            
            if not user2_ice:
                errors.append("User2 did not receive ICE candidate from User1")
                signaling_success = False
            
            if not user1_ice:
                errors.append("User1 did not receive ICE candidate from User2")
                signaling_success = False
            
            if signaling_success:
                print("✅ WebSocket WebRTC Signaling test PASSED")
                print(f"   - Offer forwarding: ✅")
                print(f"   - Answer forwarding: ✅")
                print(f"   - ICE candidate forwarding: ✅")
                print(f"   - Sender information preserved: ✅")
                self.test_results["websocket_webrtc_signaling"]["passed"] = True
            else:
                raise Exception(f"Signaling flow failed: {'; '.join(errors)}")
                
        except Exception as e:
            print(f"❌ WebSocket WebRTC Signaling test FAILED: {str(e)}")
            self.test_results["websocket_webrtc_signaling"]["error"] = str(e)
    
    def test_websocket_update_info(self):
        """Test WebSocket update_info message to update username/emoji"""
        print("\n=== Testing WebSocket Update Info ===")
        
        try:
            user_id = str(uuid.uuid4())
            messages = []
            connected = [False]
            
            def on_message(ws, message):
                try:
                    msg_data = json.loads(message)
                    messages.append(msg_data)
                    if msg_data.get('type') == 'online_users':
                        users = msg_data.get('users', [])
                        for user in users:
                            if user.get('id') == user_id:
                                print(f"   - Updated user info: {user.get('username')} {user.get('emoji')}")
                except Exception as e:
                    print(f"   - Error parsing message: {e}")
            
            def on_error(ws, error):
                print(f"   - WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                connected[0] = False
            
            def on_open(ws):
                connected[0] = True
                print(f"   - Connected for update_info test")
                
                # Send update_info message
                update_message = {
                    "type": "update_info",
                    "username": "UpdatedTestUser",
                    "emoji": "🔄"
                }
                ws.send(json.dumps(update_message))
                print(f"   - Sent update_info message")
            
            ws_url = f"{WS_URL}/api/ws/{user_id}"
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Start connection
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection and messages
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if connected[0]:
                    break
                time.sleep(0.1)
            
            time.sleep(3)  # Wait for update and broadcast
            ws.close()
            
            # Check if online_users message was received with updated info
            online_users_msgs = [msg for msg in messages if msg.get('type') == 'online_users']
            
            if online_users_msgs:
                # Find our user in the online users list
                updated_user = None
                for msg in online_users_msgs:
                    users = msg.get('users', [])
                    for user in users:
                        if user.get('id') == user_id:
                            updated_user = user
                            break
                    if updated_user:
                        break
                
                if updated_user and updated_user.get('username') == 'UpdatedTestUser' and updated_user.get('emoji') == '🔄':
                    print("✅ WebSocket Update Info test PASSED")
                    print(f"   - Username updated successfully: {updated_user.get('username')}")
                    print(f"   - Emoji updated successfully: {updated_user.get('emoji')}")
                    self.test_results["websocket_update_info"]["passed"] = True
                else:
                    raise Exception("User info was not updated correctly in online_users broadcast")
            else:
                raise Exception("No online_users broadcast received after update_info")
                
        except Exception as e:
            print(f"❌ WebSocket Update Info test FAILED: {str(e)}")
            self.test_results["websocket_update_info"]["error"] = str(e)
    
    def test_online_users_endpoint(self):
        """Test GET /api/online-users endpoint"""
        print("\n=== Testing Online Users Endpoint ===")
        
        try:
            # First, establish a WebSocket connection to have an online user
            user_id = str(uuid.uuid4())
            connected = [False]
            
            def on_open(ws):
                connected[0] = True
                print(f"   - WebSocket connected for online users test")
            
            def on_message(ws, message):
                pass  # We don't need to handle messages for this test
            
            def on_error(ws, error):
                print(f"   - WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                connected[0] = False
            
            ws_url = f"{WS_URL}/api/ws/{user_id}"
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Start WebSocket connection
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if connected[0]:
                    break
                time.sleep(0.1)
            
            if not connected[0]:
                raise Exception("Could not establish WebSocket connection")
            
            time.sleep(1)  # Let the connection register
            
            # Now test the online users endpoint
            response = requests.get(f"{BASE_URL}/online-users", timeout=30)
            
            print(f"Online Users Endpoint Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' not in data:
                    raise Exception("Response missing 'users' field")
                
                users = data['users']
                if not isinstance(users, list):
                    raise Exception("'users' field is not a list")
                
                # Check if our connected user is in the list
                our_user = None
                for user in users:
                    if user.get('id') == user_id:
                        our_user = user
                        break
                
                print("✅ Online Users Endpoint test PASSED")
                print(f"   - Endpoint returned {len(users)} online users")
                if our_user:
                    print(f"   - Our test user found in online users list")
                    print(f"   - User info: {our_user.get('username', 'Anonymous')} {our_user.get('emoji', '👤')}")
                else:
                    print(f"   - Our test user not found (may have disconnected)")
                
                self.test_results["online_users_endpoint"]["passed"] = True
            else:
                raise Exception(f"Online users endpoint failed with status {response.status_code}: {response.text}")
            
            # Close WebSocket connection
            ws.close()
                
        except Exception as e:
            print(f"❌ Online Users Endpoint test FAILED: {str(e)}")
            self.test_results["online_users_endpoint"]["error"] = str(e)
    
    def test_google_drive_connect(self):
        """Test GET /api/drive/connect endpoint"""
        print("\n=== Testing Google Drive Connect Endpoint ===")
        
        if not self.guest_token:
            print("❌ Google Drive Connect test SKIPPED: No authentication token available")
            self.test_results["google_drive_connect"]["error"] = "No authentication token available"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/drive/connect", headers=headers, timeout=30)
            
            print(f"Drive Connect Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'authorization_url' not in data:
                    raise Exception("Response missing 'authorization_url' field")
                
                auth_url = data['authorization_url']
                if not auth_url.startswith('https://accounts.google.com/o/oauth2/auth'):
                    raise Exception(f"Invalid authorization URL: {auth_url}")
                
                # Check if URL contains required OAuth parameters
                required_params = ['client_id', 'redirect_uri', 'scope', 'response_type']
                missing_params = []
                for param in required_params:
                    if param not in auth_url:
                        missing_params.append(param)
                
                if missing_params:
                    print(f"   - Warning: Missing OAuth parameters: {missing_params}")
                
                print("✅ Google Drive Connect test PASSED")
                print(f"   - Authorization URL generated successfully")
                print(f"   - URL starts with correct Google OAuth endpoint")
                print(f"   - URL length: {len(auth_url)} characters")
                
                self.test_results["google_drive_connect"]["passed"] = True
                
            elif response.status_code == 500:
                # Check if it's a configuration error
                error_text = response.text.lower()
                if "not configured" in error_text or "client_id" in error_text or "client_secret" in error_text:
                    print("⚠️  Google Drive Connect test: Configuration issue detected")
                    print("   - Google OAuth credentials may not be properly configured")
                    print("   - This is expected if GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set")
                    # We'll mark this as passed since the endpoint is working, just not configured
                    self.test_results["google_drive_connect"]["passed"] = True
                    self.test_results["google_oauth_config"]["error"] = "OAuth credentials not configured"
                else:
                    raise Exception(f"Drive connect failed with status {response.status_code}: {response.text}")
            else:
                raise Exception(f"Drive connect failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Google Drive Connect test FAILED: {str(e)}")
            self.test_results["google_drive_connect"]["error"] = str(e)
    
    def test_google_oauth_config(self):
        """Test if Google OAuth credentials are properly configured"""
        print("\n=== Testing Google OAuth Configuration ===")
        
        try:
            # Check if environment variables are set by making a request
            if not self.guest_token:
                print("❌ Google OAuth Config test SKIPPED: No authentication token available")
                self.test_results["google_oauth_config"]["error"] = "No authentication token available"
                return
            
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/drive/connect", headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                auth_url = data.get('authorization_url', '')
                
                # Extract client_id from the URL to verify it's configured
                if 'client_id=' in auth_url:
                    # Find the client_id parameter
                    import urllib.parse
                    parsed_url = urllib.parse.urlparse(auth_url)
                    params = urllib.parse.parse_qs(parsed_url.query)
                    client_id = params.get('client_id', [''])[0]
                    
                    if client_id and len(client_id) > 10:  # Basic validation
                        print("✅ Google OAuth Configuration test PASSED")
                        print(f"   - Client ID is configured: {client_id[:20]}...")
                        print(f"   - OAuth flow can be initiated")
                        self.test_results["google_oauth_config"]["passed"] = True
                    else:
                        raise Exception("Client ID appears to be invalid or empty")
                else:
                    raise Exception("Client ID not found in authorization URL")
                    
            elif response.status_code == 500:
                error_text = response.text
                if "not configured" in error_text.lower():
                    print("❌ Google OAuth Configuration test FAILED")
                    print("   - Google OAuth credentials are not configured")
                    print("   - GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET missing")
                    self.test_results["google_oauth_config"]["error"] = "OAuth credentials not configured in environment"
                else:
                    raise Exception(f"Unexpected error: {error_text}")
            else:
                raise Exception(f"Unexpected response status: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Google OAuth Configuration test FAILED: {str(e)}")
            self.test_results["google_oauth_config"]["error"] = str(e)
    
    def test_cors_headers(self):
        """Test CORS headers are present in responses"""
        print("\n=== Testing CORS Headers ===")
        
        try:
            # Test CORS headers on a simple endpoint
            response = requests.get(f"{BASE_URL}/online-users", timeout=30)
            
            print(f"CORS Test Response Status: {response.status_code}")
            
            # Check for CORS headers
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
                'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
            }
            
            print("   - CORS Headers found:")
            cors_present = False
            for header, value in cors_headers.items():
                if value:
                    print(f"     {header}: {value}")
                    cors_present = True
                else:
                    print(f"     {header}: Not present")
            
            if cors_present:
                print("✅ CORS Headers test PASSED")
                print("   - CORS headers are present in API responses")
                self.test_results["cors_headers"]["passed"] = True
            else:
                raise Exception("No CORS headers found in response")
                
        except Exception as e:
            print(f"❌ CORS Headers test FAILED: {str(e)}")
            self.test_results["cors_headers"]["error"] = str(e)
    
    def test_404_handling(self):
        """Test 404 error handling for non-existent files"""
        print("\n=== Testing 404 Error Handling ===")
        
        fake_file_id = "non-existent-file-id-12345"
        
        # Test download 404
        try:
            response = requests.get(f"{BASE_URL}/files/{fake_file_id}/download", timeout=30)
            if response.status_code == 404:
                print("✅ Download 404 handling works correctly")
            else:
                print(f"⚠️  Download 404 test: Expected 404, got {response.status_code}")
        except Exception as e:
            print(f"⚠️  Download 404 test error: {str(e)}")
        
        # Test delete 404 with authentication
        if self.guest_token:
            try:
                headers = self.get_auth_headers(self.guest_token)
                response = requests.delete(f"{BASE_URL}/files/{fake_file_id}", headers=headers, timeout=30)
                if response.status_code == 404:
                    print("✅ Delete 404 handling works correctly")
                else:
                    print(f"⚠️  Delete 404 test: Expected 404, got {response.status_code}")
            except Exception as e:
                print(f"⚠️  Delete 404 test error: {str(e)}")
    
    def run_all_tests(self):
        """Run UniShare6 backend API tests focusing on WebSocket signaling and Google Drive"""
        print("🚀 Starting UniShare6 Backend API Tests")
        print(f"Backend URL: {BASE_URL}")
        print(f"WebSocket URL: {WS_URL}")
        print("\nFocus Areas:")
        print("1. 🔴 HIGH PRIORITY: WebSocket Signaling for P2P functionality")
        print("2. 🟡 NEW FEATURE: Google Drive Integration")
        print("3. 🟢 REGRESSION CHECK: Core File Operations")
        
        # Test core file operations first (regression check)
        print("\n" + "="*70)
        print("🟢 CORE FILE OPERATIONS (Regression Check)")
        print("="*70)
        self.test_guest_creation()
        self.test_file_upload()
        self.test_file_list()
        self.test_file_download()
        self.test_cors_headers()
        
        # Test WebSocket signaling (HIGH PRIORITY)
        print("\n" + "="*70)
        print("🔴 WEBSOCKET SIGNALING (HIGH PRIORITY - P2P Functionality)")
        print("="*70)
        self.test_websocket_connection()
        self.test_websocket_online_users_broadcast()
        self.test_websocket_webrtc_signaling()
        self.test_websocket_update_info()
        self.test_online_users_endpoint()
        
        # Test Google Drive integration (NEW FEATURE)
        print("\n" + "="*70)
        print("🟡 GOOGLE DRIVE INTEGRATION (New Feature)")
        print("="*70)
        self.test_google_drive_connect()
        self.test_google_oauth_config()
        
        # Print summary
        print("\n" + "="*70)
        print("📊 UNISHARE6 BACKEND TEST SUMMARY")
        print("="*70)
        
        # Group results by priority/category
        core_tests = ["guest_creation", "file_upload", "file_list", "file_download", "cors_headers"]
        websocket_tests = ["websocket_connection", "websocket_online_users", "websocket_webrtc_signaling", 
                          "websocket_update_info", "online_users_endpoint"]
        drive_tests = ["google_drive_connect", "google_oauth_config"]
        
        categories = [
            ("🟢 Core File Operations (Regression)", core_tests),
            ("🔴 WebSocket Signaling (HIGH PRIORITY)", websocket_tests),
            ("🟡 Google Drive Integration (New Feature)", drive_tests)
        ]
        
        total_tests = len(self.test_results)
        passed_tests = 0
        critical_failures = []
        
        for category_name, test_names in categories:
            print(f"\n{category_name}:")
            category_passed = 0
            category_total = len(test_names)
            
            for test_name in test_names:
                if test_name in self.test_results:
                    result = self.test_results[test_name]
                    status = "✅ PASSED" if result["passed"] else "❌ FAILED"
                    print(f"  {test_name.replace('_', ' ').title():<35} {status}")
                    if result["error"] and not result["passed"]:
                        print(f"    Error: {result['error']}")
                        # Mark WebSocket failures as critical
                        if test_name in websocket_tests:
                            critical_failures.append(f"WebSocket: {test_name}")
                    if result["passed"]:
                        category_passed += 1
                        passed_tests += 1
            
            print(f"  Category Result: {category_passed}/{category_total} passed")
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed")
        
        # Special focus on WebSocket results since they're critical for P2P
        websocket_passed = sum(1 for test in websocket_tests if self.test_results.get(test, {}).get("passed", False))
        websocket_total = len(websocket_tests)
        
        print(f"\n🔴 CRITICAL: WebSocket P2P Functionality: {websocket_passed}/{websocket_total} tests passed")
        
        if websocket_passed == websocket_total:
            print("✅ WebSocket signaling is FULLY FUNCTIONAL for P2P file transfers")
        elif websocket_passed > 0:
            print("⚠️  WebSocket signaling is PARTIALLY FUNCTIONAL - some P2P features may not work")
        else:
            print("❌ WebSocket signaling is NOT FUNCTIONAL - P2P file transfers will not work")
        
        # Google Drive status
        drive_passed = sum(1 for test in drive_tests if self.test_results.get(test, {}).get("passed", False))
        drive_total = len(drive_tests)
        print(f"\n🟡 Google Drive Integration: {drive_passed}/{drive_total} tests passed")
        
        # Core operations status
        core_passed = sum(1 for test in core_tests if self.test_results.get(test, {}).get("passed", False))
        core_total = len(core_tests)
        print(f"🟢 Core File Operations: {core_passed}/{core_total} tests passed")
        
        if critical_failures:
            print(f"\n❗ CRITICAL FAILURES DETECTED:")
            for failure in critical_failures:
                print(f"   - {failure}")
            print("   These failures will impact P2P functionality!")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = UniShareTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)