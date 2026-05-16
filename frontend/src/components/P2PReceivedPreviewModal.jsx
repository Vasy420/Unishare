import React, { useMemo, useEffect, useState } from 'react';
import { X, Download, FileText, Eye } from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const guessMimeFromName = (name = '') => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    pdf: 'application/pdf',
    txt: 'text/plain', json: 'application/json', js: 'application/javascript',
    md: 'text/markdown', csv: 'text/csv', html: 'text/html'
  };
  return map[ext] || '';
};

const P2PReceivedPreviewModal = ({ received, onClose }) => {
  const [textContent, setTextContent] = useState(null);

  const blobUrl = useMemo(() => {
    if (!received?.blob) return null;
    return URL.createObjectURL(received.blob);
  }, [received?.blob]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const mimeType = received?.mimeType || received?.blob?.type || guessMimeFromName(received?.fileName) || '';
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isAudio = mimeType.startsWith('audio/');
  const isPDF = mimeType === 'application/pdf';
  const isText = mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript';
  const canPreview = isImage || isVideo || isAudio || isPDF || isText;

  useEffect(() => {
    if (isText && received?.blob && textContent === null) {
      received.blob.text().then(setTextContent).catch(() => setTextContent('(failed to load text)'));
    }
  }, [isText, received?.blob, textContent]);

  if (!received) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = received.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const senderName = received.sender?.username;
  const senderEmoji = received.sender?.emoji || '👤';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
              <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={received.fileName}>
                {received.fileName}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatBytes(received.blob?.size)}</span>
                {mimeType && <><span>•</span><span className="truncate">{mimeType}</span></>}
                {senderName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <span>from</span>
                      <span>{senderEmoji}</span>
                      <span className="font-medium">{senderName}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
          {!canPreview && (
            <div className="flex flex-col items-center text-center max-w-md">
              <div className="p-4 bg-gray-200 dark:bg-slate-700 rounded-full mb-4">
                <FileText className="w-12 h-12 text-gray-500 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Preview not available
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                This file type cannot be previewed in the browser.
              </p>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </button>
            </div>
          )}

          {isImage && blobUrl && (
            <img
              src={blobUrl}
              alt={received.fileName}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
            />
          )}

          {isVideo && blobUrl && (
            <video
              src={blobUrl}
              controls
              autoPlay
              className="max-w-full max-h-[75vh] rounded-lg shadow-lg bg-black"
            >
              Your browser does not support the video tag.
            </video>
          )}

          {isAudio && blobUrl && (
            <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <audio src={blobUrl} controls className="w-full">
                Your browser does not support the audio tag.
              </audio>
            </div>
          )}

          {isPDF && blobUrl && (
            <iframe
              src={blobUrl}
              title={received.fileName}
              className="w-full h-[75vh] rounded-lg shadow-lg bg-white"
            />
          )}

          {isText && (
            <pre className="w-full max-h-[75vh] overflow-auto bg-white dark:bg-slate-800 p-4 rounded-lg shadow-inner text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">
              {textContent ?? 'Loading...'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default P2PReceivedPreviewModal;
