import React from 'react';
import { Upload, Download, X } from 'lucide-react';

const formatSpeed = (bytesPerSecond) => {
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

const formatTime = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};

const ProgressIndicator = ({ type, fileName, progress, speed, timeRemaining, onCancel }) => {
  const isUpload = type === 'upload';

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-80 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-lg ${
            isUpload ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
          }`}>
            {isUpload ? (
              <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Download className="w-4 h-4 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {isUpload ? 'Uploading' : 'Downloading'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{fileName}</p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isUpload
                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                : 'bg-gradient-to-r from-green-500 to-green-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">{progress}%</span>
          <div className="flex items-center space-x-2">
            {speed > 0 && <span>{formatSpeed(speed)}</span>}
            {timeRemaining > 0 && timeRemaining < Infinity && (
              <span>• {formatTime(timeRemaining)} left</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
