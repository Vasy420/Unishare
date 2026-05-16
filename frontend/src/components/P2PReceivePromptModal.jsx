import React from 'react';
import { FileText, Download, X } from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const P2PReceivePromptModal = ({ offer, onAccept, onDecline }) => {
  if (!offer) return null;
  const senderName = offer.sender?.username || 'Unknown sender';
  const senderEmoji = offer.sender?.emoji || '👤';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Incoming File
            </h2>
            <button
              onClick={onDecline}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Decline"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center space-x-3 border-b border-gray-100 dark:border-slate-700">
          <span className="text-3xl">{senderEmoji}</span>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">From</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{senderName}</p>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={offer.name}>
                {offer.name}
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>{formatBytes(offer.size)}</span>
                {offer.mimeType && (
                  <>
                    <span>•</span>
                    <span className="truncate">{offer.mimeType}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex space-x-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all font-medium flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default P2PReceivePromptModal;
