// ──────────────────────────────────────────
// StreamingBubble — flat assistant message during streaming
// ──────────────────────────────────────────
import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="px-2 sm:px-6 py-3"
    >
      {/* Avatar + label row — matches MessageBubble */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
          <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs font-medium text-mist">UOE AI</span>
      </div>

      {/* Content — flat, unboxed, with cursor */}
      <div className="message-content text-[0.9375rem] leading-[1.7] text-cream/90 pl-8 overflow-x-auto streaming-cursor">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {(displayed || content || '').replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}

export default memo(StreamingBubble);
