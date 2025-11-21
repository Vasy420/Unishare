import React, { useState } from 'react';
import { Upload, Share2, Zap, Shield, Cloud, Music } from 'lucide-react';
import RickrollModal from './RickrollModal';

const WelcomeScreen = ({ onGetStarted }) => {
  const [showRickroll, setShowRickroll] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        {/* Main content */}
        <div className="relative min-h-screen flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
            {/* Hero section */}
            <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom duration-700">
              <div className="inline-flex items-center justify-center mb-6">
                <div className="relative">
                  <Share2 className="w-20 h-20 text-white drop-shadow-2xl" />
                  <Zap className="w-8 h-8 text-yellow-300 absolute -top-2 -right-2 animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-6xl md:text-7xl font-bold text-white mb-4 drop-shadow-2xl">
                Welcome to UniShare
              </h1>
              
              <p className="text-xl md:text-2xl text-white/90 mb-2 drop-shadow-lg">
                Share files instantly, anywhere, anytime
              </p>
              
              <p className="text-lg text-white/80 drop-shadow-lg">
                P2P • Cloud • Google Drive • All in one place
              </p>
            </div>

            {/* Features grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
              <FeatureCard
                icon={<Upload className="w-8 h-8" />}
                title="Easy Upload"
                description="Drag & drop files or pick from Google Drive"
              />
              <FeatureCard
                icon={<Zap className="w-8 h-8" />}
                title="Lightning Fast"
                description="P2P transfers for maximum speed"
              />
              <FeatureCard
                icon={<Shield className="w-8 h-8" />}
                title="Secure"
                description="Your files, your control, always"
              />
            </div>

            {/* CTA Button */}
            <div className="text-center animate-in fade-in slide-in-from-bottom duration-700 delay-500">
              <button
                onClick={onGetStarted}
                className="group relative inline-flex items-center gap-3 px-12 py-5 bg-white text-purple-600 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all duration-300"
              >
                <Cloud className="w-6 h-6 group-hover:animate-bounce" />
                Get Started
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </button>
              
              <p className="mt-4 text-white/70 text-sm">
                No signup required • Start sharing instantly
              </p>
            </div>
          </div>
        </div>

        {/* Easter Egg Button - Hidden in bottom right corner */}
        <button
          onClick={() => setShowRickroll(true)}
          className="fixed bottom-4 right-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 flex items-center justify-center group opacity-30 hover:opacity-100"
          title="🎵"
        >
          <Music className="w-5 h-5 text-white group-hover:animate-spin" />
        </button>
      </div>

      {/* Rickroll Modal */}
      <RickrollModal isOpen={showRickroll} onClose={() => setShowRickroll(false)} />

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -20px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(20px, 20px) scale(1.05); }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animate-in {
          animation: fadeInUp 0.7s ease-out forwards;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

const FeatureCard = ({ icon, title, description }) => {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center transform hover:scale-105 transition-all duration-300 hover:bg-white/20">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-4 text-white">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-white/80">{description}</p>
    </div>
  );
};

export default WelcomeScreen;
