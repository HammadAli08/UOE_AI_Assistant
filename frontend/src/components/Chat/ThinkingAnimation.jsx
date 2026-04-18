// ──────────────────────────────────────────
// ThinkingAnimation — minimal three-dot bounce (iMessage/ChatGPT style)
// ──────────────────────────────────────────
import { memo } from 'react';
import { motion } from 'framer-motion';

function ThinkingAnimation() {
  return (
    <motion.div
      className="flex items-center gap-2 px-2 sm:px-6 py-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* Avatar — matches assistant message style */}
      <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
        <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
      </div>

      {/* Three dots */}
      <div className="flex items-center gap-1 pl-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="think-dot"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default memo(ThinkingAnimation);
