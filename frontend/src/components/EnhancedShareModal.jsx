import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  FacebookShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  EmailShareButton,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon,
  EmailIcon,
} from "react-share";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle, Download, QrCode, Bluetooth, Wifi, Users, Lock, Globe, Send } from "lucide-react";
import webrtcManager from "@/utils/webrtcManager";
import bluetoothManager from "@/utils/bluetoothManager";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EnhancedShareModal = ({ isOpen, onClose, file, shareUrl, currentUser, allUsers }) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [activeTab, setActiveTab] = useState("link");
  
  // Permission settings
  const [isPublic, setIsPublic] = useState(file.is_public ?? true);
  const [selectedUsers, setSelectedUsers] = useState(file.shared_with_users || []);
  
  // WebRTC/P2P state
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [p2pTarget, setP2pTarget] = useState("");
  const [p2pStatus, setP2pStatus] = useState("");
  
  // Bluetooth state
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState("");

  useEffect(() => {
    setBluetoothSupported(bluetoothManager.isSupported());
    
    // Fetch online users for P2P
    fetchOnlineUsers();
  }, [isOpen]);

  const fetchOnlineUsers = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/online-users`);
      setOnlineUsers(response.data.users.filter(u => u !== currentUser?.id));
    } catch (error) {
      console.error("Error fetching online users:", error);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById("qr-code-canvas");
    const svg = canvas.querySelector("svg");
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qr-code-${file.original_filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleP2PShare = async () => {
    if (!p2pTarget) {
      setP2pStatus("Please select a user");
      return;
    }

    try {
      setP2pStatus("Connecting...");
      
      // Download file first
      const response = await axios.get(`${BACKEND_URL}/api/files/${file.id}/download`, {
        responseType: 'blob'
      });
      
      const fileBlob = new File([response.data], file.original_filename, {
        type: file.content_type
      });
      
      // Send via WebRTC
      await webrtcManager.sendFile(p2pTarget, fileBlob);
      setP2pStatus("File sent successfully!");
      
      setTimeout(() => {
        setP2pStatus("");
      }, 3000);
    } catch (error) {
      console.error("P2P share error:", error);
      setP2pStatus("Failed to send file");
    }
  };

  const handleBluetoothShare = async () => {
    try {
      setBluetoothStatus("Requesting device...");
      await bluetoothManager.requestDevice();
      
      setBluetoothStatus("Sending file...");
      
      // Download file first
      const response = await axios.get(`${BACKEND_URL}/api/files/${file.id}/download`, {
        responseType: 'blob'
      });
      
      const fileBlob = new File([response.data], file.original_filename, {
        type: file.content_type
      });
      
      await bluetoothManager.sendFile(fileBlob, (sent, total) => {
        const percentage = Math.round((sent / total) * 100);
        setBluetoothStatus(`Sending: ${percentage}%`);
      });
      
      setBluetoothStatus("File sent successfully!");
      
      setTimeout(() => {
        setBluetoothStatus("");
        bluetoothManager.disconnect();
      }, 3000);
    } catch (error) {
      console.error("Bluetooth share error:", error);
      setBluetoothStatus(error.message || "Failed to send via Bluetooth");
    }
  };

  const handlePermissionUpdate = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/files/${file.id}/permissions`, {
        file_id: file.id,
        is_public: isPublic,
        shared_with_users: selectedUsers
      });
      alert("Permissions updated successfully!");
    } catch (error) {
      console.error("Permission update error:", error);
      alert("Failed to update permissions");
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const shareMessage = `Check out this file: ${file.original_filename}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-800/95 to-purple-900/95 backdrop-blur-xl text-white border border-white/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Share File
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Share "{file.original_filename}" using multiple methods
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-700/50 backdrop-blur-sm">
            <TabsTrigger value="link" className="data-[state=active]:bg-purple-600">Link</TabsTrigger>
            <TabsTrigger value="qr" className="data-[state=active]:bg-purple-600">QR</TabsTrigger>
            <TabsTrigger value="p2p" className="data-[state=active]:bg-purple-600">P2P</TabsTrigger>
            <TabsTrigger value="bluetooth" className="data-[state=active]:bg-purple-600">BT</TabsTrigger>
            <TabsTrigger value="permissions" className="data-[state=active]:bg-purple-600">Users</TabsTrigger>
          </TabsList>

          {/* Link & Social Media */}
          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Share Link</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Social Media</label>
              <div className="flex flex-wrap gap-2">
                <FacebookShareButton url={shareUrl} quote={shareMessage}>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-lg transition-all cursor-pointer shadow-lg">
                    <FacebookIcon size={24} round />
                    <span className="text-sm font-medium">Facebook</span>
                  </div>
                </FacebookShareButton>

                <TwitterShareButton url={shareUrl} title={shareMessage}>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-[#1da1f2] hover:bg-[#1a8cd8] text-white rounded-lg transition-all cursor-pointer shadow-lg">
                    <TwitterIcon size={24} round />
                    <span className="text-sm font-medium">Twitter</span>
                  </div>
                </TwitterShareButton>

                <WhatsappShareButton url={shareUrl} title={shareMessage}>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-[#25d366] hover:bg-[#20bd5a] text-white rounded-lg transition-all cursor-pointer shadow-lg">
                    <WhatsappIcon size={24} round />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </div>
                </WhatsappShareButton>

                <EmailShareButton url={shareUrl} subject={`File: ${file.original_filename}`} body={shareMessage}>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-[#7f7f7f] hover:bg-[#6b6b6b] text-white rounded-lg transition-all cursor-pointer shadow-lg">
                    <EmailIcon size={24} round />
                    <span className="text-sm font-medium">Email</span>
                  </div>
                </EmailShareButton>
              </div>
            </div>
          </TabsContent>

          {/* QR Code */}
          <TabsContent value="qr" className="space-y-4 mt-4">
            <div className="flex flex-col items-center space-y-4 p-6 bg-white rounded-lg">
              <div id="qr-code-canvas">
                <QRCodeSVG
                  value={shareUrl}
                  size={250}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button
                onClick={handleDownloadQR}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg"
              >
                <Download className="w-5 h-5" />
                <span>Download QR Code</span>
              </button>
              <p className="text-sm text-gray-600 text-center">
                Scan this QR code to download the file offline
              </p>
            </div>
          </TabsContent>

          {/* P2P/WebRTC/LAN */}
          <TabsContent value="p2p" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-gray-200">
                <Wifi className="w-5 h-5 text-green-400" />
                <label className="text-sm font-medium">Direct Transfer (WebRTC)</label>
              </div>
              <p className="text-xs text-gray-400">
                Send file directly to another user on the same network (no internet required)
              </p>
              
              <select
                value={p2pTarget}
                onChange={(e) => setP2pTarget(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select a user...</option>
                {onlineUsers.map(userId => (
                  <option key={userId} value={userId}>{userId}</option>
                ))}
              </select>

              <button
                onClick={handleP2PShare}
                disabled={!p2pTarget}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>Send via P2P</span>
              </button>

              {p2pStatus && (
                <p className="text-sm text-center text-gray-300">{p2pStatus}</p>
              )}
            </div>
          </TabsContent>

          {/* Bluetooth */}
          <TabsContent value="bluetooth" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-gray-200">
                <Bluetooth className="w-5 h-5 text-blue-400" />
                <label className="text-sm font-medium">Bluetooth Transfer</label>
              </div>
              
              {bluetoothSupported ? (
                <>
                  <p className="text-xs text-gray-400">
                    Transfer file to nearby Bluetooth device
                  </p>
                  
                  <button
                    onClick={handleBluetoothShare}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Bluetooth className="w-5 h-5" />
                    <span>Send via Bluetooth</span>
                  </button>

                  {bluetoothStatus && (
                    <p className="text-sm text-center text-gray-300">{bluetoothStatus}</p>
                  )}
                </>
              ) : (
                <div className="p-4 bg-yellow-600/20 border border-yellow-600/30 rounded-lg">
                  <p className="text-sm text-yellow-200">
                    Bluetooth is not supported in your browser. Try using Chrome on Android or a compatible browser.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* User Permissions */}
          <TabsContent value="permissions" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-gray-200">
                <Users className="w-5 h-5 text-purple-400" />
                <label className="text-sm font-medium">Sharing Permissions</label>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                  <input
                    type="radio"
                    name="permission"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <Globe className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium">Public - Anyone with link</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                  <input
                    type="radio"
                    name="permission"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <Lock className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium">Private - Specific users only</span>
                  </div>
                </label>
              </div>

              {!isPublic && (
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-white/5 backdrop-blur-sm rounded-lg">
                  <label className="text-xs font-medium text-gray-300">Select Users:</label>
                  {allUsers && allUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-2 p-2 hover:bg-white/10 rounded cursor-pointer transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm text-gray-200">{user.username}</span>
                    </label>
                  ))}
                </div>
              )}

              <button
                onClick={handlePermissionUpdate}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg"
              >
                Update Permissions
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedShareModal;
