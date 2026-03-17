// ──────────────────────────────────────────
// ThinkingAnimation — simple, smooth pre-answer loader
// ──────────────────────────────────────────
import { memo } from 'react';
import { motion } from 'framer-motion';

function ThinkingAnimation() {
    return (
        <motion.div
            className="flex gap-2 sm:gap-3 px-2 sm:px-6 py-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
        >
            {/* Avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-mustard-500/20 mt-0.5">
                <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
            </div>

            {/* Processing Bubble */}
            <div className="thinking-bubble">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <span className="processing-dot" />
                        <span className="processing-dot processing-dot--delay" />
                        <span className="processing-dot processing-dot--delay2" />
                    </div>
                    <span className="thinking-label text-cream/85">
                        Processing
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

export default memo(ThinkingAnimation);
