#!/usr/bin/env python3
"""
Backend API Testing Script for File Sharing Application
Tests all backend endpoints: upload, list, download, delete
"""

import requests
import json
import os
import tempfile
from pathlib import Path
import time

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
print(f"Testing backend at: {BASE_URL}")

class BackendTester:
    def __init__(self):
        self.uploaded_files = []
        self.test_results = {
            "upload": {"passed": False, "error": None},
            "list_files": {"passed": False, "error": None},
            "download": {"passed": False, "error": None},
            "delete": {"passed": False, "error": None}
        }
    
    def create_test_file(self, filename="test_file.txt", content="This is a test file for backend API testing."):
        """Create a temporary test file"""
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=f"_{filename}", delete=False)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name
    
    def test_upload_api(self):
        """Test POST /api/upload endpoint"""
        print("\n=== Testing File Upload API ===")
        
        try:
            # Create test file
            test_file_path = self.create_test_file("upload_test.txt", "Hello from backend test!")
            
            with open(test_file_path, 'rb') as f:
                files = {'file': ('upload_test.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/upload", files=files, timeout=30)
            
            print(f"Upload Response Status: {response.status_code}")
            print(f"Upload Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['id', 'filename', 'original_filename', 'size', 'upload_date', 'download_url', 'share_url']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    raise Exception(f"Missing fields in response: {missing_fields}")
                
                # Verify file metadata
                if data['original_filename'] != 'upload_test.txt':
                    raise Exception(f"Original filename mismatch: expected 'upload_test.txt', got '{data['original_filename']}'")
                
                if data['size'] <= 0:
                    raise Exception(f"Invalid file size: {data['size']}")
                
                # Store uploaded file info for later tests
                self.uploaded_files.append(data)
                
                print("✅ Upload API test PASSED")
                print(f"   - File ID: {data['id']}")
                print(f"   - Original filename: {data['original_filename']}")
                print(f"   - Size: {data['size']} bytes")
                print(f"   - Download URL: {data['download_url']}")
                
                self.test_results["upload"]["passed"] = True
                
            else:
                raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
                
            # Clean up temp file
            os.unlink(test_file_path)
            
        except Exception as e:
            print(f"❌ Upload API test FAILED: {str(e)}")
            self.test_results["upload"]["error"] = str(e)
    
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