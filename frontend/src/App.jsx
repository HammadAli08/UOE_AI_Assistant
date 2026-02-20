// ──────────────────────────────────────────
// App — root component with routing
// ──────────────────────────────────────────
import { useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import useChatStore from '@/store/useChatStore';
import useChat from '@/hooks/useChat';
import useHealthCheck from '@/hooks/useHealthCheck';
import HeroPage from '@/components/Landing/HeroPage';
import ChatContainer from '@/components/Chat/ChatContainer';
import ChatInput from '@/components/Input/ChatInput';

/* ── Chat page (separate component so useNavigate works) ── */
function ChatPage() {
  const navigate = useNavigate();
  const { send, stop, isStreaming } = useChat();

  const handleSuggestionClick = useCallback(
    (query) => { send(query); },
    [send]
  );

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-navy-950 relative">
      {/* ── Ambient gradient blobs for depth ── */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(200,185,74,0.045) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(100,120,200,0.035) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* ── Minimal top bar ── */}
      <header className="flex items-center justify-between px-5 sm:px-8 h-14 border-b border-white/[0.06] flex-shrink-0">
        <button onClick={() => navigate('/')} className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden group-hover:ring-1 group-hover:ring-mustard-500/30 transition-all duration-300">
            <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div className="text-left">
            <h1 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-cream leading-tight
                           group-hover:text-mustard-400 transition-colors duration-300">
              UOE AI
            </h1>
            <p className="text-2xs text-mist">Academic Assistant</p>
          </div>
        </button>

        <button
          onClick={() => useChatStore.getState().newChat()}
          className="px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02]
                     text-xs font-medium text-ash hover:text-cream hover:border-mustard-500/30
                     transition-all duration-400 active:scale-[0.97]"
        >
          New Chat
        </button>
      </header>

      {/* ── Chat messages ── */}
      <ChatContainer onSuggestionClick={handleSuggestionClick} />

      {/* ── Input area ── */}
      <ChatInput onSend={send} onStop={stop} isStreaming={isStreaming} />
    </div>
  );
}

/* ── App root with routes ── */
export default function App() {
  // Poll backend health every 30 s
  useHealthCheck(30000);

  return (
    <Routes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
}
