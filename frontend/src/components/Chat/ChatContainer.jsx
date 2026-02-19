// ──────────────────────────────────────────
// ChatContainer — scrollable message list
// ──────────────────────────────────────────
import { useEffect, useRef, memo } from 'react';
import useChatStore from '@/store/useChatStore';
import MessageBubble from './MessageBubble';
import StreamingBubble from './StreamingBubble';
import TypingIndicator from './TypingIndicator';
import WelcomeScreen from './WelcomeScreen';


function ChatContainer({ onSuggestionClick }) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  // Keyboard-aware scroll for mobile
  useEffect(() => {
    if (window.visualViewport) {
      const scrollToBottom = () => {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      };
      window.visualViewport.addEventListener('resize', scrollToBottom);
      return () => window.visualViewport.removeEventListener('resize', scrollToBottom);
    }
  }, []);

  if (messages.length === 0 && !isStreaming) {
    return <WelcomeScreen onSuggestionClick={onSuggestionClick} />;
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-56px)] md:h-[calc(100vh-64px)]">
      <div id="messages" className="flex-1 overflow-y-auto px-2 sm:px-4 pb-32 pt-4 space-y-3 overflow-anchor-none">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming content */}
          {isStreaming && streamingContent && (
            <StreamingBubble content={streamingContent} />
          )}

          {/* Typing indicator — streaming started but no content yet */}
          {isStreaming && !streamingContent && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

export default memo(ChatContainer);
