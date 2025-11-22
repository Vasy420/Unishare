# UniShare - Complete Setup Instructions

## Overview
UniShare is a modern, minimalistic file sharing application with P2P capabilities, Google Drive integration, and a clean, fast UI.

## Features

### User Management
- **Guest Mode**: Quick access with username and emoji avatar selection
- **Optional Login**: Create account to access files from anywhere
- **2GB Limit for Guests**: Guests can share up to 2GB, unlimited for logged-in users

### File Sharing Methods
1. **Upload & Share**: Traditional file upload with progress tracking
2. **WebRTC P2P**: Direct peer-to-peer file transfer using DataChannels
3. **Google Drive**: Share files directly from your Google Drive

### UI/UX
- **Minimalistic Design**: Clean, modern interface
- **Dark/Light Mode**: Toggle between themes
- **Responsive**: Works perfectly on mobile, tablet, and desktop
- **Progress Indicators**: Real-time upload/download speed and time remaining
- **File History**: Guests get local history, users get cloud history

## Architecture

### Backend (FastAPI)
- **Authentication**: JWT-based auth with bcrypt password hashing
- **File Management**: Upload, download, delete with size tracking
- **WebSocket Signaling**: Real-time signaling for WebRTC connections
- **Google Drive API**: OAuth2 integration for Drive file access
- **Data Limits**: Automatic tracking of 2GB guest limit

### Frontend (React)
- **Context API**: Theme and Authentication contexts
- **WebRTC Manager**: Custom manager for P2P file transfers
- **Tailwind CSS**: Utility-first styling with dark mode support
- **Axios**: HTTP client with upload/download progress tracking

### Database (MongoDB)
Collections:
- `users`: User accounts (guest and registered)
- `files`: File metadata and ownership
- `drive_credentials`: Google OAuth tokens

## Environment Variables

### Backend (.env)
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
SECRET_KEY="your-super-secret-jwt-key-change-in-production"

# Google Drive OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_DRIVE_REDIRECT_URI="https://unifiles-share.preview.emergentagent.com/api/drive/callback"
FRONTEND_URL="https://unifiles-share.preview.emergentagent.com"
```

### Frontend (.env)
```bash
REACT_APP_BACKEND_URL="https://unifiles-share.preview.emergentagent.com"
```

## Google Drive Integration Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Create a Project** (if you don't have one)
3. **Enable Google Drive API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" → Create
   - Fill in App name, User support email, Developer email
   - Under Scopes, add: `https://www.googleapis.com/auth/drive.readonly`
   - Add test users (your email)
   - Save and Continue

5. **Create OAuth Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized JavaScript origins: `https://unifiles-share.preview.emergentagent.com`
   - Authorized redirect URIs: `https://unifiles-share.preview.emergentagent.com/api/drive/callback`
   - Copy Client ID and Client Secret

6. **Update Backend .env**:
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Set `GOOGLE_DRIVE_REDIRECT_URI` to match your callback URL
   - Set `FRONTEND_URL` to your app URL

7. **Restart Backend**:
   ```bash
   sudo supervisorctl restart backend
   ```

## User Flow

### First Visit (Guest)
1. User arrives at the app
2. Modal appears asking for username and emoji selection
3. User chooses identity and continues as guest
4. Can immediately upload and share files (up to 2GB total)

### Sharing Files
1. **Upload Method**:
   - Drag & drop or click to select file
   - Watch real-time progress with speed and time remaining
   - File appears in "My Files" section

2. **P2P Method**:
   - Click "Share" on any file
   - Go to "P2P Share" tab
   - Select online user from list
   - File transfers directly between browsers

3. **Google Drive Method** (if connected):
   - Click "Browse Drive" in header
   - Select file from your Drive
   - File becomes shareable via UniShare

### Upgrading to Account
1. Click "Login to access everywhere" or "Upgrade Now" when limit warning appears
2. Enter email and password to create account
3. All previous files remain accessible
4. No more 2GB limit
5. Files accessible from any device

## WebRTC P2P Implementation

### How It Works
1. **WebSocket Signaling**: Backend manages WebSocket connections for signaling
2. **Offer/Answer Exchange**: Peers exchange SDP offers and answers
3. **ICE Candidates**: STUN servers help with NAT traversal
4. **DataChannels**: Files are sent in 16KB chunks via RTC DataChannels
5. **Progress Tracking**: Both sender and receiver see real-time progress

### Benefits
- **No Server Storage**: Files transfer directly between users
- **Fast Transfer**: No upload/download to server, direct P2P
- **Privacy**: Files never stored on server
- **Works on LAN**: Even works offline on same network

## Development

### Running Locally
```bash
# Backend
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Frontend
cd /app/frontend
yarn install
yarn start
```

### Using Supervisor (Production)
```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart all
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# View logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

## File Structure

```
/app/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables
│   └── uploads/               # Uploaded files storage
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main application component
│   │   ├── contexts/
│   │   │   ├── ThemeContext.jsx      # Dark/light mode
│   │   │   └── AuthContext.jsx       # Authentication
│   │   ├── components/
│   │   │   ├── GuestModal.jsx        # Guest username selection
│   │   │   ├── AuthModal.jsx         # Login/Register
│   │   │   ├── UploadZone.jsx        # Drag & drop upload
│   │   │   ├── FileCard.jsx          # File display card
│   │   │   ├── ProgressIndicator.jsx # Upload/download progress
│   │   │   ├── ShareModal2.jsx       # Share options modal
│   │   │   └── GoogleDrivePicker.jsx # Google Drive file picker
│   │   └── utils/
│   │       └── webrtcManager2.js     # WebRTC P2P manager
│   ├── package.json          # Node dependencies
│   └── .env                  # Frontend environment variables
└── test_result.md            # Testing documentation

```

## Testing

### Backend Testing
```bash
# Test authentication
curl -X POST http://localhost:8001/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser", "emoji": "😀"}'

# Test file upload (with token)
curl -X POST http://localhost:8001/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt"

# Test WebSocket connection
# Use browser console or WebSocket testing tool
# ws://localhost:8001/ws/USER_ID
```

### Frontend Testing
1. Open browser to `http://localhost:3000`
2. Test guest login with different emojis
3. Upload files and verify progress indicators
4. Test dark/light mode toggle
5. Open in two browser tabs to test P2P file sharing
6. Test Google Drive integration (if configured)

## Troubleshooting

### Backend Issues
- **MongoDB not connecting**: Check MONGO_URL in .env
- **JWT errors**: Ensure SECRET_KEY is set in .env
- **Google Drive fails**: Verify OAuth credentials and redirect URI

### Frontend Issues
- **Can't connect to backend**: Check REACT_APP_BACKEND_URL in .env
- **WebRTC not working**: Check browser console for WebSocket errors
- **Dark mode not working**: Clear localStorage and refresh

### WebSocket Issues
- **Connection refused**: Ensure backend is running on correct port
- **Can't see online users**: Check WebSocket connection in browser DevTools
- **P2P transfer fails**: Ensure both users are connected and on same network or STUN servers are accessible

## Performance Optimization

### Backend
- File upload streaming with FastAPI
- Async MongoDB operations with Motor
- WebSocket connection pooling
- JWT token caching

### Frontend
- React.useMemo for expensive computations
- Lazy loading for large file lists
- Optimized re-renders with useCallback
- Efficient WebRTC chunk size (16KB)

### WebRTC
- Chunked file transfer (16KB chunks)
- Progress throttling to prevent UI lag
- Connection reuse for multiple transfers
- Automatic reconnection on disconnect

## Security Considerations

### Authentication
- Bcrypt password hashing with salt
- JWT tokens with expiration
- HTTP-only cookies recommended for production
- Token refresh mechanism

### File Security
- Size limit enforcement (2GB for guests)
- File type validation
- Sanitized filenames
- User ownership verification

### WebRTC Security
- Signaling server authentication
- STUN/TURN server configuration
- DataChannel encryption (built-in)
- Peer verification before file transfer

## Future Enhancements

- [ ] File encryption at rest
- [ ] File sharing expiration dates
- [ ] Folder support
- [ ] Batch file uploads
- [ ] Advanced search and filters
- [ ] File preview (images, PDFs)
- [ ] Share analytics and tracking
- [ ] Integration with more cloud providers (Dropbox, OneDrive)
- [ ] Mobile app (React Native)
- [ ] Email notifications for shared files

## License & Credits

This project uses:
- FastAPI (backend framework)
- React (frontend framework)
- MongoDB (database)
- WebRTC (peer-to-peer communication)
- Google Drive API (cloud storage integration)
- Tailwind CSS (styling)
- Simple-peer (WebRTC wrapper)

---

**Note**: This is a development/demo application. For production use, implement additional security measures, rate limiting, file scanning, and proper error handling.
