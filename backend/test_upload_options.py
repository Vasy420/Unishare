import pytest
from httpx import AsyncClient
from server import app
import io

@pytest.mark.asyncio
async def test_upload_with_visibility_options():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Create a user
        register_response = await ac.post("/api/auth/register", json={
            "username": "testuser_upload",
            "email": "test_upload@example.com",
            "password": "password123"
        })
        assert register_response.status_code == 200
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Upload a PRIVATE file
        files = {'file': ('private.txt', io.BytesIO(b"private content"), 'text/plain')}
        data = {'is_public': 'false', 'shared_with': ''}
        response = await ac.post("/api/upload", files=files, data=data, headers=headers)
        assert response.status_code == 200
        file_data = response.json()
        assert file_data['is_public'] is False
        assert len(file_data['shared_with_users']) == 0

        # 3. Upload a SHARED file
        files = {'file': ('shared.txt', io.BytesIO(b"shared content"), 'text/plain')}
        data = {'is_public': 'false', 'shared_with': 'user1@example.com, user2@example.com'}
        response = await ac.post("/api/upload", files=files, data=data, headers=headers)
        assert response.status_code == 200
        file_data = response.json()
        assert file_data['is_public'] is False
        assert 'user1@example.com' in file_data['shared_with_users']
        assert 'user2@example.com' in file_data['shared_with_users']

        # 4. Upload a PUBLIC file
        files = {'file': ('public.txt', io.BytesIO(b"public content"), 'text/plain')}
        data = {'is_public': 'true'}
        response = await ac.post("/api/upload", files=files, data=data, headers=headers)
        assert response.status_code == 200
        file_data = response.json()
        assert file_data['is_public'] is True
