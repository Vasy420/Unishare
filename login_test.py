#!/usr/bin/env python3
"""
Test the login endpoint with a registered user
"""

import requests
import time
from pathlib import Path

# Get backend URL
def get_backend_url():
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

BASE_URL = get_backend_url() + "/api"

def test_user_registration_and_login():
    """Test user registration and login flow"""
    print("🔐 Testing User Registration and Login Flow")
    
    try:
        # Step 1: Register a new user
        timestamp = int(time.time())
        user_data = {
            "username": f"TestUser_{timestamp}",
            "email": f"testuser_{timestamp}@example.com",
            "password": "SecurePassword123!"
        }
        
        print(f"\n1. Registering user: {user_data['email']}")
        register_response = requests.post(f"{BASE_URL}/auth/register", json=user_data, timeout=30)
        
        if register_response.status_code == 200:
            register_data = register_response.json()
            print(f"✅ Registration successful: {register_data['user']['username']}")
            
            # Step 2: Login with the registered user
            login_data = {
                "email": user_data['email'],
                "password": user_data['password']
            }
            
            print(f"\n2. Logging in with: {login_data['email']}")
            login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
            
            if login_response.status_code == 200:
                login_data_response = login_response.json()
                print(f"✅ Login successful: {login_data_response['user']['username']}")
                print(f"   Token: {login_data_response['access_token'][:20]}...")
                
                # Verify the user IDs match
                if register_data['user']['id'] == login_data_response['user']['id']:
                    print("✅ User ID matches between registration and login")
                    return True
                else:
                    print("❌ User ID mismatch between registration and login")
                    return False
            else:
                print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
                return False
        else:
            print(f"❌ Registration failed: {register_response.status_code} - {register_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_user_registration_and_login()
    exit(0 if success else 1)