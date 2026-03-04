// ──────────────────────────────────────────
// ChatSidebar — conversation history & user controls
// ──────────────────────────────────────────
import { memo, useState, useEffect, useCallback } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  LogIn,
  LogOut,
  User,
  X,
  GraduationCap,
  FlaskConical,
  Scale,
} from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import useAuthStore from '@/store/useAuthStore';
import {
  fetchConversations,
  fetchMessages,
  deleteConversation,
} from '@/lib/chatPersistence';

const NS_ICONS = { 'bs-adp': GraduationCap, 'ms-phd': FlaskConical, rules: Scale };

function ChatSidebar() {
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const signOut = useAuthStore((s) => s.signOut);

  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const closeSidebar = useChatStore((s) => s.closeSidebar);
  const newChat = useChatStore((s) => s.newChat);
  const conversationId = useChatStore((s) => s.conversationId);
  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const loadConversation = useChatStore((s) => s.loadConversation);

  const [deleting, setDeleting] = useState(null);

  // Refresh conversations when user changes
  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }
    fetchConversations(user.id)
      .then(setConversations)
      .catch((err) => console.warn('Failed to load conversations:', err));
  }, [user, setConversations]);

  const handleNewChat = useCallback(() => {
    newChat();
    closeSidebar();
  }, [newChat, closeSidebar]);

  const handleLoadConversation = useCallback(
    async (convo) => {
      if (convo.id === conversationId) {
        closeSidebar();
        return;
      }
      try {
        const messages = await fetchMessages(convo.id);
        loadConversation(convo, messages);
        closeSidebar();
      } catch (err) {
        console.warn('Failed to load conversation:', err);
      }
    },
    [conversationId, loadConversation, closeSidebar],
  );

  const handleDelete = useCallback(
    async (e, convoId) => {
      e.stopPropagation();
      setDeleting(convoId);
      try {
        await deleteConversation(convoId);
        setConversations(conversations.filter((c) => c.id !== convoId));
        if (conversationId === convoId) newChat();
      } catch (err) {
        console.warn('Failed to delete conversation:', err);
      } finally {
        setDeleting(null);
      }
    },
    [conversations, conversationId, newChat, setConversations],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    newChat();
    closeSidebar();
  }, [signOut, newChat, closeSidebar]);

  const grouped = groupByDate(conversations);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50',
          'w-72 flex flex-col',
          'bg-navy-900/95 backdrop-blur-xl border-r border-white/[0.06]',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img
                src="/unnamed.jpg"
                alt="UOE"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-cream leading-tight">
                UOE AI
              </h1>
              <p className="text-2xs text-mist">Chat History</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1.5 rounded-lg text-mist hover:text-cream hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── New Chat ── */}
        <div className="px-3 pt-3 flex-shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                       border border-white/[0.08] bg-white/[0.03]
                       text-sm text-cream font-medium
                       hover:bg-white/[0.06] hover:border-mustard-500/30
                       transition-all duration-300 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-mustard-500" />
            New Chat
          </button>
        </div>

        {/* ── Conversations ── */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-1">
          {!user ? (
            /* Guest prompt */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-mist/40 mb-3" />
              <p className="text-sm text-mist/80 mb-1">Sign in to save chats</p>
              <p className="text-2xs text-mist/50 mb-4">
                Your conversations will sync across devices
              </p>
              <button
                onClick={openAuthModal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                           bg-mustard-600/90 hover:bg-mustard-500 text-navy-950
                           text-xs font-semibold transition-all duration-300"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            </div>
          ) : conversations.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-mist/40 mb-3" />
              <p className="text-sm text-mist/80">No conversations yet</p>
              <p className="text-2xs text-mist/50">Start a new chat to begin</p>
            </div>
          ) : (
            /* Grouped list */
            Object.entries(grouped).map(([label, convos]) => (
              <div key={label}>
                <p className="px-2 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wider text-mist/50">
                  {label}
                </p>
                {convos.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => handleLoadConversation(convo)}
                    className={clsx(
                      'w-full group flex items-center gap-2 px-3 py-2.5 rounded-lg text-left',
                      'transition-all duration-200',
                      convo.id === conversationId
                        ? 'bg-white/[0.08] text-cream border border-mustard-500/20'
                        : 'text-ash hover:text-cream hover:bg-white/[0.04] border border-transparent',
                    )}
                  >
                    <span className="flex-shrink-0 text-mist">
                      {(() => { const Icon = NS_ICONS[convo.namespace] || MessageSquare; return <Icon className="w-3.5 h-3.5" />; })()}
                    </span>
                    <span className="flex-1 truncate text-sm">{convo.title}</span>
                    <button
                      onClick={(e) => handleDelete(e, convo.id)}
                      disabled={deleting === convo.id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-mist/60
                                 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] flex-shrink-0">
          {user ? (
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-mustard-600/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-mustard-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cream truncate">
                  {user.user_metadata?.full_name || user.email}
                </p>
                <p className="text-2xs text-mist/60 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-mist/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg
                         text-xs text-mist hover:text-cream hover:bg-white/[0.04]
                         transition-colors duration-200"
            >
              <LogIn className="w-4 h-4" />
              Sign in to save chats
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

/**
 * Group conversations by date: Today, Yesterday, Previous 7 Days, Older.
 */
function groupByDate(conversations) {
  const groups = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  for (const convo of conversations) {
    const d = new Date(convo.updated_at || convo.created_at);
    let label;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= weekAgo) label = 'Previous 7 Days';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(convo);
  }
  return groups;
}

export default memo(ChatSidebar);
