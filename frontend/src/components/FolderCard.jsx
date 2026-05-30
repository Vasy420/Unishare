import React from 'react';
import { Download, Trash2, Share2, Folder } from 'lucide-react';
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const FolderCard = ({ folder, onDownload, onDelete, user }) => {
  const isOwner = user && folder.owner_id === user.id;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg shrink-0">
            <Folder className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {folder.folderName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'} • {formatFileSize(folder.totalSize)}
            </p>
            {folder.owner_username && (
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                <span className="text-gray-400 dark:text-gray-500">by </span>
                <span className="font-medium">{folder.owner_username}</span>
                {folder.owner_type === 'guest' && (
                  <span className="ml-1 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                    guest
                  </span>
                )}
                {isOwner && (
                  <span className="ml-1 text-[10px] text-blue-500">you</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          disabled
          title="Share folders via P2P at upload time"
          className="flex-1 bg-blue-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-1 cursor-not-allowed opacity-60"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>

        <button
          onClick={() => onDownload && onDownload(folder)}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 p-2 rounded-lg transition-colors duration-200"
          title="Download as zip"
        >
          <Download className="w-4 h-4" />
        </button>

        {isOwner && (
          <button
            onClick={() => onDelete && onDelete(folder)}
            className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-2 rounded-lg transition-colors duration-200"
            title="Delete folder"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FolderCard;
