// ──────────────────────────────────────────
// MessageBubble — dark cinematic message bubble
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import SmartBadge from '@/components/SmartRAG/SmartBadge';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const hasSmartInfo = message.smartInfo != null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div
      className={clsx(
        'flex gap-2 px-2 sm:px-6 py-3 animate-slide-up',
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
      <div
        className={clsx(
          'max-w-[80vw] sm:max-w-[75%] lg:max-w-[60%] rounded-2xl',
          isUser
            ? 'bg-mustard-500/[0.12] border border-mustard-500/20 text-cream px-4 py-3 rounded-br-md'
            : 'bg-white/[0.025] border border-white/[0.06] px-4 py-3 rounded-bl-md'
        )}
      >
        {/* Enhanced query indicator */}
        {!isUser && message.enhancedQuery && (
          <p className="text-2xs text-mist mb-2 italic">
            🔍 Enhanced: &ldquo;{message.enhancedQuery}&rdquo;
          </p>
        )}

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
            {/* Smart RAG badge */}
            {hasSmartInfo && <SmartBadge smartInfo={message.smartInfo} />}

            <div className="flex-1" />

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg hover:bg-white/[0.05] text-mist hover:text-cream transition-all duration-300"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-mustard-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Timestamp */}
            <span className="text-2xs text-mist/60">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

      </div>

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
