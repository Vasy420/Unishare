import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Users, Globe, Lock, Share2, FileText, QrCode, Link as LinkIcon, Wifi, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import webrtcManager from '../utils/webrtcManager2';

const UploadOptionsModal = ({ isOpen, onClose, onUpload, file, uploading }) => {
    const [activeTab, setActiveTab] = useState('share'); // 'share' or 'upload'
    const [shareOptions, setShareOptions] = useState({
        isPublic: true,
        sharedWith: ''
    });
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [p2pLink, setP2pLink] = useState(null);
    const [copied, setCopied] = useState(false);
    const qrRef = useRef(null);

    useEffect(() => {
        if (isOpen && file) {
            // Host the file for P2P and generate link
            const fileId = webrtcManager.hostFile(file);
            const userId = webrtcManager.userId;
            if (userId) {
                const link = `${window.location.origin}/receive?peer=${userId}&file=${fileId}&name=${encodeURIComponent(file.name)}&size=${file.size}`;
                setP2pLink(link);
            }

            // Get online users
            setOnlineUsers(webrtcManager.onlineUsers || []);
            const originalHandler = webrtcManager.onOnlineUsersChange;
            webrtcManager.onOnlineUsersChange = (users) => {
                setOnlineUsers(users);
                if (originalHandler) originalHandler(users);
            };
            return () => {
                webrtcManager.onOnlineUsersChange = originalHandler;
            };
        }
    }, [isOpen, file]);

    if (!isOpen || !file) return null;

    const handleCloudUpload = () => {
        onUpload(file, shareOptions);
    };

    const handleCopyLink = () => {
        if (p2pLink) {
            navigator.clipboard.writeText(p2pLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Share or Upload
                    </h3>
                    {!uploading && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('share')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'share'
                            ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Share2 className="w-4 h-4" />
                            <span>Share (No Upload)</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'upload'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Upload className="w-4 h-4" />
                            <span>Cloud Upload</span>
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* File Preview */}
                    <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 mb-6 flex items-center space-x-3 border border-gray-200 dark:border-slate-700">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                    </div>

                    {activeTab === 'share' && (
                        <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                            {/* Link Section */}
                            <div>
                                <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    <LinkIcon className="w-4 h-4 text-blue-500" />
                                    <span>Share Link (P2P)</span>
                                </h4>
                                {p2pLink ? (
                                    <div className="space-y-3">
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                value={p2pLink}
                                                readOnly
                                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 truncate"
                                            />
                                            <button
                                                onClick={handleCopyLink}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center space-x-1"
                                            >
                                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                <span>{copied ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                <strong>Important:</strong> Keep this tab open! The recipient needs you online to receive the file directly.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">Generating link...</p>
                                )}
                            </div>

                            {/* QR Code Section */}
                            {p2pLink && (
                                <div>
                                    <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                        <QrCode className="w-4 h-4 text-indigo-500" />
                                        <span>QR Code</span>
                                    </h4>
                                    <div ref={qrRef} className="bg-white p-4 rounded-xl border border-gray-200 dark:border-slate-600 inline-block mx-auto">
                                        <QRCodeSVG
                                            value={p2pLink}
                                            size={180}
                                            level="M"
                                            includeMargin={true}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* P2P Online Users */}
                            <div>
                                <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    <Wifi className="w-4 h-4 text-green-500" />
                                    <span>Send Directly to Online Users</span>
                                </h4>
                                {onlineUsers.length > 0 ? (
                                    <div className="grid gap-2 max-h-40 overflow-y-auto">
                                        {onlineUsers.map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-xl">{user.emoji || '👤'}</span>
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.username}</span>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            if (!webrtcManager.dataChannels.has(user.id)) {
                                                                await webrtcManager.initiateConnection(user.id);
                                                                await new Promise(r => setTimeout(r, 2000));
                                                            }
                                                            await webrtcManager.sendFile(user.id, file);
                                                            alert('File sent!');
                                                        } catch (e) {
                                                            alert('Send failed: ' + e.message);
                                                        }
                                                    }}
                                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg"
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-center text-gray-500 p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg">No other users online</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visibility</p>

                            <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                                <input
                                    type="radio"
                                    checked={shareOptions.isPublic}
                                    onChange={() => setShareOptions({ ...shareOptions, isPublic: true, sharedWith: '' })}
                                    className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <Globe className="w-4 h-4 text-blue-500" />
                                        <span className="font-medium text-gray-900 dark:text-white">Public</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Accessible by anyone with the share link
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                                <input
                                    type="radio"
                                    checked={!shareOptions.isPublic && !shareOptions.sharedWith}
                                    onChange={() => setShareOptions({ ...shareOptions, isPublic: false, sharedWith: '' })}
                                    className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <Lock className="w-4 h-4 text-orange-500" />
                                        <span className="font-medium text-gray-900 dark:text-white">Private</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Only accessible by you
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                                <input
                                    type="radio"
                                    checked={!shareOptions.isPublic && shareOptions.sharedWith !== ''}
                                    onChange={() => setShareOptions({ ...shareOptions, isPublic: false, sharedWith: shareOptions.sharedWith || ' ' })}
                                    className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <Users className="w-4 h-4 text-green-500" />
                                        <span className="font-medium text-gray-900 dark:text-white">Specific Users</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                        Share with valid email addresses
                                    </p>
                                    {!shareOptions.isPublic && shareOptions.sharedWith !== '' && (
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Enter emails (comma separated)"
                                            value={shareOptions.sharedWith.trim() === '' ? '' : shareOptions.sharedWith}
                                            onChange={(e) => setShareOptions({ ...shareOptions, isPublic: false, sharedWith: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                {/* Footer (only for Upload Tab) */}
                {activeTab === 'upload' && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 flex space-x-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCloudUpload}
                            disabled={uploading}
                            className={`flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md flex items-center justify-center space-x-2 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {uploading ? 'Uploading...' : 'Upload to Cloud'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadOptionsModal;
