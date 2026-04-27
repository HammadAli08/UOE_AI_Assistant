// ──────────────────────────────────────────
// MessageBubble — production-grade chat message
// ──────────────────────────────────────────
import { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion } from 'framer-motion';
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { submitFeedback } from '@/utils/api';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Detect if this is an error message
  const isErrorMessage = !isUser && message.content.includes('Sorry, I encountered an error');

  const feedback = useChatStore((s) => s.feedbackMap[message.id]);
  const setFeedback = useChatStore((s) => s.setFeedback);
  const lastUserQuery = useChatStore((s) => s.lastUserQuery);
  const setDraftInput = useChatStore((s) => s.setDraftInput);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // Handle retry — populate the chat input with the last query
  const handleRetry = useCallback(() => {
    if (!lastUserQuery) return;
    setDraftInput(lastUserQuery);
  }, [lastUserQuery, setDraftInput]);

  const handleFeedback = useCallback(async (type) => {
    if (feedbackLoading) return;

    // Toggle logic: click same = remove vote; click different = switch vote
    const newFeedback = feedback === type ? null : type;
    const score = newFeedback === 'up' ? 1 : 0;

    setFeedbackLoading(true);

    try {
      // Optimistic update
      setFeedback(message.id, newFeedback);

      if (message.runId && newFeedback) {
        await submitFeedback({ runId: message.runId, score });
      }
    } catch (err) {
      console.warn('Feedback submission failed:', err.message);
    } finally {
      setFeedbackLoading(false);
    }
  }, [feedback, feedbackLoading, message.id, message.runId, setFeedback]);

  // ── User message ──
  if (isUser) {
    return (
      <div className="flex justify-end px-2 sm:px-6 py-2">
        <div
          className="max-w-[680px] rounded-2xl rounded-br-lg
                     bg-surface-3 px-4 py-2.5"
        >
          <p className="text-[0.9375rem] leading-[1.7] text-textWhite whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // ── Assistant message (flat, unboxed) ──
  return (
    <div className="px-2 sm:px-6 py-3">
      {/* Avatar + label row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
          <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs font-medium text-mist">UOE AI</span>
      </div>

      {/* Content — no box, no border */}
      <div className="message-content text-[0.9375rem] leading-[1.7] text-cream/90 pl-8 overflow-x-auto">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {message.content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')}
        </ReactMarkdown>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mt-2.5 pl-8">
        {/* Retry button for error messages */}
        {isErrorMessage && (
          <button
            onClick={handleRetry}
            disabled={!lastUserQuery}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-surface-3 text-gold hover:bg-surface-border/50',
              'transition-colors duration-200'
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}

        <div className="flex-1" />

        {/* AI disclaimer */}
        <span className="text-2xs text-mist/50 italic hidden sm:inline">
          AI-generated · verify critical info
        </span>

        {/* Feedback buttons — simple icon toggles */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleFeedback('up')}
            disabled={feedbackLoading}
            className={clsx(
              'p-1.5 rounded-md transition-colors duration-200',
              feedback === 'up'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-mist/40 hover:text-emerald-400 hover:bg-emerald-500/[0.06]',
              feedbackLoading && 'opacity-50 cursor-not-allowed',
            )}
            title="Helpful answer"
          >
            <ThumbsUp
              className="w-3.5 h-3.5"
              fill={feedback === 'up' ? 'currentColor' : 'none'}
              strokeWidth={feedback === 'up' ? 0 : 2}
            />
          </button>

          <button
            onClick={() => handleFeedback('down')}
            disabled={feedbackLoading}
            className={clsx(
              'p-1.5 rounded-md transition-colors duration-200',
              feedback === 'down'
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-mist/40 hover:text-rose-400 hover:bg-rose-500/[0.06]',
              feedbackLoading && 'opacity-50 cursor-not-allowed',
            )}
            title="Unhelpful answer"
          >
            <ThumbsDown
              className="w-3.5 h-3.5"
              fill={feedback === 'down' ? 'currentColor' : 'none'}
              strokeWidth={feedback === 'down' ? 0 : 2}
            />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-3.5 bg-surface-border" />

        {/* Copy */}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-mist/40 hover:text-cream hover:bg-surface-3 transition-colors duration-200"
          title="Copy response"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-gold" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Timestamp */}
        <span className="text-2xs text-mist/40">
          {(() => {
            try {
              const d = new Date(message.timestamp || message.created_at);
              if (isNaN(d.valueOf())) return '';
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
              return '';
            }
          })()}
        </span>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
