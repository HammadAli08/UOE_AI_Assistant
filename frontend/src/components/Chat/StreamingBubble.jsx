// ──────────────────────────────────────────
// StreamingBubble — displays content as it streams in
// ──────────────────────────────────────────
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function StreamingBubble({ content }) {
  if (!content) return null;

  return (
    <div className="flex gap-3 px-4 sm:px-6 py-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden
                      border border-mustard-500/20 mt-0.5">
        <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
      </div>
      <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]
                      bg-white/[0.025] border border-white/[0.06]
                      border-l-[3px] border-l-mustard-500/30
                      rounded-2xl rounded-bl-md px-5 py-3.5">
        <div className="message-content text-sm text-cream/85 streaming-cursor">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default memo(StreamingBubble);
