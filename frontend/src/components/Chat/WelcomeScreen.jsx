// ──────────────────────────────────────────
// WelcomeScreen — dark cinematic welcome with suggestions
// ──────────────────────────────────────────
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import useChatStore from '@/store/useChatStore';
import { SUGGESTIONS, NAMESPACES } from '@/constants';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Radial gradient that follows mouse
function SuggestionCard({ question, index, onClick }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.button
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPosition({ x: -1000, y: -1000 })}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="group relative text-left px-5 py-4 rounded-xl
                 border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm
                 text-sm text-ash leading-relaxed
                 hover:text-cream hover:border-mustard-500/25 hover:bg-white/[0.04]
                 hover:scale-[1.02] hover:pl-6
                 transition-all duration-500 overflow-hidden"
      style={{
        background: `radial-gradient(800px circle at ${position.x}px ${position.y}px, rgba(200,185,74,0.06), transparent 40%)`,
      }}
    >
      <span className="inline-block w-0 group-hover:w-2 h-px bg-mustard-500/60 mr-0 group-hover:mr-2 transition-all duration-300 align-middle" />
      {question}
    </motion.button>
  );
}

function WelcomeScreen({ onSuggestionClick }) {
  const namespace = useChatStore((s) => s.namespace);
  const suggestions = SUGGESTIONS[namespace] || SUGGESTIONS['bs-adp'];
  const currentNs = NAMESPACES.find((n) => n.id === namespace);
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
      {/* Subtle ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[420px] h-[260px]
                   rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.05) 0%, transparent 70%)' }}
      />

      {/* Floating logo with animation */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-24 h-24 rounded-2xl flex items-center justify-center mb-9"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        >
          <img
            src="/unnamed.jpg"
            alt="University of Education"
            className="w-full h-full object-cover rounded-2xl drop-shadow-[0_0_24px_rgba(200,185,74,0.1)]"
          />
        </motion.div>
        <div className="absolute inset-0 rounded-2xl bg-mustard-500/[0.04] blur-xl" />
      </motion.div>

      {/* Time-based greeting with slide-up */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-sm text-mist/80 tracking-[0.2em] uppercase mb-3"
      >
        {greeting}
      </motion.p>

      {/* Headline */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight
                       text-cream text-center mb-4"
      >
        HOW CAN I <span className="text-mustard-500">HELP?</span>
      </motion.h2>

      {/* Namespace badge */}
      {currentNs && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                     border border-white/[0.06] bg-white/[0.02]
                     text-xs font-medium text-ash mb-12"
        >
          {(() => { const Icon = currentNs.icon; return <Icon className="w-3.5 h-3.5 text-mustard-500/70" />; })()}
          {currentNs.label}
        </motion.span>
      )}

      {/* Suggestion cards */}
      <div className="w-full max-w-2xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 text-xs font-medium text-mist mb-5 justify-center uppercase tracking-[0.18em]"
        >
          <Sparkles className="w-3.5 h-3.5 text-mustard-500/50" />
          Suggested Questions
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((q, i) => (
            <SuggestionCard
              key={i}
              question={q}
              index={i}
              onClick={() => onSuggestionClick(q)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(WelcomeScreen);
