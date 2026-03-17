// ──────────────────────────────────────────
// StreamingBubble — displays content as it streams in (dark futurism theme)
// ─────────────────────────────────────────-
import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function StreamingBubble({ content }) {
  const [displayed, setDisplayed] = useState('');
  const queueRef = useRef('');
  const rafRef = useRef(null);
  const lastContentRef = useRef('');

  // Push new incoming content into the queue
  useEffect(() => {
    if (content && content !== lastContentRef.current) {
      const newText = content.slice(lastContentRef.current.length);
      queueRef.current += newText;
      lastContentRef.current = content;
    }
  }, [content]);

  // Drain queue using requestAnimationFrame for smoothness
  useEffect(() => {
    const step = () => {
      const q = queueRef.current;
      if (q.length > 0) {
        // Dynamic pacing: speed up if queue is long
        const batch =
          q.length > 120 ? 6 :
          q.length > 60  ? 4 :
          q.length > 20  ? 2 : 1;

        const slice = q.slice(0, batch);
        queueRef.current = q.slice(batch);
        setDisplayed((prev) => prev + slice);
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Reset when stream clears
  useEffect(() => {
    if (!content) {
      queueRef.current = '';
      lastContentRef.current = '';
      setDisplayed('');
    }
  }, [content]);

  if (!content && !displayed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 px-4 sm:px-6 py-4"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden
                      border border-mustard-500/20 mt-0.5 shadow-glow-sm">
        <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
      </div>
      <motion.div
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(200, 185, 74, 0)',
            '0 0 8px 1px rgba(200, 185, 74, 0.15)',
            '0 0 0 0 rgba(200, 185, 74, 0)',
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]
                   bg-white/[0.025] border border-white/[0.06]
                   border-l-[3px] border-l-mustard-500/30
                   rounded-2xl rounded-bl-md px-5 py-3.5 min-h-[64px]"
      >
        <div className="message-content text-sm text-cream/85 streaming-cursor mask-sweep-reveal">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayed || content}
          </ReactMarkdown>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default memo(StreamingBubble);
