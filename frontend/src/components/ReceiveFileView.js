import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Loader2, FileText, CheckCircle, AlertCircle, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import webrtcManager from '../utils/webrtcManager2';

const ReceiveFileView = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, loginAsGuest } = useAuth();
    const [status, setStatus] = useState('idle'); // idle, connecting, requesting, receiving, completed, error
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [fileInfo, setFileInfo] = useState(null);

    // Parse query params
    const searchParams = new URLSearchParams(location.search);
    const peerId = searchParams.get('peer');
    const fileId = searchParams.get('file');
    const fileName = searchParams.get('name') || 'Unknown File';
    const fileSize = searchParams.get('size');

    useEffect(() => {
        if (!peerId || !fileId) {
            setError('Invalid link. Missing peer or file information.');
            setStatus('error');
        }
    }, [peerId, fileId]);

    const handleDownload = async () => {
        try {
            setStatus('connecting');
            setError(null);

            // 1. Ensure Auth (Guest or User)
            let currentUser = user;
            if (!currentUser) {
                console.log('Logging in as guest...');
                const result = await loginAsGuest(`Guest_${Math.floor(Math.random() * 1000)}`);
                if (!result.success) throw new Error(result.error);
                currentUser = result.user; // Note: accessing the user from context after update might need delay, but webrtcManager uses the one passed to connect
                // Wait a bit for state to propagate if needed, or just use the ID we know we'd get?
                // Actually internal webrtcManager checks context user in App.js effect.
                // We might need to wait for App.js to trigger webrtcManager.connect
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 2. Wait for WebRTC Manager to be ready (connected to WS)
            if (!webrtcManager.ws || webrtcManager.ws.readyState !== WebSocket.OPEN) {
                // It should be connecting via App.js effect. We wait.
                let attempts = 0;
                while ((!webrtcManager.ws || webrtcManager.ws.readyState !== WebSocket.OPEN) && attempts < 10) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }
                if (!webrtcManager.ws || webrtcManager.ws.readyState !== WebSocket.OPEN) {
                    throw new Error('Could not connect to signaling server.');
                }
            }

            // 3. Initiate P2P Connection
            setStatus('connecting_peer');
            // Check if already connected
            if (!webrtcManager.dataChannels.has(peerId)) {
                await webrtcManager.initiateConnection(peerId);
                // Wait for data channel
                let attempts = 0;
                while (!webrtcManager.dataChannels.has(peerId) && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }
                if (!webrtcManager.dataChannels.has(peerId)) {
                    throw new Error('Could not establish P2P connection with sender. They might be offline.');
                }
            }

            // 4. Request File
            setStatus('requesting');
            webrtcManager.onProgressUpdate = (update) => {
                if (update.type === 'receiving') {
                    setStatus('receiving');
                    setProgress(update.progress);
                    setFileInfo({ name: update.fileName });
                }
            };

            webrtcManager.onFileReceived = (name, blob) => {
                setStatus('completed');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            };

            await webrtcManager.requestFile(peerId, fileId);

        } catch (err) {
            console.error(err);
            setError(err.message || 'Download failed');
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <Wifi className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Receive File
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    Direct P2P Transfer from {user ? 'Peer' : 'Sender'}
                </p>

                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 mb-8 border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center space-x-3 text-left">
                        <FileText className="w-10 h-10 text-gray-400" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                                {fileInfo?.name || fileName}
                            </p>
                            {fileSize && (
                                <p className="text-xs text-gray-500">
                                    {(parseInt(fileSize) / 1024 / 1024).toFixed(2)} MB
                                </p>
                            )}
                        </div>
                    </div>
                    {status === 'receiving' && (
                        <div className="mt-4">
                            <div className="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-right text-gray-500 mt-1">{progress}%</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center space-x-2 text-red-600 dark:text-red-400 text-left">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {status === 'completed' ? (
                    <div className="space-y-4">
                        <div className="text-green-500 font-medium flex items-center justify-center space-x-2">
                            <CheckCircle className="w-5 h-5" />
                            <span>Download Completed</span>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                            Go to Home
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleDownload}
                        disabled={status !== 'idle' && status !== 'error'}
                        className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all shadow-lg flex items-center justify-center space-x-2 ${status !== 'idle' && status !== 'error'
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                            }`}
                    >
                        {status === 'idle' || status === 'error' ? (
                            <>
                                <Download className="w-5 h-5" />
                                <span>Start Download</span>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>
                                    {status === 'connecting' ? 'Connecting to Server...' :
                                        status === 'connecting_peer' ? 'Connecting to Peer...' :
                                            status === 'requesting' ? 'Requesting File...' :
                                                'Receiving...'}
                                </span>
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ReceiveFileView;
