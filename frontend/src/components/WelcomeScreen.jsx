import React, { useEffect, useRef, useState } from 'react';
import { Share2, Upload, Zap, Shield, Cloud, ArrowRight, MessageCircle, HardDrive } from 'lucide-react';
import RickrollModal from './RickrollModal';
import AmbientBackground from './AmbientBackground';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const WelcomeScreen = ({ onGetStarted }) => {
  const [showRickroll, setShowRickroll] = useState(false);
  const konamiIdxRef = useRef(0);
  const rickTypingRef = useRef('');

  // Secret rickroll triggers: Konami code OR typing "rick".
  useEffect(() => {
    const onKey = (e) => {
      // Konami
      const expected = KONAMI[konamiIdxRef.current];
      if (e.key === expected || e.key.toLowerCase() === expected) {
        konamiIdxRef.current += 1;
        if (konamiIdxRef.current >= KONAMI.length) {
          konamiIdxRef.current = 0;
          setShowRickroll(true);
          return;
        }
      } else {
        konamiIdxRef.current = e.key === KONAMI[0] ? 1 : 0;
      }

      // Type "rick"
      if (/^[a-z]$/i.test(e.key)) {
        rickTypingRef.current = (rickTypingRef.current + e.key.toLowerCase()).slice(-4);
        if (rickTypingRef.current === 'rick') {
          rickTypingRef.current = '';
          setShowRickroll(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="dark fixed inset-0 overflow-hidden text-white">
        <AmbientBackground />

        {/* Main content */}
        <div className="relative min-h-screen flex items-center justify-center p-6">
          <div className="max-w-5xl w-full">
            {/* Hero */}
            <div className="text-center mb-14 welcome-stagger" style={{ animationDelay: '50ms' }}>
              <div className="inline-flex items-center justify-center mb-7">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/40 blur-2xl rounded-full" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-2xl flex items-center justify-center ring-1 ring-white/20">
                    <Share2 className="w-12 h-12 text-white drop-shadow" />
                  </div>
                  <Zap className="w-6 h-6 text-yellow-300 absolute -top-1 -right-1 drop-shadow animate-zip" />
                </div>
              </div>

              <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-5 leading-[0.95]">
                <span className="bg-gradient-to-r from-blue-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                  UniShare
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-slate-200/90 font-light max-w-2xl mx-auto">
                Move files between devices the way they were meant to move &mdash;
                <span className="text-white font-medium"> instantly, privately, anywhere</span>.
              </p>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-300/80 flex-wrap">
                <PillStat icon={<Zap className="w-3.5 h-3.5" />} label="P2P WebRTC" />
                <span className="text-slate-600">·</span>
                <PillStat icon={<Cloud className="w-3.5 h-3.5" />} label="Cloud" />
                <span className="text-slate-600">·</span>
                <PillStat icon={<HardDrive className="w-3.5 h-3.5" />} label="Google Drive" />
                <span className="text-slate-600">·</span>
                <PillStat icon={<MessageCircle className="w-3.5 h-3.5" />} label="Live Chat" />
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid md:grid-cols-3 gap-5 mb-12">
              <FeatureCard
                icon={<Upload className="w-6 h-6" />}
                title="Upload anything"
                description="Drag, drop, import from Drive, or stream multi-GB files directly between tabs."
                delay={250}
              />
              <FeatureCard
                icon={<Zap className="w-6 h-6" />}
                title="Lightning P2P"
                description="WebRTC + BroadcastChannel for same-network speeds. Receiver streams straight to disk."
                delay={400}
              />
              <FeatureCard
                icon={<Shield className="w-6 h-6" />}
                title="Yours, encrypted"
                description="Per-file Fernet keys, RSA-wrapped. Guest data wipes itself when you leave."
                delay={550}
              />
            </div>

            {/* CTA */}
            <div className="text-center welcome-stagger" style={{ animationDelay: '700ms' }}>
              <button
                onClick={onGetStarted}
                className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-semibold text-lg text-white shadow-2xl transition-all duration-300 hover:scale-[1.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/50"
              >
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 shadow-[0_10px_60px_-15px_rgba(99,102,241,0.7)]" />
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative">Enter UniShare</span>
                <ArrowRight className="relative w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>

              <p className="mt-5 text-slate-400 text-sm">
                No signup required &middot; Guest mode wipes itself when you leave
              </p>
              <p className="mt-1 text-slate-600 text-[11px] tracking-wider uppercase">
                Try the Konami code if you&rsquo;re bored
              </p>
            </div>
          </div>
        </div>
      </div>

      <RickrollModal isOpen={showRickroll} onClose={() => setShowRickroll(false)} />

      <style>{`
        @keyframes welcomeStaggerIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .welcome-stagger {
          opacity: 0;
          animation: welcomeStaggerIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes zip {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.2) rotate(8deg); }
        }
        .animate-zip { animation: zip 2.4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .welcome-stagger, .animate-zip { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </>
  );
};

const PillStat = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/60 border border-white/10">
    <span className="text-blue-300">{icon}</span>
    <span className="text-slate-200">{label}</span>
  </span>
);

// No backdrop-blur — that triggers a full-page composite on every paint, killing perf on weak GPUs.
const FeatureCard = ({ icon, title, description, delay = 0 }) => (
  <div
    className="welcome-stagger group relative rounded-2xl p-6 bg-slate-800/50 border border-white/10 hover:bg-slate-800/70 hover:border-white/20 transition-colors duration-300"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 text-blue-200 mb-4 ring-1 ring-inset ring-white/10">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-1.5">{title}</h3>
    <p className="text-sm text-slate-300/80 leading-relaxed">{description}</p>
  </div>
);

export default WelcomeScreen;
