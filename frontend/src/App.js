import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Upload, Download, Trash2, Share2, File, User, LogOut } from "lucide-react";
import EnhancedShareModal from "@/components/EnhancedShareModal";
import ProgressBar from "@/components/ProgressBar";
import UsernameModal from "@/components/UsernameModal";
import webrtcManager from "@/utils/webrtcManager";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  
  // User state
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Progress tracking state
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);

  useEffect(() => {
    // Check for existing user in localStorage
    const savedUser = localStorage.getItem('fileShareUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      connectWebRTC(user.id);
    } else {
      setShowUsernameModal(true);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchFiles();
      fetchUsers();
    }
  }, [currentUser]);

  const connectWebRTC = (userId) => {
    try {
      webrtcManager.connect(userId, BACKEND_URL);
      webrtcManager.onFileReceived = (filename, blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert(`Received file: ${filename}`);
      };
    } catch (error) {
      console.error('WebRTC connection error:', error);
    }
  };

  const handleUsernameSubmit = async (username) => {
    try {
      const response = await axios.post(`${API}/users?username=${username}`);
      const user = response.data;
      setCurrentUser(user);
      localStorage.setItem('fileShareUser', JSON.stringify(user));
      setShowUsernameModal(false);
      connectWebRTC(user.id);
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fileShareUser');
    webrtcManager.disconnect();
    setCurrentUser(null);
    setShowUsernameModal(true);
  };

  // Fetch all files
  const fetchFiles = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const response = await axios.get(`${API}/files?user_id=${currentUser.id}`);
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  }, [currentUser]);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setAllUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Handle file upload with progress tracking
  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    try {
      await axios.post(
        `${API}/upload?owner_id=${currentUser.id}&owner_username=${currentUser.username}&is_public=true`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
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
              fileName: file.name,
            });
            
            lastLoaded = loaded;
            lastTime = currentTime;
          },
        }
      );
      await fetchFiles();
      
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  // Handle file delete
  const handleDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      await axios.delete(`${API}/files/${fileId}`);
      await fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file");
    }
  };

  // Handle file download with progress tracking
  const handleDownload = async (fileId, filename) => {
    try {
      const downloadUrl = `${API}/files/${fileId}/download`;
      
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
            fileName: filename,
          });
          
          lastLoaded = loaded;
          lastTime = currentTime;
        },
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setTimeout(() => {
        setDownloadProgress(null);
      }, 2000);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file");
      setDownloadProgress(null);
    }
  };

  // Open share modal
  const handleShare = (file) => {
    setSelectedFile(file);
    setShareModalOpen(true);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Format file size
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  }, []);

  // Format date
  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }, []);

  const memoizedFiles = useMemo(() => files, [files]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl relative z-10">
        {/* Header with glassmorphism */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-block px-8 py-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-4">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2" data-testid="app-title">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                File Share Pro
              </span>
            </h1>
            <p className="text-gray-300 text-sm md:text-base">Share files instantly with advanced methods</p>
          </div>

          {/* User info bar with neumorphism */}
          {currentUser && (
            <div className="inline-flex items-center space-x-4 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-800/80 to-purple-800/80 backdrop-blur-md border border-white/10 shadow-xl">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-medium text-sm md:text-base">{currentUser.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all duration-200 text-sm flex items-center space-x-1 border border-red-500/30"
              >
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Upload Area with enhanced glassmorphism */}
        <div
          className={`mb-6 md:mb-8 border-2 border-dashed rounded-2xl p-6 md:p-12 text-center transition-all duration-300 backdrop-blur-xl shadow-2xl ${
            dragActive
              ? "border-purple-400 bg-purple-500/20 scale-[1.02]"
              : "border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-white/10"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="upload-area"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
            <Upload className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
            {uploading ? "Uploading..." : "Drop your file here"}
          </h3>
          <p className="text-gray-300 mb-3 md:mb-4 text-sm md:text-base">or</p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            data-testid="file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105 text-sm md:text-base"
            data-testid="browse-button"
            style={{
              boxShadow: '0 10px 40px -10px rgba(168, 85, 247, 0.4), inset 0 -2px 10px rgba(0, 0, 0, 0.2)'
            }}
          >
            {uploading ? "Uploading..." : "Browse Files"}
          </button>
        </div>

        {/* Files List with enhanced glassmorphism */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/10 shadow-2xl">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6" data-testid="files-header">
            My Files ({memoizedFiles.length})
          </h2>
          
          {memoizedFiles.length === 0 ? (
            <div className="text-center py-12 md:py-16" data-testid="empty-state">
              <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-slate-700 to-slate-600 flex items-center justify-center shadow-xl">
                <File className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
              </div>
              <p className="text-gray-300 text-base md:text-lg font-medium">No files uploaded yet</p>
              <p className="text-gray-400 text-xs md:text-sm mt-2">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="files-list">
              {memoizedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group bg-gradient-to-r from-slate-800/50 to-purple-900/30 backdrop-blur-md rounded-xl p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between border border-white/10 hover:border-purple-400/50 transition-all duration-300 shadow-lg hover:shadow-purple-500/20 transform hover:scale-[1.01]"
                  data-testid={`file-item-${file.id}`}
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 20px -4px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <File className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate text-sm md:text-base" data-testid={`filename-${file.id}`}>
                        {file.original_filename}
                      </h3>
                      <div className="flex items-center flex-wrap gap-2 text-xs md:text-sm text-gray-400 mt-1">
                        <span data-testid={`filesize-${file.id}`}>{formatFileSize(file.size)}</span>
                        {file.owner_username && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="text-purple-400">by {file.owner_username}</span>
                          </>
                        )}
                        <span className="hidden sm:inline">•</span>
                        <span data-testid={`filedate-${file.id}`} className="hidden sm:inline">{formatDate(file.upload_date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-auto mt-3 sm:mt-0">
                    <button
                      onClick={() => handleDownload(file.id, file.original_filename)}
                      className="p-2 md:p-2.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/50 transform hover:scale-110"
                      title="Download"
                      data-testid={`download-button-${file.id}`}
                      style={{
                        boxShadow: '0 4px 15px -2px rgba(37, 99, 235, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <Download className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button
                      onClick={() => handleShare(file)}
                      className="p-2 md:p-2.5 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/50 transform hover:scale-110"
                      title="Share"
                      data-testid={`share-button-${file.id}`}
                      style={{
                        boxShadow: '0 4px 15px -2px rgba(34, 197, 94, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 md:p-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/50 transform hover:scale-110"
                      title="Delete"
                      data-testid={`delete-button-${file.id}`}
                      style={{
                        boxShadow: '0 4px 15px -2px rgba(239, 68, 68, 0.4), inset 0 -2px 5px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicators */}
      {uploadProgress && (
        <ProgressBar
          progress={uploadProgress.progress}
          speed={uploadProgress.speed}
          timeRemaining={uploadProgress.timeRemaining}
          fileName={uploadProgress.fileName}
          operation="Uploading"
        />
      )}
      
      {downloadProgress && (
        <ProgressBar
          progress={downloadProgress.progress}
          speed={downloadProgress.speed}
          timeRemaining={downloadProgress.timeRemaining}
          fileName={downloadProgress.fileName}
          operation="Downloading"
        />
      )}

      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        onSubmit={handleUsernameSubmit}
      />

      {/* Share Modal */}
      {selectedFile && currentUser && (
        <EnhancedShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          file={selectedFile}
          shareUrl={`${BACKEND_URL}/api/files/${selectedFile.id}/download`}
          currentUser={currentUser}
          allUsers={allUsers}
        />
      )}
    </div>
  );
}

export default App;
