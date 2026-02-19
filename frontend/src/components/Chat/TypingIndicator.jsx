// ──────────────────────────────────────────
// TypingIndicator — animated dots while streaming
// ──────────────────────────────────────────
import { memo } from 'react';
// Logo used as avatar instead of Bot icon

function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 sm:px-6 py-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden
                      border border-mustard-500/20">
        <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
      </div>
      <div className="bg-white/[0.025] border border-white/[0.06]
                      rounded-2xl rounded-bl-md px-5 py-4">
        <div className="flex items-center gap-1.5">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

export default memo(TypingIndicator);
