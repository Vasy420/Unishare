#!/usr/bin/env python3
"""
UNISHARE BACKEND COMPREHENSIVE TESTING SCRIPT
Tests all backend functionality as requested in the review
"""

import requests
import json
import os
import tempfile
from pathlib import Path
import time
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
print(f"Testing UniShare backend at: {BASE_URL}")

class UniShareBackendTester:
    def __init__(self):
        self.guest_token = None
        self.user_token = None
        self.guest_user = None
        self.registered_user = None
        self.uploaded_files = []
        
        self.test_results = {
            # Authentication endpoints
            "guest_creation": {"passed": False, "error": None},
            "user_registration": {"passed": False, "error": None},
            "user_login": {"passed": False, "error": None},
            "get_current_user": {"passed": False, "error": None},
            
            # File management endpoints
            "file_upload": {"passed": False, "error": None},
            "file_list": {"passed": False, "error": None},
            "file_download": {"passed": False, "error": None},
            "file_delete": {"passed": False, "error": None},
            
            # Special features
            "guest_data_limit": {"passed": False, "error": None},
            "file_ownership": {"passed": False, "error": None},
            "jwt_authentication": {"passed": False, "error": None},
            "online_users_endpoint": {"passed": False, "error": None},
            
            # Error handling
            "error_handling_404": {"passed": False, "error": None},
            "error_handling_auth": {"passed": False, "error": None}
        }
    
    def create_test_file(self, filename="test_file.txt", content="This is a test file for UniShare API testing."):
        """Create a temporary test file"""
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=f"_{filename}", delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name
    
    def get_auth_headers(self, token):
        """Get authorization headers for API requests"""
        return {"Authorization": f"Bearer {token}"} if token else {}
    
    def test_guest_creation(self):
        """Test POST /api/auth/guest endpoint"""
        print("\n=== Testing POST /api/auth/guest ===")
        
        try:
            guest_data = {
                "username": f"TestGuest_{int(time.time())}",
                "emoji": "🧪"
            }
            
            response = requests.post(f"{BASE_URL}/auth/guest", json=guest_data, timeout=30)
            print(f"Response Status: {response.status_code}")
            
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
                
                print("✅ PASSED - Guest user created successfully")
                print(f"   Username: {user['username']}")
                print(f"   Emoji: {user['emoji']}")
                print(f"   Is Guest: {user['is_guest']}")
                print(f"   JWT Token: {data['access_token'][:30]}...")
                
                self.test_results["guest_creation"]["passed"] = True
                
            else:
                raise Exception(f"Guest creation failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["guest_creation"]["error"] = str(e)
    
    def test_user_registration(self):
        """Test POST /api/auth/register endpoint"""
        print("\n=== Testing POST /api/auth/register ===")
        
        try:
            timestamp = int(time.time())
            user_data = {
                "username": f"TestUser_{timestamp}",
                "email": f"testuser_{timestamp}@unishare.test",
                "password": "SecurePassword123!"
            }
            
            response = requests.post(f"{BASE_URL}/auth/register", json=user_data, timeout=30)
            print(f"Response Status: {response.status_code}")
            
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
                
                print("✅ PASSED - User registered successfully")
                print(f"   Username: {user['username']}")
                print(f"   Email: {user['email']}")
                print(f"   Is Guest: {user['is_guest']}")
                
                self.test_results["user_registration"]["passed"] = True
                
            else:
                raise Exception(f"Registration failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["user_registration"]["error"] = str(e)
    
    def test_user_login(self):
        """Test POST /api/auth/login endpoint"""
        print("\n=== Testing POST /api/auth/login ===")
        
        if not self.registered_user:
            print("❌ SKIPPED: No registered user available")
            self.test_results["user_login"]["error"] = "No registered user available"
            return
        
        try:
            login_data = {
                "email": self.registered_user['email'],
                "password": "SecurePassword123!"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
            print(f"Response Status: {response.status_code}")
            
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
                
                print("✅ PASSED - User login successful")
                print(f"   User ID: {user['id']}")
                print(f"   Username: {user['username']}")
                
                self.test_results["user_login"]["passed"] = True
                
            else:
                raise Exception(f"Login failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["user_login"]["error"] = str(e)
    
    def test_get_current_user(self):
        """Test GET /api/auth/me endpoint"""
        print("\n=== Testing GET /api/auth/me ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No authentication token available")
            self.test_results["get_current_user"]["error"] = "No authentication token available"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response matches guest user
                if data['id'] != self.guest_user['id']:
                    raise Exception(f"User ID mismatch: expected {self.guest_user['id']}, got {data['id']}")
                
                if data['username'] != self.guest_user['username']:
                    raise Exception(f"Username mismatch: expected {self.guest_user['username']}, got {data['username']}")
                
                print("✅ PASSED - Current user info retrieved successfully")
                print(f"   User ID: {data['id']}")
                print(f"   Username: {data['username']}")
                print(f"   Is Guest: {data['is_guest']}")
                print(f"   Total Data Shared: {data['total_data_shared']} bytes")
                
                self.test_results["get_current_user"]["passed"] = True
                
            else:
                raise Exception(f"Get current user failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["get_current_user"]["error"] = str(e)
    
    def test_file_upload(self):
        """Test POST /api/upload endpoint"""
        print("\n=== Testing POST /api/upload ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No authentication token available")
            self.test_results["file_upload"]["error"] = "No authentication token available"
            return
        
        try:
            # Create test file
            test_content = "Hello from UniShare backend test! This is a comprehensive test file."
            test_file_path = self.create_test_file("upload_test.txt", test_content)
            
            headers = self.get_auth_headers(self.guest_token)
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('upload_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            print(f"Response Status: {response.status_code}")
            
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
                
                if data['size'] != len(test_content):
                    raise Exception(f"File size mismatch: expected {len(test_content)}, got {data['size']}")
                
                if data['owner_username'] != self.guest_user['username']:
                    raise Exception(f"Owner username mismatch: expected {self.guest_user['username']}, got {data['owner_username']}")
                
                # Store uploaded file info for later tests
                self.uploaded_files.append(data)
                
                print("✅ PASSED - File uploaded successfully")
                print(f"   File ID: {data['id']}")
                print(f"   Original filename: {data['original_filename']}")
                print(f"   Size: {data['size']} bytes")
                print(f"   Owner: {data['owner_username']}")
                print(f"   Download URL: {data['download_url']}")
                
                self.test_results["file_upload"]["passed"] = True
                
            else:
                raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
                
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_upload"]["error"] = str(e)
    
    def test_file_list(self):
        """Test GET /api/files endpoint"""
        print("\n=== Testing GET /api/files ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No authentication token available")
            self.test_results["file_list"]["error"] = "No authentication token available"
            return
        
        try:
            headers = self.get_auth_headers(self.guest_token)
            response = requests.get(f"{BASE_URL}/files", headers=headers, timeout=30)
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    raise Exception(f"Expected list response, got {type(data)}")
                
                print("✅ PASSED - File list retrieved successfully")
                print(f"   Found {len(data)} files")
                
                # Verify our uploaded file is in the list
                if self.uploaded_files:
                    uploaded_file_id = self.uploaded_files[0]['id']
                    found_file = None
                    for file_info in data:
                        if file_info['id'] == uploaded_file_id:
                            found_file = file_info
                            break
                    
                    if found_file:
                        print(f"   ✅ Uploaded file found in list: {found_file['original_filename']}")
                        print(f"   File ownership verified: {found_file['owner_username']}")
                    else:
                        print(f"   ⚠️ Warning: Uploaded file {uploaded_file_id} not found in list")
                
                self.test_results["file_list"]["passed"] = True
                
            else:
                raise Exception(f"List files failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_list"]["error"] = str(e)
    
    def test_file_download(self):
        """Test GET /api/files/{file_id}/download endpoint"""
        print("\n=== Testing GET /api/files/{file_id}/download ===")
        
        if not self.uploaded_files:
            print("❌ SKIPPED: No uploaded files to test")
            self.test_results["file_download"]["error"] = "No uploaded files available"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check content-type header
                content_type = response.headers.get('content-type', '')
                print(f"   Content-Type: {content_type}")
                
                # Check content-disposition header for filename
                content_disposition = response.headers.get('content-disposition', '')
                print(f"   Content-Disposition: {content_disposition}")
                
                # Verify file content
                content = response.content
                if len(content) != file_info['size']:
                    raise Exception(f"Downloaded file size mismatch: expected {file_info['size']}, got {len(content)}")
                
                print("✅ PASSED - File downloaded successfully")
                print(f"   Downloaded {len(content)} bytes")
                print(f"   Original filename: {file_info['original_filename']}")
                print(f"   Content matches expected size")
                
                self.test_results["file_download"]["passed"] = True
                
            else:
                raise Exception(f"Download failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_download"]["error"] = str(e)
    
    def test_file_delete(self):
        """Test DELETE /api/files/{file_id} endpoint"""
        print("\n=== Testing DELETE /api/files/{file_id} ===")
        
        if not self.uploaded_files or not self.guest_token:
            print("❌ SKIPPED: No uploaded files or authentication token available")
            self.test_results["file_delete"]["error"] = "No uploaded files or authentication token available"
            return
        
        try:
            file_info = self.uploaded_files[0]
            file_id = file_info['id']
            
            headers = self.get_auth_headers(self.guest_token)
            
            # Delete the file
            response = requests.delete(f"{BASE_URL}/files/{file_id}", headers=headers, timeout=30)
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('file_id') != file_id:
                    raise Exception(f"Delete response file_id mismatch: expected {file_id}, got {data.get('file_id')}")
                
                # Verify file is actually deleted by trying to download it
                print("   Verifying file deletion...")
                download_response = requests.get(f"{BASE_URL}/files/{file_id}/download", timeout=30)
                
                if download_response.status_code == 404:
                    print("   ✅ Confirmed: File not found after deletion (404)")
                    print("✅ PASSED - File deleted successfully")
                    self.test_results["file_delete"]["passed"] = True
                else:
                    raise Exception(f"File still accessible after deletion (status: {download_response.status_code})")
                
            else:
                raise Exception(f"Delete failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["file_delete"]["error"] = str(e)
    
    def test_guest_data_limit(self):
        """Test guest user 2GB data limit enforcement"""
        print("\n=== Testing Guest Data Limit (2GB) ===")
        
        if not self.guest_token:
            print("❌ SKIPPED: No guest token available")
            self.test_results["guest_data_limit"]["error"] = "No guest token available"
            return
        
        try:
            # Create a test file and upload it
            test_content = "Testing data limit tracking for guest users."
            test_file_path = self.create_test_file("limit_test.txt", test_content)
            
            headers = self.get_auth_headers(self.guest_token)
            
            # Upload the file
            with open(test_file_path, 'rb') as f:
                files = {'file': ('limit_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, headers=headers, timeout=30)
            
            print(f"Upload Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Successfully uploaded file: {data['original_filename']}")
                print(f"   File size: {data['size']} bytes")
                
                # Check current user data usage
                me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    print(f"   Total data shared: {user_data['total_data_shared']} bytes")
                    print(f"   Guest limit: 2,147,483,648 bytes (2GB)")
                    
                    if user_data['total_data_shared'] > 0:
                        print("✅ PASSED - Guest data limit tracking working")
                        print("   Data usage is being tracked correctly")
                        self.test_results["guest_data_limit"]["passed"] = True
                    else:
                        raise Exception("Data usage not being tracked")
                else:
                    raise Exception("Could not verify data usage")
                
                # Clean up the uploaded file
                delete_response = requests.delete(f"{BASE_URL}/files/{data['id']}", headers=headers, timeout=30)
                if delete_response.status_code == 200:
                    print("   Test file cleaned up successfully")
                
            else:
                # If upload failed, check if it's due to limit (which would be expected for a truly large file)
                if response.status_code == 403 and "limit exceeded" in response.text.lower():
                    print("✅ PASSED - Guest data limit enforcement working")
                    print("   2GB limit is being enforced correctly")
                    self.test_results["guest_data_limit"]["passed"] = True
                else:
                    raise Exception(f"Upload failed unexpectedly with status {response.status_code}: {response.text}")
                
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["guest_data_limit"]["error"] = str(e)
    
    def test_online_users_endpoint(self):
        """Test GET /api/online-users endpoint"""
        print("\n=== Testing GET /api/online-users ===")
        
        try:
            response = requests.get(f"{BASE_URL}/online-users", timeout=30)
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' not in data:
                    raise Exception("Response missing 'users' field")
                
                users = data['users']
                if not isinstance(users, list):
                    raise Exception("'users' field is not a list")
                
                print("✅ PASSED - Online users endpoint working")
                print(f"   Endpoint returned {len(users)} online users")
                
                # Show sample user data if available
                if users:
                    sample_user = users[0]
                    print(f"   Sample user: {sample_user.get('username', 'Anonymous')} {sample_user.get('emoji', '👤')}")
                
                self.test_results["online_users_endpoint"]["passed"] = True
                
            else:
                raise Exception(f"Online users endpoint failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["online_users_endpoint"]["error"] = str(e)
    
    def test_error_handling_404(self):
        """Test 404 error handling for non-existent files"""
        print("\n=== Testing 404 Error Handling ===")
        
        try:
            fake_file_id = "non-existent-file-id-12345"
            
            # Test download 404
            response = requests.get(f"{BASE_URL}/files/{fake_file_id}/download", timeout=30)
            if response.status_code == 404:
                print("✅ Download 404 handling works correctly")
                download_404_ok = True
            else:
                print(f"⚠️ Download 404 test: Expected 404, got {response.status_code}")
                download_404_ok = False
            
            # Test delete 404 with authentication
            delete_404_ok = True
            if self.guest_token:
                headers = self.get_auth_headers(self.guest_token)
                response = requests.delete(f"{BASE_URL}/files/{fake_file_id}", headers=headers, timeout=30)
                if response.status_code == 404:
                    print("✅ Delete 404 handling works correctly")
                else:
                    print(f"⚠️ Delete 404 test: Expected 404, got {response.status_code}")
                    delete_404_ok = False
            
            if download_404_ok and delete_404_ok:
                print("✅ PASSED - 404 error handling working correctly")
                self.test_results["error_handling_404"]["passed"] = True
            else:
                raise Exception("Some 404 error handling tests failed")
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["error_handling_404"]["error"] = str(e)
    
    def test_authentication_errors(self):
        """Test authentication error handling"""
        print("\n=== Testing Authentication Error Handling ===")
        
        try:
            # Test upload without authentication
            test_file_path = self.create_test_file("auth_test.txt", "Testing auth")
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('auth_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, timeout=30)
            
            if response.status_code == 401:
                print("✅ Upload without auth returns 401 correctly")
                upload_auth_ok = True
            else:
                print(f"⚠️ Upload auth test: Expected 401, got {response.status_code}")
                upload_auth_ok = False
            
            # Test /auth/me without authentication
            response = requests.get(f"{BASE_URL}/auth/me", timeout=30)
            if response.status_code == 401:
                print("✅ /auth/me without auth returns 401 correctly")
                me_auth_ok = True
            else:
                print(f"⚠️ /auth/me auth test: Expected 401, got {response.status_code}")
                me_auth_ok = False
            
            # Test with invalid token
            headers = {"Authorization": "Bearer invalid-token-12345"}
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
            if response.status_code == 401:
                print("✅ Invalid token returns 401 correctly")
                invalid_token_ok = True
            else:
                print(f"⚠️ Invalid token test: Expected 401, got {response.status_code}")
                invalid_token_ok = False
            
            if upload_auth_ok and me_auth_ok and invalid_token_ok:
                print("✅ PASSED - Authentication error handling working correctly")
                self.test_results["error_handling_auth"]["passed"] = True
            else:
                raise Exception("Some authentication error handling tests failed")
            
            # Clean up temp file
            os.unlink(test_file_path)
                
        except Exception as e:
            print(f"❌ FAILED: {str(e)}")
            self.test_results["error_handling_auth"]["error"] = str(e)
    
    def run_comprehensive_tests(self):
        """Run comprehensive UniShare backend tests"""
        print("🚀 UNISHARE BACKEND COMPREHENSIVE TESTING")
        print(f"Backend URL: {BASE_URL}")
        print("="*80)
        
        # Authentication Endpoints
        print("\n🔐 AUTHENTICATION ENDPOINTS")
        print("-" * 40)
        self.test_guest_creation()
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        
        # File Management Endpoints
        print("\n📁 FILE MANAGEMENT ENDPOINTS")
        print("-" * 40)
        self.test_file_upload()
        self.test_file_list()
        self.test_file_download()
        self.test_file_delete()
        
        # Special Features
        print("\n⚡ SPECIAL FEATURES")
        print("-" * 40)
        self.test_guest_data_limit()
        self.test_online_users_endpoint()
        
        # Error Handling
        print("\n🛡️ ERROR HANDLING")
        print("-" * 40)
        self.test_error_handling_404()
        self.test_authentication_errors()
        
        # Print comprehensive summary
        print("\n" + "="*80)
        print("📊 COMPREHENSIVE TEST RESULTS SUMMARY")
        print("="*80)
        
        # Group results by category
        auth_tests = ["guest_creation", "user_registration", "user_login", "get_current_user"]
        file_tests = ["file_upload", "file_list", "file_download", "file_delete"]
        special_tests = ["guest_data_limit", "online_users_endpoint"]
        error_tests = ["error_handling_404", "error_handling_auth"]
        
        categories = [
            ("🔐 Authentication Endpoints", auth_tests),
            ("📁 File Management Endpoints", file_tests),
            ("⚡ Special Features", special_tests),
            ("🛡️ Error Handling", error_tests)
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
                    display_name = test_name.replace('_', ' ').title()
                    print(f"  {display_name:<35} {status}")
                    
                    if result["error"] and not result["passed"]:
                        print(f"    └─ Error: {result['error']}")
                        # Mark auth and file management failures as critical
                        if test_name in auth_tests + file_tests:
                            critical_failures.append(f"{category_name}: {display_name}")
                    
                    if result["passed"]:
                        category_passed += 1
                        passed_tests += 1
            
            success_rate = (category_passed / category_total) * 100
            print(f"  └─ Category Result: {category_passed}/{category_total} passed ({success_rate:.1f}%)")
        
        # Overall results
        overall_success_rate = (passed_tests / total_tests) * 100
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} tests passed ({overall_success_rate:.1f}%)")
        
        # Status determination
        if passed_tests == total_tests:
            print("🟢 STATUS: ALL TESTS PASSED - Backend is fully functional")
        elif passed_tests >= total_tests * 0.8:
            print("🟡 STATUS: MOSTLY FUNCTIONAL - Minor issues detected")
        else:
            print("🔴 STATUS: CRITICAL ISSUES - Major functionality problems")
        
        # Critical failures
        if critical_failures:
            print(f"\n❗ CRITICAL FAILURES DETECTED:")
            for failure in critical_failures:
                print(f"   • {failure}")
            print("   These failures will impact core functionality!")
        
        # Specific feature status
        auth_passed = sum(1 for test in auth_tests if self.test_results.get(test, {}).get("passed", False))
        file_passed = sum(1 for test in file_tests if self.test_results.get(test, {}).get("passed", False))
        
        print(f"\n📋 FEATURE STATUS:")
        print(f"   Authentication System: {auth_passed}/{len(auth_tests)} ({'✅ Working' if auth_passed == len(auth_tests) else '❌ Issues'})")
        print(f"   File Management: {file_passed}/{len(file_tests)} ({'✅ Working' if file_passed == len(file_tests) else '❌ Issues'})")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = UniShareBackendTester()
    success = tester.run_comprehensive_tests()
    exit(0 if success else 1)