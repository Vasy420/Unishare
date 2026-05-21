import React, { useState } from 'react';
import axios from 'axios';
import { Download, Trash2, Share2, File, HardDrive, CloudUpload, Eye, Heart } from 'lucide-react';
import { getApiUrl } from '../utils/backendUrl';

const API = getApiUrl();

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const FileCard = ({ file, onDownload, onDelete, onShare, onSaveToDrive, onPreview, user, token }) => {
  const isOwner = user && file.owner_id === user.id;
  const [reacted, setReacted] = useState(!!file.reacted);
  const [reactionCount, setReactionCount] = useState(file.reaction_count || 0);
  const [reactBusy, setReactBusy] = useState(false);

  const handleShareClick = () => onShare && onShare(file);
  const handleDownloadClick = () => onDownload && onDownload(file);
  const handleDeleteClick = () => onDelete && onDelete(file);
  const handlePreviewClick = () => onPreview && onPreview(file);

  const handleReactClick = async () => {
    if (!token) return;
    setReactBusy(true);
    const prevReacted = reacted;
    const prevCount = reactionCount;
    setReacted(!prevReacted);
    setReactionCount(prevCount + (prevReacted ? -1 : 1));
    try {
      const r = await axios.post(`${API}/files/${file.id}/react`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReacted(!!r.data.reacted);
      setReactionCount(r.data.reaction_count || 0);
    } catch {
      setReacted(prevReacted);
      setReactionCount(prevCount);
    } finally {
      setReactBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg shrink-0">
            {file.source === 'google_drive' ? (
              <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {file.original_filename}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatFileSize(file.size)} • {formatDate(file.upload_date)}
            </p>
            {file.owner_username && (
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                <span className="text-gray-400 dark:text-gray-500">by </span>
                <span className="font-medium">{file.owner_username}</span>
                {file.owner_type === 'guest' && (
                  <span className="ml-1 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                    guest
                  </span>
                )}
                {isOwner && (
                  <span className="ml-1 text-[10px] text-blue-500">you</span>
                )}
              </p>
            )}
            {file.source === 'google_drive' && (
              <span className="inline-flex items-center mt-1 text-xs text-blue-600 dark:text-blue-400">
                <HardDrive className="w-3 h-3 mr-1" />
                Google Drive
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={handleShareClick}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-1"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>

        {user && user.google_drive_connected && file.source !== 'google_drive' && onSaveToDrive && (
          <button
            onClick={() => onSaveToDrive(file)}
            className="bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 p-2 rounded-lg transition-colors duration-200"
            title="Save to Google Drive"
          >
            <CloudUpload className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={handlePreviewClick}
          className="bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 p-2 rounded-lg transition-colors duration-200"
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>

        <button
          onClick={handleDownloadClick}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 p-2 rounded-lg transition-colors duration-200"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>

        {isOwner ? (
          <button
            onClick={handleDeleteClick}
            className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-2 rounded-lg transition-colors duration-200"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleReactClick}
            disabled={reactBusy}
            className={`p-2 rounded-lg transition-colors duration-200 flex items-center space-x-1 disabled:opacity-50 ${
              reacted
                ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300'
                : 'bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20 dark:hover:bg-pink-900/40 text-pink-500 dark:text-pink-300'
            }`}
            title={reacted ? 'Remove reaction' : 'Like'}
          >
            <Heart className={`w-4 h-4 ${reacted ? 'fill-current' : ''}`} />
            {reactionCount > 0 && <span className="text-xs font-medium">{reactionCount}</span>}
          </button>
        )}
      </div>
    </div>
  );
};

export default FileCard;
