import { useEffect, useState, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { Upload, Download, Trash2, Share2, File, X } from "lucide-react";
import ShareModal from "@/components/ShareModal";
import ProgressBar from "@/components/ProgressBar";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Progress tracking state
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);

  // Fetch all files
  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

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
      await axios.post(`${API}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const currentTime = Date.now();
          const timeElapsed = (currentTime - lastTime) / 1000; // in seconds
          const loaded = progressEvent.loaded;
          const total = progressEvent.total;
          const percentage = Math.round((loaded * 100) / total);
          
          // Calculate speed (bytes per second)
          const bytesUploaded = loaded - lastLoaded;
          const speed = timeElapsed > 0 ? bytesUploaded / timeElapsed : 0;
          
          // Calculate time remaining
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
      });
      await fetchFiles();
      
      // Clear progress after a short delay
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
          
          // Calculate speed
          const bytesDownloaded = loaded - lastLoaded;
          const speed = timeElapsed > 0 ? bytesDownloaded / timeElapsed : 0;
          
          // Calculate time remaining
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
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      // Clear progress after a short delay
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
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 md:mb-4" data-testid="app-title">
            File Sharing App
          </h1>
          <p className="text-gray-300 text-base md:text-lg">Upload, share, and manage your files easily</p>
        </div>

        {/* Upload Area */}
        <div
          className={`mb-8 border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            dragActive
              ? "border-purple-400 bg-purple-900/20"
              : "border-gray-600 bg-slate-800/50 hover:border-purple-500"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="upload-area"
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {uploading ? "Uploading..." : "Drop your file here"}
          </h3>
          <p className="text-gray-400 mb-4">or</p>
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
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="browse-button"
          >
            {uploading ? "Uploading..." : "Browse Files"}
          </button>
        </div>

        {/* Files List */}
        <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-6" data-testid="files-header">
            Uploaded Files ({files.length})
          </h2>
          
          {files.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state">
              <File className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">No files uploaded yet</p>
              <p className="text-gray-500 text-sm mt-2">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="files-list">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="bg-slate-700/50 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <File className="w-10 h-10 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate" data-testid={`filename-${file.id}`}>
                        {file.original_filename}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                        <span data-testid={`filesize-${file.id}`}>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span data-testid={`filedate-${file.id}`}>{formatDate(file.upload_date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(file.id, file.original_filename)}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="Download"
                      data-testid={`download-button-${file.id}`}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(file.id)}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors relative"
                      title="Copy share link"
                      data-testid={`copy-button-${file.id}`}
                    >
                      {copiedId === file.id ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="Delete"
                      data-testid={`delete-button-${file.id}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
