import React from 'react';
import { X, Eye, Download, ExternalLink } from 'lucide-react';

const FilePreviewModal = ({ file, onClose, token }) => {
    if (!file) return null;

    const previewUrl = `${process.env.REACT_APP_BACKEND_URL}/api/files/${file.id}/preview`;
    const downloadUrl = `${process.env.REACT_APP_BACKEND_URL}/api/files/${file.id}/download`;

    // Determine if file is previewable
    const isImage = file.content_type?.startsWith('image/');
    const isPDF = file.content_type === 'application/pdf';
    const isVideo = file.content_type?.startsWith('video/');
    const isAudio = file.content_type?.startsWith('audio/');
    const isText = file.content_type?.startsWith('text/') ||
        file.content_type === 'application/json' ||
        file.content_type === 'application/javascript';

    // Office document types
    const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    const lowerName = file.original_filename.toLowerCase();
    const isOfficeDoc = officeExtensions.some(ext => lowerName.endsWith(ext));

    const isPreviewable = isImage || isPDF || isVideo || isAudio || isText || isOfficeDoc;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex items-center space-x-3">
                        <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {file.original_filename}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.content_type || 'Unknown type'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Download"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                        {file.source === 'google_drive' && file.drive_file_id && (
                            <a
                                href={`https://drive.google.com/file/d/${file.drive_file_id}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Open in Drive"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900">
                    {isPreviewable ? (
                        <div className="flex items-center justify-center min-h-full">
                            {isImage && (
                                <img
                                    src={previewUrl}
                                    alt={file.original_filename}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                />
                            )}
                            {isPDF && (
                                <iframe
                                    src={previewUrl}
                                    className="w-full h-[70vh] rounded-lg shadow-lg bg-white"
                                    title={file.original_filename}
                                />
                            )}
                            {isVideo && (
                                <video
                                    controls
                                    className="max-w-full max-h-full rounded-lg shadow-lg"
                                    src={previewUrl}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            )}
                            {isAudio && (
                                <div className="w-full max-w-2xl">
                                    <audio
                                        controls
                                        className="w-full"
                                        src={previewUrl}
                                    >
                                        Your browser does not support the audio tag.
                                    </audio>
                                </div>
                            )}
                            {isText && (
                                <iframe
                                    src={previewUrl}
                                    className="w-full h-[70vh] rounded-lg shadow-lg bg-white dark:bg-slate-800 p-4"
                                    title={file.original_filename}
                                />
                            )}
                            {isOfficeDoc && (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (
                                        <div className="text-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                                            <Eye className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
                                            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                                                Preview not available on Localhost
                                            </h3>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-6 max-w-md">
                                                Google Docs Viewer requires public access to files to generate previews.
                                                This feature will work when deployed to a public server.
                                            </p>
                                            <a
                                                href={downloadUrl}
                                                className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span>Download to View</span>
                                            </a>
                                        </div>
                                    ) : (
                                        <iframe
                                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(downloadUrl)}&embedded=true`}
                                            className="w-full h-[70vh] rounded-lg shadow-lg bg-white"
                                            title={file.original_filename}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center min-h-full text-center">
                            <Eye className="w-16 h-16 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                Preview not available
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                {file.source === 'google_drive'
                                    ? "This Google Drive file cannot be previewed here."
                                    : "This file type cannot be previewed in the browser."}
                            </p>
                            <div className="flex space-x-4">
                                <a
                                    href={downloadUrl}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download File</span>
                                </a>
                                {file.source === 'google_drive' && file.drive_file_id && (
                                    <a
                                        href={`https://drive.google.com/file/d/${file.drive_file_id}/view`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center space-x-2"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Open in Drive</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePreviewModal;
