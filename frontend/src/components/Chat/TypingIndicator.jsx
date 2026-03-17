// ──────────────────────────────────────────
// TypingIndicator — dark cinematic theme
// ─────────────────────────────────────────-
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

// Orbit dots component
function OrbitDots({ color }) {
  return (
    <div className="relative w-6 h-6">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: color,
            top: '50%',
            left: '50%',
            marginTop: '-3px',
            marginLeft: '-3px',
          }}
          animate={{
            rotate: 360,
            translateX: 10,
            translateY: 0,
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'linear',
            delay: i * -0.83,
          }}
        />
      ))}
    </div>
  );
}

// Progress bar component
function ProgressBar({ progress, color }) {
  return (
    <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="h-full"
        style={{ backgroundColor: color }}
        initial={{ width: '0%' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

function TypingIndicator({ mode = 'standard' }) {
  const phaseColor = mode === 'agentic' ? '#A78BFA' : '#C8B94A';
  const labelText = mode === 'agentic' ? 'Analyzing your question...' : 'Thinking...';
  const progress = mode === 'agentic' ? 25 : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 px-4 sm:px-6 py-4"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden
                      border border-white/[0.06]">
        <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
      </div>
      <div
        className="bg-white/[0.02] border border-white/[0.06]
                     rounded-2xl rounded-bl-md px-5 py-4"
        style={{
          borderLeftColor: `${phaseColor}66`,
          borderLeftWidth: '3px',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Icon container with orbit */}
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <Brain className="w-4 h-4" style={{ color: phaseColor }} />
            </motion.div>
            {/* Orbit dots */}
            <OrbitDots color={phaseColor} />
          </div>

          {/* Wave dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: phaseColor }}
                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>

          {/* Shimmer text */}
          <span
            className="text-xs font-medium tracking-wide"
            style={{
              background: `linear-gradient(90deg, rgba(139, 153, 181, 0.6) 0%, ${phaseColor}cc 50%, rgba(139, 153, 181, 0.6) 100%)`,
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 2.5s linear infinite',
            }}
          >
            {labelText}
          </span>
        </div>

        {/* Progress indicator */}
        <div className="mt-3">
          <ProgressBar progress={progress} color={phaseColor} />
        </div>
      </div>
    </motion.div>
  );
}

export default memo(TypingIndicator);
