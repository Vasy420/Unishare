# UniShare - Fast & Secure File Sharing

UniShare is a modern file sharing application with multiple sharing options including direct uploads, WebRTC P2P transfers, Bluetooth sharing, and optional Google Drive integration.

## Features

- **Guest & Registered Users**: Quick guest access or create an account for unlimited storage
- **Multiple Sharing Methods**:
  - Direct file upload/download
  - WebRTC P2P transfers (LAN & offline)
  - Bluetooth sharing
  - QR code sharing
  - Social media sharing
  - Google Drive integration (optional)
- **File Permissions**: Public/private files with user-specific sharing
- **Progress Tracking**: Real-time upload/download progress with speed and time estimates
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Mode**: Beautiful light and dark themes

## Environment Setup

### Backend (.env)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
SECRET_KEY="your-secret-key-here"
FRONTEND_URL="https://your-frontend-url.com"

# Optional: Google Drive Integration
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_DRIVE_REDIRECT_URI=""
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
```

## Google Drive Integration (Optional)

Google Drive integration is **disabled by default** and requires manual configuration. To enable:

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Google Drive API

2. **Configure OAuth Credentials**:
   - Go to "Credentials" section
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://your-backend-url.com/api/drive/callback`

3. **Update Backend .env**:
   ```
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_DRIVE_REDIRECT_URI="https://your-backend-url.com/api/drive/callback"
   ```

4. **Enable in Frontend**:
   - In `App.js`, change: `const [driveConfigured, setDriveConfigured] = useState(false);` to `true`
   - The "Connect Drive" button will appear in the header

**Note**: The app works perfectly without Google Drive integration. All core features (upload, download, sharing, P2P, Bluetooth) are available regardless of Google Drive configuration.

## Running the Application

### Start Services
```bash
sudo supervisorctl start all
```

### Check Status
```bash
sudo supervisorctl status
```

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.*.log

# Frontend logs
tail -f /var/log/supervisor/frontend.*.log
```

## User Data Limits

- **Guest Users**: 2GB total data limit
- **Registered Users**: Unlimited storage

## Technologies Used

- **Backend**: FastAPI, MongoDB, WebSockets
- **Frontend**: React, Tailwind CSS, Axios
- **Real-time**: WebRTC, Web Bluetooth API
- **Authentication**: JWT tokens
- **File Storage**: Local disk + MongoDB metadata

## Support

For issues or questions, please check the logs or contact support.
