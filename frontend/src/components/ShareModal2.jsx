import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Users, HardDrive, Check, Loader, QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import webrtcManager from '../utils/webrtcManager2';

const ShareModal2 = ({ isOpen, onClose, file, backendUrl }) => {
  const [activeTab, setActiveTab] = useState('link');
  const [copied, setCopied] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState(0);
  const qrCodeRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Get online users
      webrtcManager.onOnlineUsersChange = (users) => {
        setOnlineUsers(users);
      };
      
      // Get current online users
      setOnlineUsers(webrtcManager.onlineUsers || []);
    }
  }, [isOpen]);

  const shareUrl = `${backendUrl}${file.share_url}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svg = qrCodeRef.current?.querySelector('svg');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${file.original_filename}-qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  const handleP2PShare = async (peerId) => {
    setSelectedPeer(peerId);
    setSharing(true);
    setShareProgress(0);

    try {
      // First, we need to download the file to share it via P2P
      const downloadUrl = `${backendUrl}${file.download_url}`;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const fileToShare = new File([blob], file.original_filename, { type: file.content_type });

      // Initiate connection if not already connected
      if (!webrtcManager.dataChannels.has(peerId)) {
        console.log('Initiating WebRTC connection to peer:', peerId);
        await webrtcManager.initiateConnection(peerId);
        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if connection is established
        if (!webrtcManager.dataChannels.has(peerId)) {
          throw new Error('Failed to establish P2P connection');
        }
      }

      console.log('Sending file via P2P:', fileToShare.name);
      // Send file
      await webrtcManager.sendFile(peerId, fileToShare, ({ progress }) => {
        setShareProgress(progress);
      });

      alert('File shared successfully via P2P!');
      setSharing(false);
      setShareProgress(0);
      setSelectedPeer(null);
    } catch (error) {
      console.error('P2P share failed:', error);
      alert('Failed to share file via P2P: ' + error.message);
      setSharing(false);
      setShareProgress(0);
      setSelectedPeer(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Share File</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* File Info */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {file.original_filename}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('link')}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Copy Link
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'qr'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <QrCode className="w-4 h-4" />
              <span>QR Code</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('p2p')}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'p2p'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>P2P Share</span>
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Share Link
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Anyone with this link can download the file.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Scan QR Code to Download
                </label>
                <div ref={qrCodeRef} className="bg-white p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow-lg">
                  <QRCodeSVG
                    value={shareUrl}
                    size={256}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                <button
                  onClick={handleDownloadQR}
                  className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  <span>Download QR Code</span>
                </button>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <p className="text-sm text-indigo-800 dark:text-indigo-200">
                  <strong>Tip:</strong> Share this QR code in presentations, posters, or print materials for easy access to your file.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'p2p' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Online Users ({onlineUsers.length})
                </label>
                
                {onlineUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No users online</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Wait for other users to connect
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {onlineUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{user.emoji || '👤'}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.username || 'Anonymous'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleP2PShare(user.id)}
                          disabled={sharing && selectedPeer === user.id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
                        >
                          {sharing && selectedPeer === user.id ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>{shareProgress}%</span>
                            </>
                          ) : (
                            <span>Send</span>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>P2P Transfer:</strong> Files are sent directly between devices without server storage. Both users must be online.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal2;
