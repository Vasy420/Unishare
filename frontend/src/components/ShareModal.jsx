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
import { Copy, CheckCircle, Download, QrCode, Bluetooth, Wifi, Users, Lock, Globe } from "lucide-react";
import webrtcManager from "@/utils/webrtcManager";
import bluetoothManager from "@/utils/bluetoothManager";

const ShareModal = ({ isOpen, onClose, file, shareUrl }) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

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

  const shareMessage = `Check out this file: ${file.original_filename}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Share File
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Share "{file.original_filename}" with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Copy Link Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Share Link</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center space-x-2"
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

          {/* QR Code Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">QR Code</label>
              <button
                onClick={() => setShowQR(!showQR)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>{showQR ? "Hide" : "Show"} QR Code</span>
              </button>
            </div>
            
            {showQR && (
              <div className="flex flex-col items-center space-y-3 p-4 bg-white rounded-lg">
                <div id="qr-code-canvas">
                  <QRCodeSVG
                    value={shareUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <button
                  onClick={handleDownloadQR}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR Code</span>
                </button>
              </div>
            )}
          </div>

          {/* Social Media Sharing */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Share on Social Media</label>
            <div className="flex flex-wrap gap-3">
              <FacebookShareButton url={shareUrl} quote={shareMessage}>
                <div className="flex items-center space-x-2 px-4 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-lg transition-colors cursor-pointer">
                  <FacebookIcon size={24} round />
                  <span className="text-sm font-medium">Facebook</span>
                </div>
              </FacebookShareButton>

              <TwitterShareButton url={shareUrl} title={shareMessage}>
                <div className="flex items-center space-x-2 px-4 py-2 bg-[#1da1f2] hover:bg-[#1a8cd8] text-white rounded-lg transition-colors cursor-pointer">
                  <TwitterIcon size={24} round />
                  <span className="text-sm font-medium">Twitter</span>
                </div>
              </TwitterShareButton>

              <WhatsappShareButton url={shareUrl} title={shareMessage}>
                <div className="flex items-center space-x-2 px-4 py-2 bg-[#25d366] hover:bg-[#20bd5a] text-white rounded-lg transition-colors cursor-pointer">
                  <WhatsappIcon size={24} round />
                  <span className="text-sm font-medium">WhatsApp</span>
                </div>
              </WhatsappShareButton>

              <EmailShareButton url={shareUrl} subject={`File: ${file.original_filename}`} body={shareMessage}>
                <div className="flex items-center space-x-2 px-4 py-2 bg-[#7f7f7f] hover:bg-[#6b6b6b] text-white rounded-lg transition-colors cursor-pointer">
                  <EmailIcon size={24} round />
                  <span className="text-sm font-medium">Email</span>
                </div>
              </EmailShareButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;
