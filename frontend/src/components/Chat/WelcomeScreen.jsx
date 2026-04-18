// ──────────────────────────────────────────
// WelcomeScreen — clean, humanized welcome with suggestions
// ──────────────────────────────────────────
import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { SUGGESTIONS, NAMESPACES } from '@/constants';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function SuggestionCard({ question, index, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      className="text-left px-4 py-3.5 rounded-xl
                 bg-surface-2 border border-surface-border
                 text-[0.9375rem] text-ash leading-relaxed
                 hover:text-textWhite hover:border-surface-border-hover hover:bg-surface-3
                 transition-colors duration-200"
    >
      {question}
    </motion.button>
  );
}

function WelcomeScreen({ onSuggestionClick }) {
  const namespace = useChatStore((s) => s.namespace);
  const setNamespace = useChatStore((s) => s.setNamespace);
  const suggestions = SUGGESTIONS[namespace] || SUGGESTIONS['bs-adp'];
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="w-full flex flex-col items-center justify-center px-6 pt-8 pb-36 md:pt-10 md:pb-10">
      {/* Logo — static, no floating */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-12 h-12 rounded-xl overflow-hidden mb-6"
      >
        <img
          src="/unnamed.jpg"
          alt="University of Education"
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Time-based greeting */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-sm text-mist tracking-wide uppercase mb-3"
      >
        {greeting}
      </motion.p>

      {/* Headline — sentence case, humanized */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className="font-display text-2xl sm:text-3xl font-semibold
                   text-textWhite text-center mb-4 tracking-tight"
      >
        How can I help you today?
      </motion.h2>

      {/* Namespace Selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap justify-center gap-2.5 mb-10 max-w-2xl mx-auto"
      >
        {NAMESPACES.map((ns) => {
          const Icon = ns.icon;
          const isActive = ns.id === namespace;
          return (
            <button
              key={ns.id}
              onClick={() => setNamespace(ns.id)}
              className={clsx(
                'group inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 active:scale-[0.98]',
                isActive
                  ? 'bg-surface-3 border border-mustard-500/30 text-textWhite shadow-[0_0_12px_rgba(200,185,74,0.15)] ring-1 ring-mustard-500/20'
                  : 'bg-surface-2 border border-surface-border text-ash hover:text-textWhite hover:bg-surface-3 hover:border-surface-border-hover'
              )}
            >
              <Icon className={clsx(
                "w-3.5 h-3.5 transition-colors duration-300", 
                isActive ? "text-gold" : "text-mist group-hover:text-gold/70"
              )} />
              {ns.label}
            </button>
          );
        })}
      </motion.div>

      {/* Suggestion cards */}
      <div className="w-full max-w-2xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-2 text-xs text-mist mb-4 justify-center"
        >
          <Sparkles className="w-3.5 h-3.5 text-gold/60" />
          Suggestions
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
