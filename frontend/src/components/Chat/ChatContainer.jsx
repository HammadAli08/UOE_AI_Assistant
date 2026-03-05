// ──────────────────────────────────────────
// ChatContainer — scrollable message list with AnimatePresence
// ──────────────────────────────────────────
import { useEffect, useRef, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useChatStore from '@/store/useChatStore';
import MessageBubble from './MessageBubble';
import StreamingBubble from './StreamingBubble';
import ThinkingAnimation from './ThinkingAnimation';
import WelcomeScreen from './WelcomeScreen';


function ChatContainer({ onSuggestionClick }) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const enableSmart = useChatStore((s) => s.settings.enableSmart);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    const container = document.getElementById('messages');
    if (container) {
      if (isStreaming) {
        // Instant during streaming — batched smooth calls stack up and cause jank on mobile
        container.scrollTop = container.scrollHeight;
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, streamingContent, isStreaming]);

  // Keyboard-aware scroll for mobile: snap to bottom when keyboard opens/closes
  useEffect(() => {
    if (!window.visualViewport) return;
    const scrollToBottom = () => {
      setTimeout(() => {
        const container = document.getElementById('messages');
        if (container) container.scrollTop = container.scrollHeight;
      }, 150);
    };
    window.visualViewport.addEventListener('resize', scrollToBottom);
    return () => window.visualViewport.removeEventListener('resize', scrollToBottom);
  }, []);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y flex flex-col md:justify-center">
        <WelcomeScreen onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Scrollable message area */}
      <div id="messages" className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-2 sm:px-4 pb-36 md:pb-6 pt-4 space-y-3 overflow-anchor-none">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{
                  type: 'spring',
                  stiffness: 80,
                  damping: 18,
                }}
              >
                <MessageBubble message={msg} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming content with fade-in + slide-up */}
          {isStreaming && streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="streaming-glow"
            >
              <StreamingBubble content={streamingContent} />
            </motion.div>
          )}

          {/* Thinking animation — plays before streaming */}
          <AnimatePresence mode="wait">
            {isStreaming && !streamingContent && (
              <ThinkingAnimation mode={enableSmart ? 'smart' : 'standard'} />
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom gradient fade — overlay, doesn't affect layout */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-navy-950 to-transparent pointer-events-none z-10" />
    </div>
  );
}

export default memo(ChatContainer);
