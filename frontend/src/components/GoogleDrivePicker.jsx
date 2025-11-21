import React, { useState, useEffect } from 'react';
import { HardDrive, Loader, X, ExternalLink } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const GoogleDrivePicker = ({ isOpen, onClose, onFileShared, token }) => {
  const [driveFiles, setDriveFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDriveFiles();
    }
  }, [isOpen]);

  const fetchDriveFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API}/drive/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDriveFiles(response.data);
    } catch (err) {
      console.error('Failed to fetch Drive files:', err);
      setError(err.response?.data?.detail || 'Failed to fetch Google Drive files');
    } finally {
      setLoading(false);
    }
  };

  const handleShareFile = async (driveFile) => {
    setSharing(driveFile.id);
    setError('');
    try {
      const response = await axios.post(
        `${API}/drive/share/${driveFile.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onFileShared(response.data);
      onClose();
    } catch (err) {
      console.error('Failed to share Drive file:', err);
      setError(err.response?.data?.detail || 'Failed to share file');
    } finally {
      setSharing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <HardDrive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Google Drive Files</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading files...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="text-center py-12">
              <HardDrive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No files found in your Drive</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {file.iconLink ? (
                      <img src={file.iconLink} alt="" className="w-6 h-6" />
                    ) : (
                      <HardDrive className="w-6 h-6 text-gray-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="View in Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleShareFile(file)}
                      disabled={sharing === file.id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
                    >
                      {sharing === file.id ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Sharing...</span>
                        </>
                      ) : (
                        <span>Share</span>
                      )}
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
};

export default GoogleDrivePicker;
