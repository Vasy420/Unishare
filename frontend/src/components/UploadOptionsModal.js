import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Users, Globe, Lock, Share2, FileText, QrCode, Link as LinkIcon, Wifi, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import webrtcManager from '../utils/webrtcManager2';
import { isOfflineMode } from '../utils/offline';
import { useAuth } from '../contexts/AuthContext';

const CLOUD_UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // keep in sync with App.js
const CLOUD_UPLOAD_MAX_LABEL = '100 MB';
const MAX_QR_LINK_LENGTH = 1800;

const UploadOptionsModal = ({ isOpen, onClose, onUpload, file, uploading, dataLimitReached }) => {
    const { user } = useAuth();
    const isDriveFile = file?.source === 'google_drive' || !!file?.webViewLink;
    const isFolder = !!file && !!file.files && Array.isArray(file.files);
    const fileSize = isFolder
        ? file.files.reduce((sum, f) => sum + (f.file?.size || 0), 0)
        : (file?.size || 0);
    const exceedsCloudCap = !!file && !isDriveFile && !isFolder && file.size > CLOUD_UPLOAD_MAX_BYTES;
    const [activeTab, setActiveTab] = useState(isDriveFile ? 'upload' : 'share'); // Default to upload for Drive files
    const [shareOptions, setShareOptions] = useState({
        isPublic: true,
        sharedWith: ''
    });
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [p2pLink, setP2pLink] = useState(null);
    const [copied, setCopied] = useState(false);
    const [peerStatus, setPeerStatus] = useState({}); // userId -> {label, kind}
    const [customName, setCustomName] = useState('');
    const [zippedFile, setZippedFile] = useState(null);
    const [zipping, setZipping] = useState(false);
    const [zippingProgress, setZippingProgress] = useState(0);
    const qrRef = useRef(null);

    useEffect(() => {
        if (file) setCustomName(isFolder ? file.folderName : (file.name || ''));
    }, [file, isFolder]);

    const zipFolder = async (folder) => {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const total = folder.files.length;
        for (let i = 0; i < total; i++) {
            const { file: f, relativePath } = folder.files[i];
            zip.file(relativePath, f);
            setZippingProgress(Math.round(((i + 1) / total) * 100));
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const zipFile = new File([blob], `${folder.folderName}.zip`, { type: 'application/zip' });
        return zipFile;
    };

    const setStatusForPeer = (userId, label, kind, autoClearMs = 0) => {
        setPeerStatus(prev => ({ ...prev, [userId]: { label, kind } }));
        if (autoClearMs > 0) {
            setTimeout(() => {
                setPeerStatus(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            }, autoClearMs);
        }
    };

    useEffect(() => {
        if (isOpen && file) {
            // Reset zip state on open
            setZippedFile(null);
            setZipping(false);
            setZippingProgress(0);

            if (isDriveFile && file.webViewLink) {
                setP2pLink(file.webViewLink);
            } else if (!isDriveFile) {
                const setupP2PLink = (fileToHost) => {
                    const fileId = webrtcManager.hostFile(fileToHost);
                    const userId = webrtcManager.userId;
                    const username = user?.username || 'Someone';
                    const emoji = user?.emoji || '👤';

                    if (userId) {
                        const link = `${window.location.origin}/receive?peer=${userId}&file=${fileId}&name=${encodeURIComponent(fileToHost.name)}&size=${fileToHost.size}&from=${encodeURIComponent(username)}&emoji=${encodeURIComponent(emoji)}`;
                        setP2pLink(link);
                    }

                    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileToHost.name) && fileToHost.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const maxSize = 80;
                                const scale = Math.min(maxSize / img.width, maxSize / img.height);
                                canvas.width = Math.round(img.width * scale);
                                canvas.height = Math.round(img.height * scale);
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                const thumb = canvas.toDataURL('image/jpeg', 0.4);
                                if (userId) {
                                    const link = `${window.location.origin}/receive?peer=${userId}&file=${fileId}&name=${encodeURIComponent(fileToHost.name)}&size=${fileToHost.size}&from=${encodeURIComponent(username)}&emoji=${encodeURIComponent(emoji)}&thumb=${encodeURIComponent(thumb)}`;
                                    // Avoid crashing QR generator with oversized payloads.
                                    // Keep the shorter non-thumb link when the thumb variant is too long.
                                    if (link.length <= MAX_QR_LINK_LENGTH) {
                                        setP2pLink(link);
                                    }
                                }
                            };
                            img.src = e.target.result;
                        };
                        reader.readAsDataURL(fileToHost);
                    }
                };

                if (isFolder) {
                    // Zip folder in background for link generation
                    setZipping(true);
                    zipFolder(file).then((zipFile) => {
                        setZippedFile(zipFile);
                        setZipping(false);
                        setupP2PLink(zipFile);
                    }).catch((err) => {
                        console.error('Failed to zip folder:', err);
                        setZipping(false);
                    });
                } else {
                    setupP2PLink(file);
                }
            }

            // Get online users (only relevant for P2P) — exclude admins from the visible list.
            if (!isDriveFile) {
                const filterUsers = (users) => (users || []).filter((u) => !u.is_admin);
                const handler = (users) => setOnlineUsers(filterUsers(users));
                webrtcManager.onOnlineUsersChange = handler;
                setOnlineUsers(filterUsers(webrtcManager.onlineUsers));
                return () => {
                    if (webrtcManager.onOnlineUsersChange === handler) {
                        webrtcManager.onOnlineUsersChange = null;
                    }
                };
            }
        }
    }, [isOpen, file, isDriveFile, isFolder]);

    if (!isOpen || !file) return null;

    const handleCloudUpload = () => {
        if (isFolder) {
            // For folders, pass the folder object with options
            onUpload(file, shareOptions);
            return;
        }
        const finalName = (customName || '').trim() || file.name;
        // Rename file if user changed it. Preserves type and content.
        const fileToUpload = finalName === file.name
            ? file
            : new File([file], finalName, { type: file.type });
        onUpload(fileToUpload, shareOptions);
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
                        {isDriveFile ? 'Import from Drive' : 'Share or Upload'}
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

                {/* Tabs - Always show both tabs */}
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
                            <span>{isDriveFile ? 'Drive Link' : 'Share (No Upload)'}</span>
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
                            <span>{isDriveFile ? 'Import to Cloud' : 'Cloud Upload'}</span>
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
                                {isFolder ? file.folderName : (file.name || file.original_filename)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isFolder
                                    ? `${file.files.length} files • ${(fileSize / 1024 / 1024).toFixed(2)} MB total`
                                    : (file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '')
                                }
                            </p>
                        </div>
                    </div>

                    {activeTab === 'share' && (
                        <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                            

                            {/* Send to Local Users - now at top */}
                            {!isDriveFile && (
                                <div>
                                    <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                        <Wifi className="w-4 h-4 text-green-500" />
                                        <span>Send to Local Users</span>
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        Direct transfer without internet. Fast and private.
                                    </p>
                                    {onlineUsers.length > 0 ? (
                                        <div className="grid gap-2 max-h-40 overflow-y-auto">
                                            {onlineUsers.map(u => (
                                                <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-xl">{u.emoji || '👤'}</span>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{u.username}</span>
                                                    </div>
                                                      <button
                                                          onClick={async () => {
                                                              const uid = u.id;
                                                              try {
                                                                  setStatusForPeer(uid, 'Connecting...', 'pending');
                                                                  if (!webrtcManager.canSendViaBroadcast(uid)) {
                                                                      const dc = webrtcManager.dataChannels.get(uid);
                                                                      if (!dc || dc.readyState !== 'open') {
                                                                          if (dc) webrtcManager.closePeerConnection(uid);
                                                                          await webrtcManager.initiateConnection(uid);
                                                                          await webrtcManager.waitForDataChannelOpen(uid, 15000);
                                                                      }
                                                                  }
                                                                  let fileToSend = file;
                                                                  if (isFolder) {
                                                                      setStatusForPeer(uid, 'Zipping...', 'pending');
                                                                      const zipFile = zippedFile || await zipFolder(file);
                                                                      if (!zippedFile) setZippedFile(zipFile);
                                                                      fileToSend = zipFile;
                                                                  }
                                                                  setStatusForPeer(uid, 'Sending...', 'pending');
                                                                  await webrtcManager.sendFile(uid, fileToSend, (update) => {
                                                                      if (update?.type === 'accepted') {
                                                                          setStatusForPeer(uid, 'Sending...', 'pending');
                                                                      } else if (update?.progress !== undefined) {
                                                                          setStatusForPeer(uid, `${update.progress}%`, 'pending');
                                                                      }
                                                                  });
                                                                  setStatusForPeer(uid, 'Sent', 'success', 3000);
                                                              } catch (e) {
                                                                  const msg = (e.message || '').toLowerCase();
                                                                  if (msg.includes('declined')) {
                                                                      setStatusForPeer(uid, 'Declined', 'error', 4000);
                                                                  } else if (msg.includes('did not respond')) {
                                                                      setStatusForPeer(uid, 'No response', 'error', 4000);
                                                                  } else {
                                                                      setStatusForPeer(uid, 'Failed', 'error', 4000);
                                                                      console.error('Send failed:', e);
                                                                  }
                                                              }
                                                          }}
                                                          disabled={peerStatus[u.id]?.kind === 'pending'}
                                                          className={`px-3 py-1 text-white text-xs font-medium rounded-lg min-w-[80px] ${
                                                              peerStatus[u.id]?.kind === 'success'
                                                                  ? 'bg-emerald-600'
                                                                  : peerStatus[u.id]?.kind === 'error'
                                                                  ? 'bg-red-600'
                                                                  : peerStatus[u.id]?.kind === 'pending'
                                                                  ? 'bg-blue-500 cursor-not-allowed'
                                                                  : 'bg-green-600 hover:bg-green-700'
                                                          }`}
                                                      >
                                                         {peerStatus[u.id]?.label || 'Send'}
                                                     </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-center text-gray-500 p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg">No other users online</p>
                                    )}
                                </div>
                            )}

                            {/* Link Section */}
                            <div>
                                <h4 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    <LinkIcon className="w-4 h-4 text-blue-500" />
                                    <span>{isDriveFile ? 'Google Drive Link' : 'Share Link (P2P)'}</span>
                                </h4>
                                {isFolder && zipping ? (
                                    <div className="space-y-2">
                                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${zippingProgress}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Preparing folder for sharing... {zippingProgress}%</p>
                                    </div>
                                ) : p2pLink ? (
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
                                        {!isDriveFile && (
                                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                    <strong>Important:</strong> Keep this tab open! The recipient needs you online to receive the file directly.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">Generating link...</p>
                                )}
                            </div>

                            {/* QR Code Section */}
                            {p2pLink && p2pLink.length <= MAX_QR_LINK_LENGTH && (
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

                            {p2pLink && p2pLink.length > MAX_QR_LINK_LENGTH && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                        Link is too long for QR encoding. Use <strong>Copy</strong> to share it.
                                    </p>
                                </div>
                            )}

                            
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                            {dataLimitReached && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                                    You've reached the 2GB guest cloud limit. Cloud upload is disabled, but you can still use the <strong>Share</strong> tab to send files directly to peers — no size limit.
                                </div>
                            )}
                            {exceedsCloudCap && !isFolder && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                                    File is {(file.size / (1024 * 1024)).toFixed(1)} MB. Cloud uploads are capped at {CLOUD_UPLOAD_MAX_LABEL}. Use the Share tab to send it directly to a peer.
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    File name
                                </label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    disabled={uploading}
                                    placeholder={file?.name || 'file name'}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Keep the extension (e.g. .pdf, .png) so previews work.
                                </p>
                            </div>

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

                            {/* Hide Private Option for Drive Files per request */}
                            {!isDriveFile && (
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
                            )}

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
                            disabled={uploading || exceedsCloudCap || dataLimitReached}
                            className={`flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md flex items-center justify-center space-x-2 ${(uploading || exceedsCloudCap || dataLimitReached) ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {uploading ? 'Uploading...' : exceedsCloudCap ? `Too large (> ${CLOUD_UPLOAD_MAX_LABEL})` : dataLimitReached ? 'Guest limit reached' : 'Upload to Cloud'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadOptionsModal;
