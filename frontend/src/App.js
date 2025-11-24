import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Moon, Sun, LogOut, User, Upload as UploadIcon, HardDrive, History, LogIn } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import GuestModal from './components/GuestModal';
import AuthModal from './components/AuthModal';
import LoginPage from './components/LoginPage';
import UploadZone from './components/UploadZone';
import FileCard from './components/FileCard';
import ProgressIndicator from './components/ProgressIndicator';
import ShareModal2 from './components/ShareModal2';
import GoogleDrivePicker from './components/GoogleDrivePicker';
import WelcomeScreen from './components/WelcomeScreen';
import GoogleDriveConnectModal from './components/GoogleDriveConnectModal';
import webrtcManager from './utils/webrtcManager2';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Guest data limit (2GB in bytes)
const GUEST_DATA_LIMIT = 2 * 1024 * 1024 * 1024;

// File history in localStorage
const HISTORY_KEY = 'unishare_file_history';

const getFileHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
};

const addToFileHistory = (file) => {
  try {
    const history = getFileHistory();
    history.unshift({
      ...file,
      timestamp: new Date().toISOString()
    });
    // Keep only last 50 files
    const trimmed = history.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save to history:', error);
  }
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, token, loading: authLoading, loginAsGuest, register, login, logout, setToken, setUser } = useAuth();

  const [files, setFiles] = useState([]);
  const [fileHistory, setFileHistory] = useState([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [dataLimitReached, setDataLimitReached] = useState(false);
  const [driveConfigured, setDriveConfigured] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDriveConnectModal, setShowDriveConnectModal] = useState(false);

  // Check if it's first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem('unishare_has_visited');
    if (!hasVisited) {
      setShowWelcome(true);
    }
  }, []);

  // Handle Google OAuth callback and Google Drive connection callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleAuth = urlParams.get('google_auth');
    const tokenParam = urlParams.get('token');
    const googleDrivePrompt = urlParams.get('google_drive_prompt');
    const driveConnected = urlParams.get('drive_connected');
    const driveError = urlParams.get('drive_error');

    // Handle Google OAuth callback
    if (googleAuth === 'success' && tokenParam) {
      // Save token and fetch user info
      localStorage.setItem('token', tokenParam);
      setToken(tokenParam);

      // Fetch user info
      axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenParam}` }
      }).then(response => {
        setUser(response.data);
        setShowLoginPage(false); // Close login page

        // Show Google Drive connection prompt if needed
        if (googleDrivePrompt === 'true' && !response.data.google_drive_connected) {
          setShowDriveConnectModal(true);
        }
      }).catch(error => {
        console.error('Failed to fetch user info:', error);
        setShowLoginPage(false);
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleAuth === 'error') {
      alert('Google authentication failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Handle Google Drive connection callback
    if (driveConnected === 'true') {
      // Refresh user data to get updated google_drive_connected status
      if (token) {
        axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(response => {
          setUser(response.data);
          alert('Google Drive connected successfully!');
        }).catch(error => {
          console.error('Failed to refresh user info:', error);
        });
      }

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (driveError === 'true') {
      alert('Failed to connect Google Drive. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setToken, setUser, token]);

  // Check auth and ask for guest username when needed
  useEffect(() => {
    if (!authLoading && !user && !showWelcome) {
      // No user logged in, show login page
      setShowLoginPage(true);
    }
  }, [authLoading, user, showWelcome]);

  // Fetch files when user is available
  useEffect(() => {
    if (user) {
      fetchFiles();
      loadFileHistory();
      // Connect to WebRTC
      webrtcManager.connect(user.id, BACKEND_URL, user.username, user.emoji);
      webrtcManager.updateUserInfo(user.username, user.emoji);

      // Handle received files via P2P
      webrtcManager.onFileReceived = (filename, blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert(`Received file via P2P: ${filename}`);
      };
    }

    return () => {
      if (user) {
        webrtcManager.disconnect();
      }
    };
  }, [user]);

  const loadFileHistory = () => {
    if (user && user.is_guest) {
      setFileHistory(getFileHistory());
    }
  };

  const fetchFiles = async () => {
    if (!user || !token) return;

    try {
      const response = await axios.get(`${API}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  const handleGuestLogin = async (username, emoji) => {
    const result = await loginAsGuest(username, emoji);
    if (result.success) {
      setShowGuestModal(false);
    } else {
      alert(result.error);
    }
  };

  const handleAuth = async (emailOrUsername, passwordOrEmail, passwordOrMode, mode) => {
    let result;
    if (mode === 'register') {
      result = await register(emailOrUsername, passwordOrEmail, passwordOrMode);
    } else {
      result = await login(emailOrUsername, passwordOrEmail);
    }

    if (result.success) {
      setShowAuthModal(false);
    } else {
      throw new Error(result.error);
    }
  };

  const handleFileUpload = async (file) => {
    if (!user || !token) {
      alert('Please log in to upload files');
      return;
    }

    setUploading(true);
    setUploadProgress({ progress: 0, speed: 0, timeRemaining: 0, fileName: file.name });

    const formData = new FormData();
    formData.append('file', file);

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    try {
      await axios.post(`${API}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const currentTime = Date.now();
          const timeElapsed = (currentTime - lastTime) / 1000;
          const loaded = progressEvent.loaded;
          const total = progressEvent.total;
          const percentage = Math.round((loaded * 100) / total);

          const bytesUploaded = loaded - lastLoaded;
          const speed = timeElapsed > 0 ? bytesUploaded / timeElapsed : 0;

          const bytesRemaining = total - loaded;
          const timeRemaining = speed > 0 ? bytesRemaining / speed : 0;

          setUploadProgress({
            progress: percentage,
            speed: speed,
            timeRemaining: timeRemaining,
            fileName: file.name
          });

          lastLoaded = loaded;
          lastTime = currentTime;
        }
      });

      await fetchFiles();

      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);

      setDataLimitReached(false);
    } catch (error) {
      console.error('Upload failed:', error);
      if (error.response?.status === 403) {
        setDataLimitReached(true);
        alert(error.response?.data?.detail || 'Data limit reached. Please create an account.');
      } else {
        alert('Failed to upload file');
      }
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    console.log('[App] handleDownload called with file:', file);
    try {
      setDownloadProgress({ progress: 0, speed: 0, timeRemaining: 0, fileName: file.original_filename });

      const downloadUrl = `${BACKEND_URL}${file.download_url}`;

      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const currentTime = Date.now();
          const timeElapsed = (currentTime - lastTime) / 1000;
          const loaded = progressEvent.loaded;
          const total = progressEvent.total || progressEvent.loaded;
          const percentage = total > 0 ? Math.round((loaded * 100) / total) : 100;

          const bytesDownloaded = loaded - lastLoaded;
          const speed = timeElapsed > 0 ? bytesDownloaded / timeElapsed : 0;

          const bytesRemaining = total - loaded;
          const timeRemaining = speed > 0 ? bytesRemaining / speed : 0;

          setDownloadProgress({
            progress: percentage,
            speed: speed,
            timeRemaining: timeRemaining,
            fileName: file.original_filename
          });

          lastLoaded = loaded;
          lastTime = currentTime;
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.original_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Add to history for guests
      if (user?.is_guest) {
        addToFileHistory(file);
        loadFileHistory();
      }

      setTimeout(() => {
        setDownloadProgress(null);
      }, 2000);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file');
      setDownloadProgress(null);
    }
  };

  const handleDelete = async (file) => {
    console.log('[App] handleDelete called with file:', file);
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await axios.delete(`${API}/files/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchFiles();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const handleShare = (file) => {
    console.log('[App] handleShare called with file:', file);
    console.log('[App] Setting selectedFile and showShareModal to true');
    setSelectedFile(file);
    setShowShareModal(true);
  };

  const handleConnectDrive = async () => {
    try {
      const response = await axios.get(`${API}/drive/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Failed to connect Drive:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to connect Google Drive';

      // If Google Drive is not configured, hide the button
      if (errorMsg.includes('not configured')) {
        setDriveConfigured(false);
        alert('Google Drive integration is not configured on this server. Please contact the administrator or use regular file upload.');
      } else {
        alert(errorMsg);
      }
    }
  };

  const handleWelcomeGetStarted = () => {
    localStorage.setItem('unishare_has_visited', 'true');
    setShowWelcome(false);
  };

  const handleDriveConnectNow = async () => {
    setShowDriveConnectModal(false);
    await handleConnectDrive();
  };

  const handleDriveConnectSkip = () => {
    setShowDriveConnectModal(false);
  };

  const handleSaveToDrive = async (file) => {
    if (!user || !token) {
      alert('Please log in to save to Drive');
      return;
    }

    if (!user.google_drive_connected) {
      alert('Please connect your Google Drive first');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/drive/save/${file.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`File saved to Google Drive! ${response.data.drive_link}`);
      }
    } catch (error) {
      console.error('Failed to save to Drive:', error);
      alert(error.response?.data?.detail || 'Failed to save file to Google Drive');
    }
  };

  const handleLogout = () => {
    logout();
    setFiles([]);
    setFileHistory([]);
    webrtcManager.disconnect();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show welcome screen on first visit
  if (showWelcome) {
    return <WelcomeScreen onGetStarted={handleWelcomeGetStarted} />;
  }

  // Show login page when no user
  if (showLoginPage && !user) {
    return (
      <LoginPage
        onSuccess={handleAuth}
        onGuestMode={() => {
          setShowLoginPage(false);
          setShowGuestModal(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-300 dark:bg-blue-800 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-slate-300 dark:bg-slate-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-300 dark:bg-indigo-800 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl animate-blob animation-delay-4000"></div>
      </div>
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl">
                <UploadIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">UniShare</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fast & Secure File Sharing</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {user && (
                <>
                  {user.is_guest && (
                    <>
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="File History"
                      >
                        <History className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowLoginPage(true)}
                        className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
                        title="Login to Access Everywhere"
                      >
                        <LogIn className="w-4 h-4" />
                        <span className="text-sm font-medium">Login</span>
                      </button>
                    </>
                  )}

                  {driveConfigured && !user.google_drive_connected ? (
                    <button
                      onClick={handleConnectDrive}
                      className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm">Connect Drive</span>
                    </button>
                  ) : driveConfigured && user.google_drive_connected ? (
                    <button
                      onClick={() => setShowDrivePicker(true)}
                      className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm">Browse Drive</span>
                    </button>
                  ) : null}

                  <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <span className="text-xl">{user.emoji}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.username}
                    </span>
                    {user.is_guest && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                        Guest
                      </span>
                    )}
                  </div>
                </>
              )}

              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {user && (
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {user && (
          <>
            {/* Data Limit Warning */}
            {user.is_guest && user.total_data_shared > GUEST_DATA_LIMIT * 0.8 && (
              <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      You've used {((user.total_data_shared / GUEST_DATA_LIMIT) * 100).toFixed(0)}% of your 2GB guest limit
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      Create an account to get unlimited storage!
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            )}

            {/* Upload Zone */}
            <div className="mb-8">
              <UploadZone
                onFileSelect={handleFileUpload}
                uploading={uploading}
                disabled={dataLimitReached}
              />
              {dataLimitReached && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    2GB limit reached for guests
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Create Account for Unlimited Storage
                  </button>
                </div>
              )}
            </div>

            {/* File History for Guests */}
            {user.is_guest && showHistory && fileHistory.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Files (Stored Locally)
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {fileHistory.slice(0, 6).map((file, idx) => (
                    <FileCard
                      key={`history-${idx}`}
                      file={file}
                      onDownload={handleDownload}
                      onDelete={() => { }}
                      onShare={handleShare}
                      onSaveToDrive={handleSaveToDrive}
                      user={user}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Files Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user.is_guest ? 'Your Shared Files' : 'My Files'}
                </h2>
                {user.is_guest && (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Login to access everywhere
                  </button>
                )}
              </div>

              {files.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <UploadIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No files yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Upload your first file to get started
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                      onShare={handleShare}
                      onSaveToDrive={handleSaveToDrive}
                      user={user}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Progress Indicators */}
      {uploadProgress && (
        <ProgressIndicator
          type="upload"
          fileName={uploadProgress.fileName}
          progress={uploadProgress.progress}
          speed={uploadProgress.speed}
          timeRemaining={uploadProgress.timeRemaining}
        />
      )}

      {downloadProgress && (
        <ProgressIndicator
          type="download"
          fileName={downloadProgress.fileName}
          progress={downloadProgress.progress}
          speed={downloadProgress.speed}
          timeRemaining={downloadProgress.timeRemaining}
        />
      )}

      {/* Modals */}
      <GuestModal
        isOpen={showGuestModal && !user}
        onClose={() => { }}
        onSubmit={handleGuestLogin}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuth}
      />

      {selectedFile && (
        <ShareModal2
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          file={selectedFile}
          backendUrl={BACKEND_URL}
        />
      )}

      {user && driveConfigured && user.google_drive_connected && (
        <GoogleDrivePicker
          isOpen={showDrivePicker}
          onClose={() => setShowDrivePicker(false)}
          onFileShared={(file) => {
            setShowDrivePicker(false);
            fetchFiles();
          }}
          token={token}
        />
      )}

      {/* Google Drive Connect Modal */}
      <GoogleDriveConnectModal
        isOpen={showDriveConnectModal}
        onConnect={handleDriveConnectNow}
        onSkip={handleDriveConnectSkip}
      />
    </div>
  );
}

export default App;
