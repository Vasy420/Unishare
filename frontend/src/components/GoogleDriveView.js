import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Download, ExternalLink, Loader2 } from 'lucide-react';

const GoogleDriveView = ({ token, user }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [shareOptions, setShareOptions] = useState({
        isPublic: true,
        sharedWith: ''
    });

    useEffect(() => {
        if (user && user.google_drive_connected) {
            fetchDriveFiles();
        } else if (user && !user.google_drive_connected) {
            setLoading(false);
            setError('Google Drive is not connected. Please connect your account.');
        }
    }, [user?.google_drive_connected, token]); // Track specific property

    const fetchDriveFiles = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/drive/files`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(response.data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch Drive files:', err);
            const errorMsg = err.response?.data?.detail || 'Failed to load Google Drive files. Please ensure your account is connected.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectDrive = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/drive/connect`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            window.location.href = response.data.authorization_url;
        } catch (err) {
            console.error('Failed to initiate Drive connection:', err);
            alert('Failed to connect to Google Drive. Please try again.');
        }
    };

    const handleShareToUniShare = (file) => {
        setSelectedFile(file);
        setShowShareModal(true);
    };

    const confirmShare = async () => {
        if (!selectedFile) return;

        try {
            const params = new URLSearchParams({
                is_public: shareOptions.isPublic,
                shared_with: shareOptions.sharedWith
            });

            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/drive/share/${selectedFile.id}?${params}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`"${selectedFile.name}" has been imported to UniShare!`);
            setShowShareModal(false);
            setSelectedFile(null);
            setShareOptions({ isPublic: true, sharedWith: '' });
        } catch (err) {
            console.error('Failed to share file:', err);
            const errorMsg = err.response?.data?.detail || 'Failed to import file to UniShare';
            alert(errorMsg);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">Loading your Drive files...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-12 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={fetchDriveFiles}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                    >
                        Retry
                    </button>
                    <button
                        onClick={handleConnectDrive}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                        <HardDrive className="w-4 h-4" />
                        <span>Connect Drive</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <HardDrive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Google Drive Files</h2>
                </div>
                <button
                    onClick={fetchDriveFiles}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    Refresh
                </button>
            </div>

            {files.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                    <HardDrive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No files found in your Google Drive</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {files.map((file) => (
                        <div
                            key={file.id}
                            className="group relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-lg transition-all duration-200"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                                    <img src={file.iconLink} alt="" className="w-6 h-6" />
                                </div>
                                {file.webViewLink && (
                                    <a
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                        title="Open in Drive"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                            </div>

                            <h3 className="font-medium text-gray-900 dark:text-white truncate mb-1" title={file.name}>
                                {file.name}
                            </h3>

                            <div className="flex items-center justify-between mt-4">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size'}
                                </span>

                                <div className="flex space-x-2">
                                    <a
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                        title="View in Drive"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>View</span>
                                    </a>
                                    <button
                                        onClick={() => handleShareToUniShare(file)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                        title="Import to UniShare"
                                    >
                                        <Download className="w-3 h-3" />
                                        <span>Import</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sharing Options Modal */}
            {showShareModal && selectedFile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Import "{selectedFile.name}"
                        </h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={shareOptions.isPublic}
                                        onChange={() => setShareOptions({ ...shareOptions, isPublic: true, sharedWith: '' })}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">Public (anyone can access)</span>
                                </label>
                            </div>

                            <div>
                                <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                    <input
                                        type="radio"
                                        checked={!shareOptions.isPublic && !shareOptions.sharedWith}
                                        onChange={() => setShareOptions({ ...shareOptions, isPublic: false, sharedWith: '' })}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">Private (only you)</span>
                                </label>
                            </div>

                            <div>
                                <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                    <input
                                        type="radio"
                                        checked={!shareOptions.isPublic && shareOptions.sharedWith}
                                        onChange={() => setShareOptions({ ...shareOptions, isPublic: false })}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">Shared with specific users</span>
                                </label>
                                {!shareOptions.isPublic && (
                                    <input
                                        type="text"
                                        placeholder="Enter emails (comma separated)"
                                        value={shareOptions.sharedWith}
                                        onChange={(e) => setShareOptions({ ...shareOptions, sharedWith: e.target.value })}
                                        className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setShowShareModal(false);
                                    setSelectedFile(null);
                                    setShareOptions({ isPublic: true, sharedWith: '' });
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmShare}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Import to UniShare
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleDriveView;
