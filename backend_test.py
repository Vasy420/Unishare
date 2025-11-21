#!/usr/bin/env python3
"""
UniShare Backend API Testing Script
Tests authentication, file management, guest limits, and WebSocket signaling
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
    
    def test_list_files_api(self):
        """Test GET /api/files endpoint"""
        print("\n=== Testing List Files API ===")
        
        try:
            response = requests.get(f"{BASE_URL}/files", timeout=30)
            
            print(f"List Files Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    raise Exception(f"Expected list response, got {type(data)}")
                
                print(f"✅ List Files API test PASSED")
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
                
                self.test_results["list_files"]["passed"] = True
                
            else:
                raise Exception(f"List files failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ List Files API test FAILED: {str(e)}")
            self.test_results["list_files"]["error"] = str(e)
    
    def test_download_api(self):
        """Test GET /api/files/{file_id}/download endpoint"""
        print("\n=== Testing Download API ===")
        
        if not self.uploaded_files:
            print("❌ Download API test SKIPPED: No uploaded files to test")
            self.test_results["download"]["error"] = "No uploaded files available"
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
                
                print("✅ Download API test PASSED")
                print(f"   - Downloaded {len(content)} bytes")
                print(f"   - Original filename: {file_info['original_filename']}")
                
                self.test_results["download"]["passed"] = True
                
            else:
                raise Exception(f"Download failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Download API test FAILED: {str(e)}")
            self.test_results["download"]["error"] = str(e)
    
    def test_delete_api(self):
        """Test DELETE /api/files/{file_id} endpoint"""
        print("\n=== Testing Delete API ===")
        
        if not self.uploaded_files:
            print("❌ Delete API test SKIPPED: No uploaded files to test")
            self.test_results["delete"]["error"] = "No uploaded files available"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            # Delete the file
            response = requests.delete(f"{BASE_URL}/files/{file_id}", timeout=30)
            
            print(f"Delete Response Status: {response.status_code}")
            print(f"Delete Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('file_id') != file_id:
                    raise Exception(f"Delete response file_id mismatch: expected {file_id}, got {data.get('file_id')}")
                
                # Verify file is actually deleted by trying to download it
                print("   - Verifying file deletion...")
                download_response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
                
                if download_response.status_code == 404:
                    print("   - Confirmed: File not found after deletion (404)")
                    print("✅ Delete API test PASSED")
                    self.test_results["delete"]["passed"] = True
                else:
                    raise Exception(f"File still accessible after deletion (status: {download_response.status_code})")
                
            else:
                raise Exception(f"Delete failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Delete API test FAILED: {str(e)}")
            self.test_results["delete"]["error"] = str(e)
    
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
        
        # Test delete 404
        try:
            response = requests.delete(f"{BASE_URL}/files/{fake_file_id}", timeout=30)
            if response.status_code == 404:
                print("✅ Delete 404 handling works correctly")
            else:
                print(f"⚠️  Delete 404 test: Expected 404, got {response.status_code}")
        except Exception as e:
            print(f"⚠️  Delete 404 test error: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Backend API Tests")
        print(f"Backend URL: {BASE_URL}")
        
        # Test in sequence: upload -> list -> download -> delete
        self.test_upload_api()
        self.test_list_files_api()
        self.test_download_api()
        self.test_delete_api()
        self.test_404_handling()
        
        # Print summary
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result["passed"])
        
        for test_name, result in self.test_results.items():
            status = "✅ PASSED" if result["passed"] else "❌ FAILED"
            print(f"{test_name.upper():<15} {status}")
            if result["error"]:
                print(f"                Error: {result['error']}")
        
        print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All backend API tests PASSED!")
            return True
        else:
            print("⚠️  Some backend API tests FAILED!")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)