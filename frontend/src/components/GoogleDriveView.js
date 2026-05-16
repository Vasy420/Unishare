import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Download, ExternalLink, Loader2, AlertTriangle, WifiOff, Plug } from 'lucide-react';
import { isOfflineMode } from '../utils/offline';
import { toastError, toastInfo } from '../utils/toast';

const GoogleDriveView = ({ token, user, onFileSelect }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOfflineMode()) {
            setLoading(false);
            setError('Offline mode is enabled. Google Drive is unavailable.');
            return;
        }
        if (user && user.google_drive_connected) {
            fetchDriveFiles();
        } else if (user && !user.google_drive_connected) {
            setLoading(false);
            setError('Google Drive is not connected. Please connect your account.');
        }
    }, [user?.google_drive_connected, token]);

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

    const [connectError, setConnectError] = useState(null);
    const [connecting, setConnecting] = useState(false);

    const handleConnectDrive = async () => {
        setConnectError(null);
        if (isOfflineMode()) {
            const msg = 'Google Drive requires an internet connection. Offline mode is enabled.';
            setConnectError({ title: 'Offline mode', detail: msg, kind: 'offline' });
            toastInfo(msg);
            return;
        }
        setConnecting(true);
        try {
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/drive/connect`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            window.location.href = response.data.authorization_url;
        } catch (err) {
            console.error('Failed to initiate Drive connection:', err);
            const detail = err.response?.data?.detail || 'Could not start Google Drive authorization. The server may be missing Drive credentials, or your network blocked the request.';
            const status = err.response?.status;
            setConnectError({
                title: status === 503 || /not configured/i.test(detail)
                    ? 'Google Drive not configured on the server'
                    : 'Couldn\'t connect to Google Drive',
                detail,
                kind: status === 503 || /not configured/i.test(detail) ? 'config' : 'network',
            });
            toastError('Google Drive connection failed');
        } finally {
            setConnecting(false);
        }
    };

    const dismissConnectError = () => setConnectError(null);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">Loading your Drive files...</p>
            </div>
        );
    }

    const ConnectErrorBanner = () => {
        if (!connectError) return null;
        const Icon = connectError.kind === 'offline' ? WifiOff : connectError.kind === 'config' ? Plug : AlertTriangle;
        const ringColor = connectError.kind === 'offline'
            ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
            : connectError.kind === 'config'
            ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
            : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
        const accent = connectError.kind === 'offline'
            ? 'text-amber-600 dark:text-amber-400'
            : connectError.kind === 'config'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-red-600 dark:text-red-400';

        return (
            <div className={`rounded-xl border ${ringColor} p-4 mb-4 shadow-sm`}>
                <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg bg-white/60 dark:bg-slate-900/40 ${accent}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {connectError.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 break-words">
                            {connectError.detail}
                        </p>
                        {connectError.kind === 'config' && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Set <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-slate-700">GOOGLE_CLIENT_ID</code> and{' '}
                                <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-slate-700">GOOGLE_CLIENT_SECRET</code> in
                                {' '}<code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-slate-700">backend/.env</code>, then restart the server.
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                onClick={handleConnectDrive}
                                disabled={connecting}
                                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
                            >
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                                <span>{connecting ? 'Connecting…' : 'Try again'}</span>
                            </button>
                            <button
                                onClick={dismissConnectError}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (error) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <ConnectErrorBanner />
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 mb-4">
                        <HardDrive className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Google Drive</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">{error}</p>
                    <div className="mt-5 flex justify-center space-x-3">
                        <button
                            onClick={fetchDriveFiles}
                            className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-sm font-medium"
                        >
                            Retry
                        </button>
                        <button
                            onClick={handleConnectDrive}
                            disabled={connecting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm font-medium disabled:opacity-50"
                        >
                            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                            <span>{connecting ? 'Connecting…' : 'Connect Drive'}</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ConnectErrorBanner />
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
                                        onClick={() => onFileSelect && onFileSelect(file)}
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
        </div>
    );
};

export default GoogleDriveView;
