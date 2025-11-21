import React, { useEffect, useRef, useState } from 'react';
import { X, Volume2 } from 'lucide-react';

const RickrollModal = ({ isOpen, onClose }) => {
  const iframeRef = useRef(null);
  const [videoKey, setVideoKey] = useState(0);

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Force iframe reload with new key to ensure autoplay
      setVideoKey(prev => prev + 1);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-6 h-6 text-white animate-pulse" />
              <h2 className="text-2xl font-bold text-white">
                🎵 Never Gonna Give You Up! 🎵
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors duration-200"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-white/90 mt-2">
            You've been rickrolled! 😄
          </p>
        </div>

        {/* Video Container */}
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          <iframe
            key={videoKey}
            ref={iframeRef}
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0&rel=0&controls=1&modestbranding=1&start=0&enablejsapi=1&origin=${window.location.origin}`}
            title="Rick Astley - Never Gonna Give You Up"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>

        {/* Footer */}
        <div className="p-6 bg-black/20">
          <div className="text-center space-y-2">
            <p className="text-white/80 text-sm">
              🎤 Classic rickroll - never gets old! 🕺
            </p>
            <div className="flex justify-center gap-4 text-white/60 text-xs">
              <span>👁️ 1.4B+ views</span>
              <span>•</span>
              <span>❤️ Internet Legend</span>
              <span>•</span>
              <span>🎵 Since 1987</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RickrollModal;
