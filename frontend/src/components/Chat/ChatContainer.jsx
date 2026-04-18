// ──────────────────────────────────────────
// ChatContainer — scrollable message list with AnimatePresence
// ──────────────────────────────────────────
import { useEffect, useRef, useState, memo } from 'react';
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
  const isLoadingConversation = useChatStore((s) => s.isLoadingConversation);
  const conversationId = useChatStore((s) => s.conversationId);
  const scrollCache = useChatStore((s) => s.scrollCache);
  const cacheScrollPosition = useChatStore((s) => s.cacheScrollPosition);
  const bottomRef = useRef(null);
  const lastConversationIdRef = useRef(null);
  const forceInstantScrollRef = useRef(false);
  const scrollTopRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const pendingRestoreRef = useRef(null);
  const prevStreamingLengthRef = useRef(0);
  const prevMessageCountRef = useRef(messages.length);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const BOTTOM_THRESHOLD = 48; // px buffer to treat near-bottom as bottom

  const getContainer = () => document.getElementById('messages');

  const scrollToBottom = (instant = false) => {
    const container = getContainer();
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    isAtBottomRef.current = true;
    setShowJumpToLatest(false);
    if (instant) forceInstantScrollRef.current = false;
  };

  // Attach scroll listener to track position and bottom state
  useEffect(() => {
    const container = getContainer();
    if (!container) return undefined;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      scrollTopRef.current = scrollTop;
      const atBottom = scrollHeight - (scrollTop + clientHeight) <= BOTTOM_THRESHOLD;
      isAtBottomRef.current = atBottom;
      if (atBottom) setShowJumpToLatest(false);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [conversationId]);

  // Cache scroll position when leaving a conversation or unmounting
  useEffect(() => {
    const cacheCurrentScroll = (id) => {
      if (!id) return;
      const container = getContainer();
      if (container) cacheScrollPosition(id, container.scrollTop);
    };

    // On conversation change, persist previous scroll
    const prevId = lastConversationIdRef.current;
    if (prevId && prevId !== conversationId) cacheCurrentScroll(prevId);
    lastConversationIdRef.current = conversationId;

    // On unmount, persist current conversation scroll
    return () => cacheCurrentScroll(lastConversationIdRef.current);
  }, [conversationId, cacheScrollPosition]);

  // Prepare restoration target when a conversation is selected
  useEffect(() => {
    if (!conversationId) {
      pendingRestoreRef.current = null;
      return;
    }
    const cached = scrollCache[conversationId];
    pendingRestoreRef.current = {
      id: conversationId,
      scrollTop: typeof cached === 'number' ? cached : null,
    };
    // If no cache, ensure first render goes to bottom instantly
    if (cached == null) forceInstantScrollRef.current = true;
  }, [conversationId, scrollCache]);

  // Restore scroll position after messages load
  useEffect(() => {
    if (!pendingRestoreRef.current) return;
    const { id, scrollTop } = pendingRestoreRef.current;
    if (id !== conversationId) return;
    const container = getContainer();
    if (!container) return;

    if (typeof scrollTop === 'number') {
      container.scrollTop = scrollTop;
    } else {
      scrollToBottom(true);
    }

    const { scrollHeight, clientHeight } = container;
    isAtBottomRef.current = scrollHeight - (container.scrollTop + clientHeight) <= BOTTOM_THRESHOLD;
    pendingRestoreRef.current = null;
  }, [messages, streamingContent, isLoadingConversation, conversationId]);

  // Auto-scroll only when user is at/near bottom; otherwise show cue
  useEffect(() => {
    const container = getContainer();
    if (!container) return;

    const streamingLength = streamingContent ? streamingContent.length : 0;
    const newMessage = messages.length > prevMessageCountRef.current;
    const newStreamingToken = streamingLength > prevStreamingLengthRef.current;

    prevMessageCountRef.current = messages.length;
    prevStreamingLengthRef.current = streamingLength;

    const hasNewContent = newMessage || (isStreaming && newStreamingToken);

    if (forceInstantScrollRef.current) {
      scrollToBottom(true);
      return;
    }

    if (hasNewContent) {
      if (isAtBottomRef.current) {
        scrollToBottom();
      } else {
        setShowJumpToLatest(true);
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

  if (messages.length === 0 && !isStreaming && !isLoadingConversation) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y flex flex-col md:justify-center">
        <WelcomeScreen onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative w-full">
      {/* Scrollable message area */}
      <div id="messages" className="flex-1 overflow-y-auto overscroll-contain touch-pan-y overflow-anchor-none w-full pb-24 md:pb-6">
        <div className="max-w-[900px] mx-auto w-full px-3 sm:px-6 lg:px-8 pt-4 flex flex-col gap-5">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <MessageBubble message={msg} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming content */}
          {isStreaming && streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
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

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Jump to latest cue */}
      {showJumpToLatest && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute right-4 sm:right-6 bottom-20 sm:bottom-16 px-3 py-1.5 rounded-full text-xs font-medium
                     bg-surface-2 border border-surface-border text-ash
                     hover:border-surface-border-hover hover:text-textWhite
                     shadow-lg shadow-black/30 transition-colors duration-200 z-40"
        >
          ↓ Latest
        </button>
      )}

      {/* Loading overlay when switching conversations */}
      {isLoadingConversation && (
        <div className="absolute inset-0 z-20 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-mist text-sm">
            <div className="processing-dot" />
            <div className="processing-dot processing-dot--delay" />
            <div className="processing-dot processing-dot--delay2" />
            <span>Loading conversation…</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ChatContainer);
