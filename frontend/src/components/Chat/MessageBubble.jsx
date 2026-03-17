// ──────────────────────────────────────────
// MessageBubble — dark futurism message bubble with feedback
// ─────────────────────────────────────────-
import { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { submitFeedback } from '@/utils/api';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackBurst, setFeedbackBurst] = useState(null); // 'up' | 'down' | null

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
    const score = newFeedback === 'up' ? 1 : 0; // API score (only used if not null)

    setFeedbackLoading(true);

    // Trigger burst only on positive/negative action (not removal)
    if (newFeedback) {
      setFeedbackBurst(type);
      setTimeout(() => setFeedbackBurst(null), 700); // Clear after animation
    }

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

  // Generate 8 particles for the burst effect
  const renderParticles = (type) => {
    if (feedbackBurst !== type) return null;
    const colorClass = type === 'up' ? 'bg-emerald-400' : 'bg-rose-400';
    return Array.from({ length: 8 }).map((_, i) => {
      const angle = (i * 45 * Math.PI) / 180;
      const tx = Math.cos(angle) * 24; // Distance
      const ty = Math.sin(angle) * 24;
      return (
        <motion.span
          key={i}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          animate={{ opacity: 0, scale: 0, x: tx, y: ty }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={clsx('particle', colorClass)}
        />
      );
    });
  };

  return (
    <div
      className={clsx(
        'flex gap-2 px-2 sm:px-6 py-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Avatar — assistant */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden
                        border border-mustard-500/20 mt-0.5">
          <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Bubble */}
      <motion.div
        className={clsx(
          'max-w-[80vw] sm:max-w-[75%] lg:max-w-[60%] rounded-2xl relative transition-all duration-500',
          isUser
            ? 'bg-mustard-500/[0.12] border border-mustard-500/20 text-cream px-4 py-3 rounded-br-md'
            : 'bg-white/[0.025] border border-white/[0.06] px-4 py-3 rounded-bl-md',
          // Color bleed effect
          !isUser && feedback === 'up' && 'message-bubble-up',
          !isUser && feedback === 'down' && 'message-bubble-down'
        )}
      >
        {/* Content */}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="message-content text-sm text-cream/85">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Bottom bar — assistant only */}
        {!isUser && (
          <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-white/[0.05]">
            {/* Retry button for error messages */}
            {isErrorMessage && (
              <button
                onClick={handleRetry}
                disabled={!lastUserQuery}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'bg-mustard-500/15 text-mustard-400 hover:bg-mustard-500/25'
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}

            <div className="flex-1" />

            {/* AI disclaimer */}
            <span className="text-2xs text-mist/60 italic">
              AI-generated; verify critical info.
            </span>

            {/* ── Feedback buttons ── */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-1"
            >
              <div className="relative">
                <button
                  onClick={() => handleFeedback('up')}
                  disabled={feedbackLoading}
                  className={clsx(
                    'feedback-btn group relative p-1.5 rounded-lg transition-all duration-300',
                    feedback === 'up'
                      ? 'bg-emerald-500/15 text-emerald-400 feedback-active'
                      : 'text-mist/50 hover:text-emerald-400 hover:bg-emerald-500/[0.08]',
                    feedbackLoading && 'opacity-50 cursor-not-allowed',
                  )}
                  title="Helpful answer"
                >
                  <ThumbsUp
                    className={clsx(
                      'w-3.5 h-3.5 transition-transform duration-300',
                      feedback === 'up' && 'feedback-pop',
                    )}
                    fill={feedback === 'up' ? 'currentColor' : 'none'}
                    strokeWidth={feedback === 'up' ? 0 : 2}
                  />
                  {/* Particles */}
                  {renderParticles('up')}

                  {/* Ripple ring on active */}
                  <AnimatePresence>
                    {feedback === 'up' && (
                      <motion.span
                        initial={{ opacity: 0.7, scale: 0.85 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-0 rounded-lg border border-emerald-400/40"
                      />
                    )}
                  </AnimatePresence>
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => handleFeedback('down')}
                  disabled={feedbackLoading}
                  className={clsx(
                    'feedback-btn group relative p-1.5 rounded-lg transition-all duration-300',
                    feedback === 'down'
                      ? 'bg-rose-500/15 text-rose-400 feedback-active'
                      : 'text-mist/50 hover:text-rose-400 hover:bg-rose-500/[0.08]',
                    feedbackLoading && 'opacity-50 cursor-not-allowed',
                  )}
                  title="Unhelpful answer"
                >
                  <ThumbsDown
                    className={clsx(
                      'w-3.5 h-3.5 transition-transform duration-300',
                      feedback === 'down' && 'feedback-pop',
                    )}
                    fill={feedback === 'down' ? 'currentColor' : 'none'}
                    strokeWidth={feedback === 'down' ? 0 : 2}
                  />
                  {/* Particles */}
                  {renderParticles('down')}

                  {/* Ripple ring on active */}
                  <AnimatePresence>
                    {feedback === 'down' && (
                      <motion.span
                        initial={{ opacity: 0.7, scale: 0.85 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-0 rounded-lg border border-rose-400/40"
                      />
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>

            {/* Divider between feedback and copy */}
            <div className="w-px h-4 bg-white/[0.06]" />

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg hover:bg-white/[0.05] text-ash hover:text-cream transition-all duration-300"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-mustard-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Timestamp */}
            <span className="text-2xs text-mist/60">
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
        )}
      </motion.div>

      {/* Avatar — user */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08]
                        flex items-center justify-center mt-0.5">
          <User className="w-4 h-4 text-ash" />
        </div>
      )}
    </div>
  );
}

export default memo(MessageBubble);
