// ──────────────────────────────────────────
// WelcomeScreen — dark cinematic welcome with suggestions
// ──────────────────────────────────────────
import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import useChatStore from '@/store/useChatStore';
import { SUGGESTIONS, NAMESPACES } from '@/constants';

function WelcomeScreen({ onSuggestionClick }) {
  const namespace = useChatStore((s) => s.namespace);
  const suggestions = SUGGESTIONS[namespace] || SUGGESTIONS['bs-adp'];
  const currentNs = NAMESPACES.find((n) => n.id === namespace);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 animate-fade-in relative">
      {/* Subtle ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[420px] h-[260px]
                   rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.05) 0%, transparent 70%)' }}
      />

      {/* Floating logo */}
      <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center mb-9 animate-float">
        <img src="/unnamed.jpg" alt="University of Education" className="w-full h-full object-cover rounded-2xl drop-shadow-[0_0_24px_rgba(200,185,74,0.1)]" />
        <div className="absolute inset-0 rounded-2xl bg-mustard-500/[0.04] blur-xl" />
      </div>

      {/* Headline */}
      <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight
                      text-cream text-center mb-4">
        HOW CAN I <span className="text-mustard-500">HELP?</span>
      </h2>

      {/* Namespace badge */}
      {currentNs && (
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                         border border-white/[0.06] bg-white/[0.02]
                         text-xs font-medium text-ash mb-12">
          {currentNs.icon} {currentNs.label}
        </span>
      )}

      {/* Suggestion cards */}
      <div className="w-full max-w-2xl">
        <p className="flex items-center gap-2 text-xs font-medium text-mist mb-5 justify-center uppercase tracking-[0.18em]">
          <Sparkles className="w-3.5 h-3.5 text-mustard-500/50" />
          Suggested Questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(q)}
              className="text-left px-5 py-4 rounded-xl
                         border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm
                         text-sm text-ash leading-relaxed
                         hover:text-cream hover:border-mustard-500/20 hover:bg-white/[0.04]
                         transition-all duration-500 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(WelcomeScreen);
