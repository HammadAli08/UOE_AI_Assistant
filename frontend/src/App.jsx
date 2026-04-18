// ──────────────────────────────────────────
// App — root component with routing
// ──────────────────────────────────────────
import { useCallback, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Menu, LogIn, User, Database } from 'lucide-react';
import useChatStore from '@/store/useChatStore';
import useAuthStore from '@/store/useAuthStore';
import useChat from '@/hooks/useChat';
import useHealthCheck from '@/hooks/useHealthCheck';

// Eagerly load only what the first paint needs
import ChatContainer from '@/components/Chat/ChatContainer';
import ChatInput from '@/components/Input/ChatInput';
import ChatSidebar from '@/components/Chat/ChatSidebar';

// Lazy-load heavy routes — they won't be in the initial bundle
const HeroPage  = lazy(() => import('@/components/Landing/HeroPage'));
const AuthModal = lazy(() => import('@/components/Auth/AuthModal'));
const KnowledgeBaseExplorer = lazy(() => import('@/components/KnowledgeBaseExplorer/KnowledgeBaseExplorer'));

/* ── Minimal spinner shown during lazy chunk load ── */
function PageLoader() {
  return (
    <div className="h-dvh flex items-center justify-center bg-[#070B14]">
      <span className="w-8 h-8 rounded-full border-2 border-mustard-500/20 border-t-mustard-500 animate-spin" />
    </div>
  );
}

/* ── Chat page (separate component so useNavigate works) ── */
function ChatPage() {
  const navigate = useNavigate();
  const { send, stop, isStreaming } = useChat();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);

  const handleSuggestionClick = useCallback(
    (query) => { send(query); },
    [send]
  );

  return (
    <div className="h-dvh flex overflow-hidden bg-navy-950 relative">
      {/* ── Conversation sidebar ── */}
      <ChatSidebar />

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Clean background — no ambient blobs */}

        {/* ── Top bar ── */}
        <header className="flex items-center justify-between px-4 sm:px-8 h-14 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile sidebar toggle */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-mist hover:text-cream
                         hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle navigation sidebar"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <button onClick={() => navigate('/')} className="flex items-center gap-3 group" aria-label="Go to home page">
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
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/knowledge-bases')}
              className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02]
                         text-xs font-medium text-ash hover:text-cream hover:border-mustard-500/30
                         transition-all duration-400 active:scale-[0.97]"
            >
              <Database className="w-3.5 h-3.5 text-mustard-500/70" />
              Explorer
            </button>

            <button
              onClick={() => useChatStore.getState().newChat()}
              className="px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02]
                         text-xs font-medium text-ash hover:text-cream hover:border-mustard-500/30
                         transition-all duration-400 active:scale-[0.97]"
            >
              New Chat
            </button>

            {!user ? (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full
                           bg-mustard-600/90 hover:bg-mustard-500
                           text-xs font-semibold text-navy-950
                           transition-all duration-300 active:scale-[0.97]"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full
                              border border-white/[0.06] bg-white/[0.02]">
                <div className="w-5 h-5 rounded-full bg-mustard-600/30 flex items-center justify-center">
                  <User className="w-3 h-3 text-mustard-400" />
                </div>
                <span className="text-2xs text-mist max-w-[120px] truncate">
                  {user.user_metadata?.full_name || user.email}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* ── Chat messages ── */}
        <ChatContainer onSuggestionClick={handleSuggestionClick} />

        {/* ── Input area ── */}
        <ChatInput onSend={send} onStop={stop} isStreaming={isStreaming} />
      </div>

      {/* ── Auth modal ── */}
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
    </div>
  );
}

/* ── App root with routes ── */
export default function App() {
  // Poll backend health every 30 s
  useHealthCheck(30000);

  // Initialize Supabase auth listener
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HeroPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/knowledge-bases" element={<KnowledgeBaseExplorer />} />
      </Routes>
    </Suspense>
  );
}
