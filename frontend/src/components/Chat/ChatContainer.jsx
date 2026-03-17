// ──────────────────────────────────────────
// ChatContainer — scrollable message list
// Pure top-to-bottom flow. Smart scroll only when content overflows.
// ──────────────────────────────────────────
import { useEffect, useRef, useCallback, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useChatStore from '@/store/useChatStore';
import MessageBubble from './MessageBubble';
import StreamingBubble from './StreamingBubble';
import ThinkingAnimation from './ThinkingAnimation';
import WelcomeScreen from './WelcomeScreen';


/* ── Skeleton loader — shown while fetching uncached conversations ── */
function MessageSkeleton({ isUser = false }) {
  return (
    <div className={`flex gap-2 px-2 sm:px-6 py-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
      )}
      <div className={`rounded-2xl px-4 py-3 space-y-2.5 ${
        isUser
          ? 'bg-mustard-500/[0.06] rounded-br-md max-w-[50%]'
          : 'bg-white/[0.02] rounded-bl-md max-w-[65%]'
      }`}>
        <div className="h-3 rounded-full bg-white/[0.06] animate-pulse" style={{ width: isUser ? '120px' : '240px' }} />
        {!isUser && (
          <>
            <div className="h-3 w-[200px] rounded-full bg-white/[0.05] animate-pulse" />
            <div className="h-3 w-[160px] rounded-full bg-white/[0.04] animate-pulse" />
          </>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
      )}
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="flex-1 min-h-0 flex flex-col justify-start relative">
      <div className="flex-1 overflow-hidden px-2 sm:px-4 pt-4 space-y-3">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="space-y-1"
          >
            <MessageSkeleton isUser />
            <MessageSkeleton />
            <MessageSkeleton isUser />
            <MessageSkeleton />
          </motion.div>
        </div>
      </div>
    </div>
  );
}


function ChatContainer({ onSuggestionClick }) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const enableAgentic = useChatStore((s) => s.settings.enableAgentic);
  const isLoadingConversation = useChatStore((s) => s.isLoadingConversation);
  const conversationId = useChatStore((s) => s.conversationId);
  const scrollRef = useRef(null);

  // ── Single smart scroll effect ──
  // Fires after every render caused by messages changing.
  // Only scrolls to bottom IF content actually overflows the visible area.
  // Short chats (1-2 messages) never overflow → never scroll → stay at top.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const isOverflowing = container.scrollHeight > container.clientHeight;

    if (isOverflowing) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, streamingContent]);

  // ── Scroll position caching ──
  const saveScrollPosition = useCallback(() => {
    if (scrollRef.current && conversationId) {
      useChatStore.getState().cacheScrollPosition(conversationId, scrollRef.current.scrollTop);
    }
  }, [conversationId]);

  // Restore scroll position when returning to a cached conversation
  useEffect(() => {
    if (!scrollRef.current || !conversationId) return;
    const saved = useChatStore.getState().scrollCache[conversationId];
    if (saved !== undefined) {
      scrollRef.current.scrollTop = saved;
    }
  }, [conversationId]);

  useEffect(() => {
    return () => saveScrollPosition();
  }, [saveScrollPosition]);

  // Keyboard-aware scroll for mobile
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      setTimeout(() => {
        const container = scrollRef.current;
        if (!container) return;
        if (container.scrollHeight > container.clientHeight) {
          container.scrollTop = container.scrollHeight;
        }
      }, 150);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // ── Loading skeleton (first-time uncached loads) ──
  if (isLoadingConversation) {
    return <SkeletonLoader />;
  }

  // ── Welcome screen (no messages) ──
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y flex flex-col md:justify-center">
        <WelcomeScreen onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  // ── Chat messages ──
  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* 
        Messages container:
        - flex-direction: column + justify-content: flex-start
        - Natural top-to-bottom HTML flow
        - overflow-y: auto → scrollbar appears only when content overflows
        - No column-reverse, no margin-top: auto, no flex-end
      */}
      <div
        ref={scrollRef}
        id="messages"
        className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-2 sm:px-4 pb-36 md:pb-6 pt-4 overflow-anchor-none flex flex-col justify-start"
      >
        <div className="max-w-4xl mx-auto w-full space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble message={msg} />
            </div>
          ))}

          {/* Streaming content */}
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

          {/* Thinking animation */}
          <AnimatePresence mode="wait">
            {isStreaming && !streamingContent && (
              <ThinkingAnimation mode={enableAgentic ? 'agentic' : 'standard'} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-navy-950 to-transparent pointer-events-none z-10" />
    </div>
  );
}

export default memo(ChatContainer);
