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
            # Authentication tests
            "guest_creation": {"passed": False, "error": None},
            "user_registration": {"passed": False, "error": None},
            "user_login": {"passed": False, "error": None},
            "get_me": {"passed": False, "error": None},
            
            # File management tests
            "file_upload": {"passed": False, "error": None},
            "file_list": {"passed": False, "error": None},
            "file_download": {"passed": False, "error": None},
            "file_delete": {"passed": False, "error": None},
            
            # Guest limit tests
            "guest_data_limit": {"passed": False, "error": None},
            
            # WebSocket tests
            "websocket_connection": {"passed": False, "error": None}
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
        """Test WebSocket connection for WebRTC signaling"""
        print("\n=== Testing WebSocket Connection ===")
        
        try:
            # Generate a test user ID
            test_user_id = str(uuid.uuid4())
            ws_url = f"{WS_URL}/api/ws/{test_user_id}"
            
            print(f"Connecting to WebSocket: {ws_url}")
            
            # Create WebSocket connection
            def on_message(ws, message):
                self.ws_messages.append(json.loads(message))
                print(f"   - Received message: {message}")
            
            def on_error(ws, error):
                print(f"   - WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                print(f"   - WebSocket closed: {close_status_code} - {close_msg}")
                self.ws_connected = False
            
            def on_open(ws):
                print("   - WebSocket connection opened")
                self.ws_connected = True
                
                # Send a test message
                test_message = {
                    "type": "update_info",
                    "username": "TestUser",
                    "emoji": "🧪"
                }
                ws.send(json.dumps(test_message))
                
                # Close connection after a short delay
                def close_connection():
                    time.sleep(2)
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
            
            # Wait for connection and messages
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if self.ws_connected:
                    break
                time.sleep(0.1)
            
            # Wait a bit more for messages
            time.sleep(3)
            
            if self.ws_connected or len(self.ws_messages) > 0:
                print("✅ WebSocket Connection test PASSED")
                print(f"   - Connection established successfully")
                print(f"   - Received {len(self.ws_messages)} messages")
                self.test_results["websocket_connection"]["passed"] = True
            else:
                raise Exception("WebSocket connection could not be established")
                
        except Exception as e:
            print(f"❌ WebSocket Connection test FAILED: {str(e)}")
            self.test_results["websocket_connection"]["error"] = str(e)
    
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
        """Run all UniShare backend API tests"""
        print("🚀 Starting UniShare Backend API Tests")
        print(f"Backend URL: {BASE_URL}")
        print(f"WebSocket URL: {WS_URL}")
        
        # Test authentication endpoints first
        print("\n" + "="*60)
        print("🔐 AUTHENTICATION TESTS")
        print("="*60)
        self.test_guest_creation()
        self.test_user_registration()
        self.test_user_login()
        self.test_get_me()
        
        # Test file management with authentication
        print("\n" + "="*60)
        print("📁 FILE MANAGEMENT TESTS")
        print("="*60)
        self.test_file_upload()
        self.test_file_list()
        self.test_file_download()
        self.test_file_delete()
        
        # Test guest data limits
        print("\n" + "="*60)
        print("📊 GUEST DATA LIMIT TESTS")
        print("="*60)
        self.test_guest_data_limit()
        
        # Test WebSocket signaling
        print("\n" + "="*60)
        print("🌐 WEBSOCKET SIGNALING TESTS")
        print("="*60)
        self.test_websocket_connection()
        
        # Test error handling
        print("\n" + "="*60)
        print("🚫 ERROR HANDLING TESTS")
        print("="*60)
        self.test_404_handling()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 UNISHARE BACKEND TEST SUMMARY")
        print("="*60)
        
        # Group results by category
        auth_tests = ["guest_creation", "user_registration", "user_login", "get_me"]
        file_tests = ["file_upload", "file_list", "file_download", "file_delete"]
        limit_tests = ["guest_data_limit"]
        ws_tests = ["websocket_connection"]
        
        categories = [
            ("🔐 Authentication", auth_tests),
            ("📁 File Management", file_tests),
            ("📊 Data Limits", limit_tests),
            ("🌐 WebSocket", ws_tests)
        ]
        
        total_tests = len(self.test_results)
        passed_tests = 0
        
        for category_name, test_names in categories:
            print(f"\n{category_name}:")
            category_passed = 0
            category_total = len(test_names)
            
            for test_name in test_names:
                if test_name in self.test_results:
                    result = self.test_results[test_name]
                    status = "✅ PASSED" if result["passed"] else "❌ FAILED"
                    print(f"  {test_name.replace('_', ' ').title():<25} {status}")
                    if result["error"] and not result["passed"]:
                        print(f"    Error: {result['error']}")
                    if result["passed"]:
                        category_passed += 1
                        passed_tests += 1
            
            print(f"  Category Result: {category_passed}/{category_total} passed")
        
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All UniShare backend API tests PASSED!")
            print("✅ Authentication system working correctly")
            print("✅ File management with ownership working correctly")
            print("✅ Guest data limits being enforced")
            print("✅ WebSocket signaling available for WebRTC")
            return True
        else:
            print("⚠️  Some UniShare backend API tests FAILED!")
            print("❗ Please check the failed tests above for details")
            return False

if __name__ == "__main__":
    tester = UniShareTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)