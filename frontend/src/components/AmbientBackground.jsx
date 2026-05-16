import React, { useEffect, useRef } from 'react';

const FILE_GLYPHS = ['📄', '🖼️', '🎬', '🎵', '📊', '📝', '🎨', '📦', '📁', '📑', '🗂️', '💾'];

/**
 * Fixed full-viewport ambient layer:
 *  - static layered gradient (theme-aware)
 *  - subtle grid overlay
 *  - canvas particle drift (file-type glyphs)
 *  - radial vignette
 *
 * Cheap: DPR clamped to 1, no shadowBlur, 30fps cap, ~24 particles max,
 * pauses when tab is hidden, honors prefers-reduced-motion. Mount anywhere
 * that you want the brand background to show.
 */
const AmbientBackground = ({ density = 'normal' }) => {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = 1; // emojis don't need 2x; halves fill cost

    let width = 0;
    let height = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * DPR;
      canvas.height = height * DPR;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const PER_PX = density === 'sparse' ? 90000 : 60000;
    const MAX = density === 'sparse' ? 16 : 24;
    const COUNT = reducedMotion ? 0 : Math.min(MAX, Math.max(8, Math.floor((width * height) / PER_PX)));

    const particles = Array.from({ length: COUNT }, () => {
      const depth = Math.random();
      return {
        glyph: FILE_GLYPHS[Math.floor(Math.random() * FILE_GLYPHS.length)],
        x: Math.random() * width,
        y: Math.random() * height,
        size: 18 + depth * 30,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.04 - depth * 0.12,
        // Base alpha; multiplied per-frame by theme factor below
        alpha: 0.12 + depth * 0.3,
      };
    });

    // Light mode needs brighter particles to be visible on pastel bg.
    // Dark mode keeps them subtle so they don't overpower content.
    const isDark = () => document.documentElement.classList.contains('dark');

    const FRAME_MS = 1000 / 60;
    let last = performance.now();
    let acc = 0;

    const tick = (now) => {
      animFrameRef.current = requestAnimationFrame(tick);
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc < FRAME_MS) return;
      const step = Math.min(acc, FRAME_MS * 2);
      acc = 0;

      ctx.clearRect(0, 0, width, height);

      // Recompute per-frame so theme toggles take effect immediately.
      const dark = isDark();
      const alphaMul = dark ? 0.7 : 1.7;
      // Subtle glow — small shadowBlur stays in GPU-accelerated fast path on Skia.
      const glowColor = dark ? 'rgba(129, 140, 248, 0.85)' : 'rgba(59, 130, 246, 0.55)';
      const glowBlur = dark ? 6 : 8;

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glowBlur;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * step;
        p.y += p.vy * step;

        if (p.y < -80) {
          p.y = height + 60;
          p.x = Math.random() * width;
        }
        if (p.x < -80) p.x = width + 60;
        else if (p.x > width + 80) p.x = -60;

        ctx.globalAlpha = Math.min(1, p.alpha * alphaMul);
        ctx.font = `${p.size}px "Segoe UI Emoji","Apple Color Emoji",emoji`;
        ctx.fillText(p.glyph, p.x, p.y);
      }

      // Reset shadow so it doesn't leak to next clear.
      ctx.shadowBlur = 0;
    };
    animFrameRef.current = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        last = performance.now();
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <div className="absolute inset-0 ambient-bg" />
      <div className="absolute inset-0 ambient-grid opacity-[0.05]" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 ambient-vignette" />

      <style>{`
        /* Light mode: richer pastel gradient with stronger radial color accents — not blinding white. */
        .ambient-bg {
          background:
            radial-gradient(50rem 36rem at 10% 0%, rgba(59, 130, 246, 0.38), transparent 65%),
            radial-gradient(46rem 36rem at 95% 30%, rgba(168, 85, 247, 0.30), transparent 65%),
            radial-gradient(50rem 38rem at 80% 100%, rgba(236, 72, 153, 0.22), transparent 65%),
            radial-gradient(46rem 36rem at 20% 95%, rgba(34, 211, 238, 0.28), transparent 65%),
            linear-gradient(135deg, #dbeafe 0%, #e0e7ff 35%, #ede9fe 70%, #fce7f3 100%);
        }
        /* Dark mode: deep slate/indigo base with bolder vibrant accents. */
        .dark .ambient-bg {
          background:
            radial-gradient(50rem 36rem at 10% 0%, rgba(59, 130, 246, 0.40), transparent 60%),
            radial-gradient(46rem 36rem at 95% 30%, rgba(168, 85, 247, 0.36), transparent 60%),
            radial-gradient(50rem 38rem at 80% 100%, rgba(236, 72, 153, 0.25), transparent 60%),
            radial-gradient(46rem 36rem at 20% 95%, rgba(20, 184, 166, 0.22), transparent 60%),
            linear-gradient(135deg, #020617 0%, #1e1b4b 45%, #312e81 75%, #0f172a 100%);
        }

        .ambient-grid {
          background-image:
            linear-gradient(rgba(15,23,42,0.45) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.45) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
        }
        .dark .ambient-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px);
        }

        /* Slight tinted vignette to soften edges without washing colors out. */
        .ambient-vignette {
          background: radial-gradient(ellipse at center, transparent 55%, rgba(99, 102, 241, 0.18) 100%);
        }
        .dark .ambient-vignette {
          background: radial-gradient(ellipse at center, transparent 55%, rgba(2, 6, 23, 0.85) 100%);
        }
      `}</style>
    </div>
  );
};

export default AmbientBackground;
