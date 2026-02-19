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

  if (messages.length === 0 && !isStreaming) {
    return <WelcomeScreen onSuggestionClick={onSuggestionClick} />;
  }

  return (
    <div className="flex-1 overflow-y-auto pb-4 pt-4">
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
  );
}

export default memo(ChatContainer);
