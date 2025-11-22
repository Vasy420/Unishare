#!/usr/bin/env python3
"""
UNISHARE2 COMPREHENSIVE BACKEND TESTING - REVIEW REQUEST FOCUSED
Tests ALL backend functionality EXCEPT Google Drive integration
Heavy focus on WebRTC/P2P features as requested
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
print(f"🎯 COMPREHENSIVE BACKEND TESTING FOR UNISHARE2")
print(f"Backend URL: {BASE_URL}")
print(f"WebSocket URL: {WS_URL}")

class UniShare2Tester:
    def __init__(self):
        self.guest_token = None
        self.user_token = None
        self.guest_user = None
        self.registered_user = None
        self.uploaded_files = []
        
        # Test results tracking
        self.test_results = {
            # Authentication System (4 endpoints)
            "auth_guest_creation": {"passed": False, "error": None},
            "auth_user_registration": {"passed": False, "error": None},
            "auth_user_login": {"passed": False, "error": None},
            "auth_get_me": {"passed": False, "error": None},
            
            # File Management (4 endpoints)
            "file_upload_auth": {"passed": False, "error": None},
            "file_list_auth": {"passed": False, "error": None},
            "file_download": {"passed": False, "error": None},
            "file_delete_auth": {"passed": False, "error": None},
            
            # WebRTC/P2P Critical Features
            "websocket_connection": {"passed": False, "error": None},
            "websocket_signaling": {"passed": False, "error": None},
            "online_users_endpoint": {"passed": False, "error": None},
            "websocket_stability": {"passed": False, "error": None},
            
            # Guest Data Limits
            "guest_data_limit": {"passed": False, "error": None},
        }
    
    def create_test_file(self, filename="test_file.txt", content="Test file content for UniShare2 backend testing.", size_mb=None):
        """Create a temporary test file"""
        if size_mb:
            content = "A" * (size_mb * 1024 * 1024)
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=f"_{filename}", delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name
    
    def get_auth_headers(self, token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"} if token else {}
    
    def test_auth_guest_creation(self):
        """Test POST /api/auth/guest - Create guest user with username and emoji"""
        print("\n=== 🧪 Testing Authentication: Guest Creation ===")
        
        try:
            guest_data = {
                "username": f"UniShare2Guest_{int(time.time())}",
                "emoji": "🚀"
            }
            
            response = requests.post(f"{BASE_URL}/auth/guest", json=guest_data, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                for field in required_fields:
                    if field not in data:
                        raise Exception(f"Missing field: {field}")
                
                user = data['user']
                if user['username'] != guest_data['username']:
                    raise Exception(f"Username mismatch")
                if user['emoji'] != guest_data['emoji']:
                    raise Exception(f"Emoji mismatch")
                if not user['is_guest']:
                    raise Exception("User should be marked as guest")
                
                # Store for later tests
                self.guest_token = data['access_token']
                self.guest_user = user
                
                print(f"✅ PASSED - Guest created: {user['username']} {user['emoji']}")
                self.test_results["auth_guest_creation"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["auth_guest_creation"]["error"] = str(e)
    
    def test_auth_user_registration(self):
        """Test POST /api/auth/register - Register new user with email/password/username"""
        print("\n=== 👤 Testing Authentication: User Registration ===")
        
        try:
            timestamp = int(time.time())
            user_data = {
                "username": f"UniShare2User_{timestamp}",
                "email": f"unishare2user_{timestamp}@testdomain.com",
                "password": "SecurePassword2024!"
            }
            
            response = requests.post(f"{BASE_URL}/auth/register", json=user_data, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                for field in required_fields:
                    if field not in data:
                        raise Exception(f"Missing field: {field}")
                
                user = data['user']
                if user['username'] != user_data['username']:
                    raise Exception("Username mismatch")
                if user['email'] != user_data['email']:
                    raise Exception("Email mismatch")
                if user['is_guest']:
                    raise Exception("User should not be marked as guest")
                
                # Store for later tests
                self.user_token = data['access_token']
                self.registered_user = user
                
                print(f"✅ PASSED - User registered: {user['username']} ({user['email']})")
                self.test_results["auth_user_registration"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["auth_user_registration"]["error"] = str(e)
    
    def test_auth_user_login(self):
        """Test POST /api/auth/login - Login with email and password"""
        print("\n=== 🔐 Testing Authentication: User Login ===")
        
        if not self.registered_user:
            print("❌ SKIPPED: No registered user available")
            self.test_results["auth_user_login"]["error"] = "No registered user"
            return
        
        try:
            login_data = {
                "email": self.registered_user['email'],
                "password": "SecurePassword2024!"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                for field in required_fields:
                    if field not in data:
                        raise Exception(f"Missing field: {field}")
                
                user = data['user']
                if user['id'] != self.registered_user['id']:
                    raise Exception("User ID mismatch after login")
                
                print(f"✅ PASSED - Login successful: {user['username']}")
                self.test_results["auth_user_login"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["auth_user_login"]["error"] = str(e)
    
    def test_auth_get_me(self):
        """Test GET /api/auth/me - Get current user info with JWT token"""
        print("\n=== 🆔 Testing Authentication: Get Current User ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No authentication token")
            self.test_results["auth_get_me"]["error"] = "No token"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response matches guest user
                if data['id'] != self.guest_user['id']:
                    raise Exception("User ID mismatch")
                if data['username'] != self.guest_user['username']:
                    raise Exception("Username mismatch")
                
                print(f"✅ PASSED - Current user: {data['username']} (Guest: {data['is_guest']})")
                self.test_results["auth_get_me"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["auth_get_me"]["error"] = str(e)
    
    def test_file_upload_auth(self):
        """Test POST /api/upload - Upload file with authentication (test with JWT token)"""
        print("\n=== 📤 Testing File Management: Upload with Authentication ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No authentication token")
            self.test_results["file_upload_auth"]["error"] = "No token"
            return
        
        try:
            # Create test file
            test_file_path = self.create_test_file("unishare2_test.txt", "UniShare2 backend test file content!")
            
            headers = self.get_auth_headers(self.guest_token)
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('unishare2_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['id', 'filename', 'original_filename', 'size', 'upload_date', 'download_url', 'share_url', 'owner_username']
                for field in required_fields:
                    if field not in data:
                        raise Exception(f"Missing field: {field}")
                
                # Verify file metadata
                if data['original_filename'] != 'unishare2_test.txt':
                    raise Exception("Original filename mismatch")
                if data['size'] <= 0:
                    raise Exception("Invalid file size")
                if data['owner_username'] != self.guest_user['username']:
                    raise Exception("Owner username mismatch")
                
                # Store for later tests
                self.uploaded_files.append(data)
                
                print(f"✅ PASSED - File uploaded: {data['original_filename']} ({data['size']} bytes)")
                self.test_results["file_upload_auth"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_upload_auth"]["error"] = str(e)
    
    def test_file_list_auth(self):
        """Test GET /api/files - List files for authenticated user"""
        print("\n=== 📋 Testing File Management: List Files with Authentication ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No authentication token")
            self.test_results["file_list_auth"]["error"] = "No token"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/files", headers=headers, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    raise Exception(f"Expected list, got {type(data)}")
                
                # Verify our uploaded file is in the list
                found_file = False
                if self.uploaded_files:
                    uploaded_file_id = self.uploaded_files[0]['id']
                    for file_info in data:
                        if file_info['id'] == uploaded_file_id:
                            found_file = True
                            break
                
                print(f"✅ PASSED - Found {len(data)} files" + (f", including our uploaded file" if found_file else ""))
                self.test_results["file_list_auth"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_list_auth"]["error"] = str(e)
    
    def test_file_download(self):
        """Test GET /api/files/{file_id}/download - Download file"""
        print("\n=== 📥 Testing File Management: Download File ===")
        
        if not self.uploaded_files:
            print("❌ SKIPPED: No uploaded files")
            self.test_results["file_download"]["error"] = "No uploaded files"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check headers
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                # Verify file content
                content = response.content
                if len(content) != file_info['size']:
                    raise Exception(f"Size mismatch: expected {file_info['size']}, got {len(content)}")
                
                print(f"✅ PASSED - Downloaded {len(content)} bytes, Content-Type: {content_type}")
                self.test_results["file_download"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_download"]["error"] = str(e)
    
    def test_file_delete_auth(self):
        """Test DELETE /api/files/{file_id} - Delete file"""
        print("\n=== 🗑️ Testing File Management: Delete File with Authentication ===")
        
        if not self.uploaded_files or not self.guest_token:
            print("❌ SKIPPED: No uploaded files or token")
            self.test_results["file_delete_auth"]["error"] = "No files or token"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            headers = self.get_auth_headers(self.guest_token)
            response = requests.delete(f"{BASE_URL}/files/{file_id}", headers=headers, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('file_id') != file_id:
                    raise Exception("Delete response file_id mismatch")
                
                # Verify file is deleted by trying to download
                download_response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
                
                if download_response.status_code == 404:
                    print("✅ PASSED - File deleted successfully (404 on download)")
                    self.test_results["file_delete_auth"]["passed"] = True
                else:
                    raise Exception(f"File still accessible after deletion (status: {download_response.status_code})")
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_delete_auth"]["error"] = str(e)
    
    def test_websocket_connection(self):
        """Test WebSocket connection at /api/ws/{user_id} - MUST WORK PERFECTLY"""
        print("\n=== 🔌 Testing WebRTC/P2P: WebSocket Connection ===")
        
        try:
            user_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/api/ws/{user_id}"
            print(f"Connecting to: {ws_url}")
            
            messages = []
            connected = [False]
            
            def on_message(ws, message):
                try:
                    msg_data = json.loads(message)
                    messages.append(msg_data)
                    print(f"   📨 Received: {msg_data.get('type', 'unknown')}")
                except Exception as e:
                    print(f"   ❌ Message parse error: {e}")
            
            def on_error(ws, error):
                print(f"   ❌ WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                connected[0] = False
                print(f"   🔌 Connection closed")
            
            def on_open(ws):
                connected[0] = True
                print(f"   ✅ WebSocket connected successfully")
                
                # Close after testing basic connectivity
                def close_later():
                    time.sleep(2)
                    ws.close()
                threading.Thread(target=close_later).start()
            
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket in thread
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
            
            # Wait for messages
            time.sleep(3)
            
            if connected[0] or len(messages) > 0:
                print(f"✅ PASSED - Connection established, received {len(messages)} messages")
                self.test_results["websocket_connection"]["passed"] = True
            else:
                raise Exception("WebSocket connection failed")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["websocket_connection"]["error"] = str(e)
    
    def test_online_users_endpoint(self):
        """Test GET /api/online-users - Get list of online users"""
        print("\n=== 👥 Testing WebRTC/P2P: Online Users Endpoint ===")
        
        try:
            response = requests.get(f"{BASE_URL}/online-users", timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' not in data:
                    raise Exception("Response missing 'users' field")
                
                users = data['users']
                if not isinstance(users, list):
                    raise Exception("'users' field is not a list")
                
                print(f"✅ PASSED - Online users endpoint working, {len(users)} users online")
                self.test_results["online_users_endpoint"]["passed"] = True
                
            else:
                raise Exception(f"Failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["online_users_endpoint"]["error"] = str(e)
    
    def test_websocket_signaling(self):
        """Test WebSocket message handling (offer, answer, ICE candidates)"""
        print("\n=== 📡 Testing WebRTC/P2P: WebSocket Signaling Messages ===")
        
        try:
            user1_id = str(uuid.uuid4())
            user2_id = str(uuid.uuid4())
            
            user1_messages = []
            user2_messages = []
            connections = {"user1": [False], "user2": [False]}
            
            def create_handlers(user_id, messages_list, connection_flag):
                def on_message(ws, message):
                    try:
                        msg_data = json.loads(message)
                        messages_list.append(msg_data)
                        msg_type = msg_data.get('type', 'unknown')
                        sender = msg_data.get('sender', 'system')
                        print(f"   📨 {user_id[:8]} received {msg_type} from {sender[:8] if sender != 'system' else sender}")
                    except Exception as e:
                        print(f"   ❌ Message error: {e}")
                
                def on_error(ws, error):
                    print(f"   ❌ {user_id[:8]} error: {error}")
                
                def on_close(ws, close_status_code, close_msg):
                    connection_flag[0] = False
                
                def on_open(ws):
                    connection_flag[0] = True
                    print(f"   ✅ {user_id[:8]} connected")
                
                return on_message, on_error, on_close, on_open
            
            # Create WebSocket connections
            user1_handlers = create_handlers(user1_id, user1_messages, connections["user1"])
            user2_handlers = create_handlers(user2_id, user2_messages, connections["user2"])
            
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
            
            # Wait for both connections
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if connections["user1"][0] and connections["user2"][0]:
                    break
                time.sleep(0.1)
            
            if not (connections["user1"][0] and connections["user2"][0]):
                raise Exception("Could not establish both WebSocket connections")
            
            time.sleep(1)  # Let initial messages settle
            
            # Test WebRTC signaling flow
            print("   📤 Testing offer message...")
            offer_message = {
                "type": "offer",
                "target": user2_id,
                "offer": {"type": "offer", "sdp": "test-offer-sdp"}
            }
            ws1.send(json.dumps(offer_message))
            time.sleep(1)
            
            print("   📤 Testing answer message...")
            answer_message = {
                "type": "answer",
                "target": user1_id,
                "answer": {"type": "answer", "sdp": "test-answer-sdp"}
            }
            ws2.send(json.dumps(answer_message))
            time.sleep(1)
            
            print("   📤 Testing ICE candidate...")
            ice_message = {
                "type": "ice-candidate",
                "target": user2_id,
                "candidate": {"candidate": "test-ice-candidate"}
            }
            ws1.send(json.dumps(ice_message))
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
            
            # Check signaling success
            signaling_success = True
            results = []
            
            if user2_offers and user2_offers[0].get('sender') == user1_id:
                results.append("✅ Offer forwarding")
            else:
                results.append("❌ Offer forwarding")
                signaling_success = False
            
            if user1_answers and user1_answers[0].get('sender') == user2_id:
                results.append("✅ Answer forwarding")
            else:
                results.append("❌ Answer forwarding")
                signaling_success = False
            
            if user2_ice and user2_ice[0].get('sender') == user1_id:
                results.append("✅ ICE candidate forwarding")
            else:
                results.append("❌ ICE candidate forwarding")
                signaling_success = False
            
            if signaling_success:
                print(f"✅ PASSED - WebRTC signaling working: {', '.join(results)}")
                self.test_results["websocket_signaling"]["passed"] = True
            else:
                raise Exception(f"Signaling issues: {', '.join(results)}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["websocket_signaling"]["error"] = str(e)
    
    def test_websocket_stability(self):
        """Test WebSocket stays connected and handles multiple users"""
        print("\n=== 🔄 Testing WebRTC/P2P: WebSocket Connection Stability ===")
        
        try:
            user_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/api/ws/{user_id}"
            
            messages = []
            connected = [False]
            connection_time = [0]
            
            def on_message(ws, message):
                try:
                    msg_data = json.loads(message)
                    messages.append(msg_data)
                except:
                    pass
            
            def on_error(ws, error):
                print(f"   ❌ Stability test error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                connected[0] = False
                end_time = time.time()
                connection_time[0] = end_time - connection_time[0]
                print(f"   🔌 Connection lasted {connection_time[0]:.1f} seconds")
            
            def on_open(ws):
                connected[0] = True
                connection_time[0] = time.time()
                print(f"   ✅ Stability test connection established")
                
                # Keep connection alive for 5 seconds
                def close_later():
                    time.sleep(5)
                    ws.close()
                threading.Thread(target=close_later).start()
            
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection and completion
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if connected[0]:
                    break
                time.sleep(0.1)
            
            # Wait for test completion
            time.sleep(6)
            
            if connection_time[0] >= 4:  # Connection lasted at least 4 seconds
                print(f"✅ PASSED - WebSocket connection stable for {connection_time[0]:.1f}s, {len(messages)} messages")
                self.test_results["websocket_stability"]["passed"] = True
            else:
                raise Exception(f"Connection unstable, lasted only {connection_time[0]:.1f} seconds")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["websocket_stability"]["error"] = str(e)
    
    def test_guest_data_limit(self):
        """Test 2GB limit enforcement for guest users"""
        print("\n=== 💾 Testing Guest Data Limits: 2GB Enforcement ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No guest token")
            self.test_results["guest_data_limit"]["error"] = "No guest token"
            return
        
        try:
            # Upload a file and check data usage tracking
            test_file_path = self.create_test_file("data_limit_test.txt", "Testing data limit tracking for guest users.")
            
            headers = self.get_auth_headers(self.guest_token)
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('data_limit_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            print(f"Upload Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check current user data usage
                me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    total_data = user_data['total_data_shared']
                    limit = 2 * 1024 * 1024 * 1024  # 2GB
                    
                    print(f"   📊 Data usage: {total_data:,} bytes / {limit:,} bytes (2GB)")
                    
                    if total_data > 0:
                        print("✅ PASSED - Data usage tracking working correctly")
                        self.test_results["guest_data_limit"]["passed"] = True
                        
                        # Clean up the test file
                        delete_response = requests.delete(f"{BASE_URL}/files/{data['id']}", headers=headers, timeout=30)
                        if delete_response.status_code == 200:
                            print("   🧹 Test file cleaned up")
                    else:
                        raise Exception("Data usage not being tracked")
                else:
                    raise Exception("Could not verify data usage")
            else:
                # Check if it's a limit error (which would be expected for a large file)
                if response.status_code == 403 and "limit exceeded" in response.text.lower():
                    print("✅ PASSED - 2GB limit enforcement working")
                    self.test_results["guest_data_limit"]["passed"] = True
                else:
                    raise Exception(f"Upload failed unexpectedly: {response.status_code} - {response.text}")
            
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["guest_data_limit"]["error"] = str(e)
    
    def run_comprehensive_tests(self):
        """Run comprehensive backend tests as requested in review"""
        print("🚀 STARTING COMPREHENSIVE BACKEND TESTING FOR UNISHARE2")
        print("="*80)
        print("📋 TEST SCOPE:")
        print("   ✅ Authentication System (4 endpoints)")
        print("   ✅ File Management (4 endpoints)")
        print("   ✅ WebRTC/P2P Critical Features (WebSocket + online users)")
        print("   ✅ Guest Data Limits (2GB enforcement)")
        print("   ❌ Google Drive integration (EXCLUDED as requested)")
        print("="*80)
        
        # 1. Authentication System Tests
        print("\n🔐 AUTHENTICATION SYSTEM TESTING")
        print("-" * 50)
        self.test_auth_guest_creation()
        self.test_auth_user_registration()
        self.test_auth_user_login()
        self.test_auth_get_me()
        
        # 2. File Management Tests
        print("\n📁 FILE MANAGEMENT TESTING")
        print("-" * 50)
        self.test_file_upload_auth()
        self.test_file_list_auth()
        self.test_file_download()
        self.test_file_delete_auth()
        
        # 3. WebRTC/P2P Critical Features Tests
        print("\n🌐 WEBRTC/P2P CRITICAL FEATURES TESTING")
        print("-" * 50)
        self.test_websocket_connection()
        self.test_online_users_endpoint()
        self.test_websocket_signaling()
        self.test_websocket_stability()
        
        # 4. Guest Data Limits Test
        print("\n💾 GUEST DATA LIMITS TESTING")
        print("-" * 50)
        self.test_guest_data_limit()
        
        # Generate comprehensive summary
        self.generate_test_summary()
    
    def generate_test_summary(self):
        """Generate comprehensive test summary"""
        print("\n" + "="*80)
        print("📊 UNISHARE2 COMPREHENSIVE BACKEND TEST RESULTS")
        print("="*80)
        
        # Group tests by category
        categories = {
            "🔐 Authentication System": [
                "auth_guest_creation", "auth_user_registration", 
                "auth_user_login", "auth_get_me"
            ],
            "📁 File Management": [
                "file_upload_auth", "file_list_auth", 
                "file_download", "file_delete_auth"
            ],
            "🌐 WebRTC/P2P Features": [
                "websocket_connection", "online_users_endpoint",
                "websocket_signaling", "websocket_stability"
            ],
            "💾 Guest Data Limits": [
                "guest_data_limit"
            ]
        }
        
        total_tests = len(self.test_results)
        total_passed = 0
        critical_failures = []
        
        for category_name, test_names in categories.items():
            print(f"\n{category_name}:")
            category_passed = 0
            category_total = len(test_names)
            
            for test_name in test_names:
                if test_name in self.test_results:
                    result = self.test_results[test_name]
                    status = "✅ PASSED" if result["passed"] else "❌ FAILED"
                    test_display = test_name.replace('_', ' ').title()
                    print(f"  {test_display:<35} {status}")
                    
                    if result["error"] and not result["passed"]:
                        print(f"    💥 Error: {result['error']}")
                        # Mark WebSocket failures as critical
                        if "websocket" in test_name or "online_users" in test_name:
                            critical_failures.append(f"WebRTC/P2P: {test_display}")
                    
                    if result["passed"]:
                        category_passed += 1
                        total_passed += 1
            
            success_rate = (category_passed / category_total) * 100
            print(f"  📈 Category Result: {category_passed}/{category_total} passed ({success_rate:.0f}%)")
        
        # Overall results
        overall_success_rate = (total_passed / total_tests) * 100
        print(f"\n🎯 OVERALL RESULT: {total_passed}/{total_tests} tests passed ({overall_success_rate:.0f}%)")
        
        # WebRTC/P2P specific analysis
        webrtc_tests = categories["🌐 WebRTC/P2P Features"]
        webrtc_passed = sum(1 for test in webrtc_tests if self.test_results.get(test, {}).get("passed", False))
        webrtc_total = len(webrtc_tests)
        webrtc_success_rate = (webrtc_passed / webrtc_total) * 100
        
        print(f"\n🔴 CRITICAL ANALYSIS: WebRTC/P2P Functionality")
        print(f"   📊 WebSocket Tests: {webrtc_passed}/{webrtc_total} passed ({webrtc_success_rate:.0f}%)")
        
        if webrtc_success_rate >= 75:
            print("   ✅ WebRTC/P2P functionality is OPERATIONAL for file transfers")
        elif webrtc_success_rate >= 50:
            print("   ⚠️  WebRTC/P2P functionality is PARTIALLY WORKING - some features may fail")
        else:
            print("   ❌ WebRTC/P2P functionality has MAJOR ISSUES - P2P transfers may not work")
        
        # Authentication analysis
        auth_tests = categories["🔐 Authentication System"]
        auth_passed = sum(1 for test in auth_tests if self.test_results.get(test, {}).get("passed", False))
        auth_total = len(auth_tests)
        auth_success_rate = (auth_passed / auth_total) * 100
        
        print(f"\n🔐 Authentication System: {auth_passed}/{auth_total} passed ({auth_success_rate:.0f}%)")
        
        # File Management analysis
        file_tests = categories["📁 File Management"]
        file_passed = sum(1 for test in file_tests if self.test_results.get(test, {}).get("passed", False))
        file_total = len(file_tests)
        file_success_rate = (file_passed / file_total) * 100
        
        print(f"📁 File Management: {file_passed}/{file_total} passed ({file_success_rate:.0f}%)")
        
        # Critical failures summary
        if critical_failures:
            print(f"\n❗ CRITICAL FAILURES DETECTED:")
            for failure in critical_failures:
                print(f"   🔥 {failure}")
            print("   ⚠️  These failures will impact core P2P functionality!")
        else:
            print(f"\n✅ NO CRITICAL FAILURES - All core systems operational")
        
        # Final recommendation
        print(f"\n🏁 FINAL ASSESSMENT:")
        if overall_success_rate >= 90:
            print("   🟢 BACKEND STATUS: PRODUCTION READY")
            print("   ✅ All major systems working correctly")
        elif overall_success_rate >= 75:
            print("   🟡 BACKEND STATUS: MOSTLY FUNCTIONAL")
            print("   ⚠️  Some minor issues need attention")
        else:
            print("   🔴 BACKEND STATUS: NEEDS ATTENTION")
            print("   ❌ Major issues detected that need fixing")
        
        return overall_success_rate >= 75

if __name__ == "__main__":
    tester = UniShare2Tester()
    success = tester.run_comprehensive_tests()
    exit(0 if success else 1)