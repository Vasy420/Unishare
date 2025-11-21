import React from 'react';
import { X, HardDrive, CheckCircle, XCircle } from 'lucide-react';

const GoogleDriveConnectModal = ({ isOpen, onConnect, onSkip }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mb-6">
            <HardDrive className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Connect Google Drive?
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Connect your Google Drive to import files and save UniShare files directly to your Drive.
          </p>

          {/* Features */}
          <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-start gap-3 text-left">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Import from Drive</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Pick files from your Google Drive to share</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Save to Drive</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Backup UniShare files to your Drive</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Seamless Integration</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">One-click access to your files</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 w-full">
            <button
              onClick={onSkip}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Maybe Later
            </button>
            <button
              onClick={onConnect}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <HardDrive className="w-5 h-5" />
              Connect Now
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            You can connect Google Drive anytime from settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveConnectModal;
