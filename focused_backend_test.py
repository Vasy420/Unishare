#!/usr/bin/env python3
"""
FOCUSED BACKEND API TESTING SCRIPT
Tests the specific endpoints requested in the review:
1. Authentication endpoints
2. File operations with authentication
3. WebSocket endpoint
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

print(f"🔍 Testing Backend API at: {BASE_URL}")
print(f"🔍 WebSocket URL: {WS_URL}")

class FocusedAPITester:
    def __init__(self):
        self.guest_token = None
        self.guest_user = None
        self.uploaded_files = []
        self.test_results = []
        
    def log_result(self, test_name, passed, details="", error=""):
        """Log test result"""
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        if error:
            print(f"   Error: {error}")
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "error": error
        })
    
    def create_test_file(self, filename="test_file.txt", content="Test file content for API testing"):
        """Create a temporary test file"""
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=f"_{filename}", delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name
    
    def get_auth_headers(self, token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"} if token else {}
    
    def test_auth_guest_creation(self):
        """Test POST /api/auth/guest - Create a guest user"""
        print("\n=== Testing POST /api/auth/guest ===")
        
        try:
            guest_data = {
                "username": f"TestUser_{int(time.time())}",
                "emoji": "🧪"
            }
            
            response = requests.post(f"{BASE_URL}/auth/guest", json=guest_data, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['access_token', 'token_type', 'user']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields: {missing_fields}")
                
                user = data['user']
                if user['username'] != guest_data['username'] or user['emoji'] != guest_data['emoji']:
                    raise Exception("User data mismatch")
                
                if not user['is_guest']:
                    raise Exception("User should be marked as guest")
                
                # Store for later tests
                self.guest_token = data['access_token']
                self.guest_user = user
                
                self.log_result(
                    "POST /api/auth/guest",
                    True,
                    f"Guest user created: {user['username']} {user['emoji']}"
                )
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("POST /api/auth/guest", False, error=str(e))
    
    def test_auth_me(self):
        """Test GET /api/auth/me - Get current user info with JWT"""
        print("\n=== Testing GET /api/auth/me ===")
        
        if not self.guest_token:
            self.log_result("GET /api/auth/me", False, error="No authentication token available")
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response matches guest user
                if (data['id'] != self.guest_user['id'] or 
                    data['username'] != self.guest_user['username']):
                    raise Exception("User data mismatch with token")
                
                self.log_result(
                    "GET /api/auth/me",
                    True,
                    f"Current user: {data['username']} (ID: {data['id'][:8]}...)"
                )
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/auth/me", False, error=str(e))
    
    def test_file_upload(self):
        """Test POST /api/upload - Upload a test file"""
        print("\n=== Testing POST /api/upload ===")
        
        if not self.guest_token:
            self.log_result("POST /api/upload", False, error="No authentication token available")
            return
        
        try:
            # Create test file
            test_file_path = self.create_test_file("api_test.txt", "Hello from focused API test!")
            
            headers = self.get_auth_headers(self.guest_token)
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('api_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['id', 'filename', 'original_filename', 'size', 'download_url']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields: {missing_fields}")
                
                if data['original_filename'] != 'api_test.txt':
                    raise Exception("Filename mismatch")
                
                if data['size'] <= 0:
                    raise Exception("Invalid file size")
                
                # Store for later tests
                self.uploaded_files.append(data)
                
                self.log_result(
                    "POST /api/upload",
                    True,
                    f"File uploaded: {data['original_filename']} ({data['size']} bytes)"
                )
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
            
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            self.log_result("POST /api/upload", False, error=str(e))
    
    def test_file_list(self):
        """Test GET /api/files - List all files"""
        print("\n=== Testing GET /api/files ===")
        
        if not self.guest_token:
            self.log_result("GET /api/files", False, error="No authentication token available")
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/files", headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    raise Exception(f"Expected list, got {type(data)}")
                
                # Check if our uploaded file is in the list
                found_our_file = False
                if self.uploaded_files:
                    uploaded_file_id = self.uploaded_files[0]['id']
                    for file_info in data:
                        if file_info['id'] == uploaded_file_id:
                            found_our_file = True
                            break
                
                details = f"Found {len(data)} files"
                if found_our_file:
                    details += " (including our uploaded file)"
                
                self.log_result("GET /api/files", True, details)
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/files", False, error=str(e))
    
    def test_file_download(self):
        """Test GET /api/files/{file_id}/download - Download the uploaded file"""
        print("\n=== Testing GET /api/files/{file_id}/download ===")
        
        if not self.uploaded_files:
            self.log_result("GET /api/files/{file_id}/download", False, error="No uploaded files to test")
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
            
            if response.status_code == 200:
                # Check headers
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                # Verify file content
                content = response.content
                if len(content) != file_info['size']:
                    raise Exception(f"Size mismatch: expected {file_info['size']}, got {len(content)}")
                
                self.log_result(
                    "GET /api/files/{file_id}/download",
                    True,
                    f"Downloaded {len(content)} bytes with correct headers"
                )
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/files/{file_id}/download", False, error=str(e))
    
    def test_file_delete(self):
        """Test DELETE /api/files/{file_id} - Delete the uploaded file"""
        print("\n=== Testing DELETE /api/files/{file_id} ===")
        
        if not self.uploaded_files or not self.guest_token:
            self.log_result("DELETE /api/files/{file_id}", False, error="No uploaded files or auth token")
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            headers = self.get_auth_headers(self.guest_token)
            response = requests.delete(f"{BASE_URL}/files/{file_id}", headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('file_id') != file_id:
                    raise Exception("File ID mismatch in response")
                
                # Verify file is actually deleted
                download_response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
                
                if download_response.status_code == 404:
                    self.log_result(
                        "DELETE /api/files/{file_id}",
                        True,
                        "File deleted successfully (verified with 404 on download)"
                    )
                else:
                    raise Exception("File still accessible after deletion")
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("DELETE /api/files/{file_id}", False, error=str(e))
    
    def test_websocket_connection(self):
        """Test WebSocket connection to /api/ws/{user_id}"""
        print("\n=== Testing WebSocket /api/ws/{user_id} ===")
        
        try:
            user_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/api/ws/{user_id}"
            
            connection_established = False
            messages_received = []
            
            def on_message(ws, message):
                try:
                    msg_data = json.loads(message)
                    messages_received.append(msg_data)
                except Exception as e:
                    print(f"   Error parsing message: {e}")
            
            def on_error(ws, error):
                print(f"   WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                pass
            
            def on_open(ws):
                nonlocal connection_established
                connection_established = True
                
                # Close after a short delay
                def close_connection():
                    time.sleep(2)
                    ws.close()
                
                threading.Thread(target=close_connection).start()
            
            # Create WebSocket connection
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
                if connection_established:
                    break
                time.sleep(0.1)
            
            # Wait for messages
            time.sleep(3)
            
            if connection_established:
                self.log_result(
                    "WebSocket /api/ws/{user_id}",
                    True,
                    f"Connection established, received {len(messages_received)} messages"
                )
            else:
                raise Exception("WebSocket connection could not be established")
                
        except Exception as e:
            self.log_result("WebSocket /api/ws/{user_id}", False, error=str(e))
    
    def test_online_users_endpoint(self):
        """Test GET /api/online-users endpoint"""
        print("\n=== Testing GET /api/online-users ===")
        
        try:
            response = requests.get(f"{BASE_URL}/online-users", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' not in data:
                    raise Exception("Response missing 'users' field")
                
                users = data['users']
                if not isinstance(users, list):
                    raise Exception("'users' field is not a list")
                
                self.log_result(
                    "GET /api/online-users",
                    True,
                    f"Returned {len(users)} online users"
                )
                
            else:
                raise Exception(f"Status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/online-users", False, error=str(e))
    
    def run_focused_tests(self):
        """Run all focused API tests as requested in the review"""
        print("🎯 FOCUSED BACKEND API TESTING")
        print("Testing specific endpoints as requested in review:")
        print("1. Authentication endpoints")
        print("2. File operations (requires authentication)")
        print("3. WebSocket endpoint")
        
        # Authentication endpoints
        print("\n" + "="*60)
        print("🔐 AUTHENTICATION ENDPOINTS")
        print("="*60)
        self.test_auth_guest_creation()
        self.test_auth_me()
        
        # File operations (requires authentication)
        print("\n" + "="*60)
        print("📁 FILE OPERATIONS (WITH AUTHENTICATION)")
        print("="*60)
        self.test_file_upload()
        self.test_file_list()
        self.test_file_download()
        self.test_file_delete()
        
        # WebSocket endpoint
        print("\n" + "="*60)
        print("🔌 WEBSOCKET ENDPOINT")
        print("="*60)
        self.test_websocket_connection()
        self.test_online_users_endpoint()
        
        # Summary
        print("\n" + "="*60)
        print("📊 FOCUSED TEST SUMMARY")
        print("="*60)
        
        passed_tests = sum(1 for result in self.test_results if result["passed"])
        total_tests = len(self.test_results)
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed")
        
        # Group by category
        auth_tests = [r for r in self.test_results if "auth" in r["test"].lower()]
        file_tests = [r for r in self.test_results if any(x in r["test"].lower() for x in ["upload", "files", "download", "delete"])]
        ws_tests = [r for r in self.test_results if "websocket" in r["test"].lower() or "online-users" in r["test"].lower()]
        
        categories = [
            ("🔐 Authentication", auth_tests),
            ("📁 File Operations", file_tests),
            ("🔌 WebSocket", ws_tests)
        ]
        
        for category_name, tests in categories:
            if tests:
                passed = sum(1 for t in tests if t["passed"])
                total = len(tests)
                print(f"\n{category_name}: {passed}/{total} passed")
                
                for test in tests:
                    status = "✅" if test["passed"] else "❌"
                    print(f"  {status} {test['test']}")
                    if test["error"] and not test["passed"]:
                        print(f"      Error: {test['error']}")
        
        # Critical findings
        failed_tests = [r for r in self.test_results if not r["passed"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['error']}")
        else:
            print(f"\n✅ ALL TESTS PASSED!")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = FocusedAPITester()
    success = tester.run_focused_tests()
    exit(0 if success else 1)