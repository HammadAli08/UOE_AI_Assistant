// ──────────────────────────────────────────
// ChatSidebar — conversation history & user controls
// ──────────────────────────────────────────
import { memo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit3,
  Check,
  X,
  LogIn,
  LogOut,
  User,
  GraduationCap,
  FlaskConical,
  ScrollText,
  Building2,
  ChevronRight,
  Menu,
  Database,
} from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import useAuthStore from '@/store/useAuthStore';
import {
  fetchConversations,
  fetchMessages,
  deleteConversation,
  updateConversationTitle,
} from '@/lib/chatPersistence';

const NS_ICONS = {
  'bs-adp': GraduationCap,
  'ms-phd': FlaskConical,
  rules: ScrollText,
  about: Building2,
};

function ChatSidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const signOut = useAuthStore((s) => s.signOut);

  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const sidebarMinimized = useChatStore((s) => s.sidebarMinimized);
  const closeSidebar = useChatStore((s) => s.closeSidebar);
  const toggleSidebarMinimized = useChatStore((s) => s.toggleSidebarMinimized);
  const expandSidebar = useChatStore((s) => s.expandSidebar);
  const newChat = useChatStore((s) => s.newChat);
  const conversationId = useChatStore((s) => s.conversationId);
  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const loadConversation = useChatStore((s) => s.loadConversation);

  const [deleting, setDeleting] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

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
      setEditingId(null);
      setEditValue('');
      if (convo.id === conversationId) {
        closeSidebar();
        return;
      }

      // 1️⃣ Instant cache hit — zero network calls, feels native
      const hitCache = useChatStore.getState().loadConversationFromCache(convo);
      if (hitCache) {
        closeSidebar();
        return;
      }

      // 2️⃣ First-time load — show skeleton, fetch from Supabase
      // ATOMIC: Sets namespace + conversationId + isLoadingConversation=true
      // in ONE Zustand set() call to prevent Welcome Screen flash.
      useChatStore.getState().prepareConversationLoad(convo);
      closeSidebar();

      try {
        const messages = await fetchMessages(convo.id);
        loadConversation(convo, messages);
      } catch (err) {
        useChatStore.getState().setLoadingConversation(false);
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

  const handleStartRename = useCallback((e, convo) => {
    e.stopPropagation();
    setEditingId(convo.id);
    setEditValue(convo.title);
  }, []);

  const handleRenameSubmit = useCallback(
    async (e, convoId) => {
      e.preventDefault();
      e.stopPropagation();
      const nextTitle = editValue.trim();
      if (!nextTitle) {
        setEditingId(null);
        return;
      }
      try {
        await updateConversationTitle(convoId, nextTitle);
        setConversations(
          conversations.map((c) =>
            c.id === convoId ? { ...c, title: nextTitle, updated_at: new Date().toISOString() } : c
          )
        );
        setEditingId(null);
      } catch (err) {
        console.warn('Failed to rename conversation:', err);
      }
    },
    [editValue, setConversations, conversations],
  );

  const handleRenameKeyDown = useCallback(
    (e, convoId) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setEditingId(null);
      } else if (e.key === 'Enter') {
        handleRenameSubmit(e, convoId);
      }
    },
    [handleRenameSubmit],
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
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col',
          'bg-navy-900/95 backdrop-blur-xl border-r border-white/[0.06]',
          'transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]',
          {
            // Mobile behavior
            '-translate-x-full lg:translate-x-0': !sidebarOpen,
            'translate-x-0': sidebarOpen,
            // Desktop minimize behavior
            'lg:w-72': !sidebarMinimized,
            'lg:w-16': sidebarMinimized,
            // Mobile always full width when open
            'w-72': true,
          },
        )}
      >
        {/* ── Desktop Minimize Pill ── */}
        <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
          <button
            onClick={toggleSidebarMinimized}
            title={sidebarMinimized ? 'Expand sidebar' : 'Collapse sidebar'}
            className={clsx(
              'group relative flex items-center justify-center',
              'w-8 h-8 rounded-full',
              'bg-navy-900 border border-white/[0.10]',
              'text-mist hover:text-cream',
              'transition-all duration-300',
              'hover:border-mustard-500/50 hover:bg-navy-800',
              'hover:shadow-[0_0_12px_2px_rgba(200,185,74,0.18)]',
              'active:scale-90 shadow-lg',
            )}
          >
            {/* Inner glow ring on hover */}
            <span className="absolute inset-0 rounded-full ring-1 ring-transparent group-hover:ring-mustard-500/30 transition-all duration-300" />

            {/* Chevron that spins on transition */}
            <span
              className={clsx(
                'transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]',
                sidebarMinimized ? 'rotate-0' : 'rotate-180',
              )}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06] flex-shrink-0">
          <div className={clsx(
            'flex items-center gap-2.5 transition-all duration-500',
            sidebarMinimized && 'lg:justify-center lg:w-full'
          )}>
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/unnamed.jpg"
                alt="UOE"
                className="w-full h-full object-cover"
              />
            </div>
            <div className={clsx(
              'transition-all duration-500 overflow-hidden',
              sidebarMinimized ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
            )}>
              <h1 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-cream leading-tight whitespace-nowrap">
                UOE AI
              </h1>
              <p className="text-2xs text-mist whitespace-nowrap">Chat History</p>
            </div>
          </div>
          {/* Mobile close button — animated X */}
          <button
            onClick={closeSidebar}
            aria-label="Close sidebar"
            className={clsx(
              'lg:hidden relative w-9 h-9 -mr-1 rounded-xl flex items-center justify-center',
              'text-mist hover:text-cream hover:bg-white/[0.06]',
              'transition-all duration-300 active:scale-90',
            )}
          >
            <span className="relative flex flex-col justify-center items-center w-5 h-4 gap-[5px]">
              <span className="block h-[1.5px] w-5 bg-current rounded-full transition-all duration-300 origin-center rotate-45 translate-y-[6.5px]" />
              <span className="block h-[1.5px] w-0 bg-current rounded-full opacity-0" />
              <span className="block h-[1.5px] w-5 bg-current rounded-full transition-all duration-300 origin-center -rotate-45 -translate-y-[6.5px]" />
            </span>
          </button>
        </div>

        {/* ── Top Actions ── */}
        <div className="px-3 pt-3 flex-shrink-0 space-y-2">
          <button
            onClick={handleNewChat}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl',
              'border border-white/[0.08] bg-white/[0.03]',
              'text-sm text-cream font-medium',
              'hover:bg-white/[0.06] hover:border-mustard-500/30',
              'transition-all duration-300 active:scale-[0.98]',
              sidebarMinimized && 'lg:justify-center'
            )}
            title={sidebarMinimized ? 'New Chat' : undefined}
          >
            <Plus className="w-4 h-4 text-mustard-500 flex-shrink-0" />
            <span className={clsx(
              'transition-all duration-500 overflow-hidden whitespace-nowrap',
              sidebarMinimized ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
            )}>
              New Chat
            </span>
          </button>

          <button
            onClick={() => { closeSidebar(); navigate('/knowledge-bases'); }}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl',
              'border border-white/[0.08] bg-white/[0.01]',
              'text-sm text-ash font-medium',
              'hover:bg-white/[0.04] hover:text-cream hover:border-mustard-500/20',
              'transition-all duration-300 active:scale-[0.98]',
              sidebarMinimized && 'lg:justify-center'
            )}
            title={sidebarMinimized ? 'Knowledge Explorer' : undefined}
          >
            <Database className="w-4 h-4 text-mustard-500/70 flex-shrink-0" />
            <span className={clsx(
              'transition-all duration-500 overflow-hidden whitespace-nowrap',
              sidebarMinimized ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
            )}>
              Knowledge Explorer
            </span>
          </button>
        </div>

        {/* ── Conversations ── */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-1">
          {sidebarMinimized ? (
            /* Minimized state - show only icons */
            <div className="hidden lg:flex flex-col items-center gap-2 py-4">
              {conversations.slice(0, 5).map((convo) => {
                const Icon = NS_ICONS[convo.namespace] || MessageSquare;
                return (
                  <button
                    key={convo.id}
                    onClick={() => handleLoadConversation(convo)}
                    className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      'transition-all duration-200 hover:scale-110',
                      convo.id === conversationId
                        ? 'bg-mustard-500/20 text-mustard-400 border border-mustard-500/30'
                        : 'text-mist hover:text-cream hover:bg-white/[0.06]'
                    )}
                    title={convo.title}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
              {conversations.length > 5 && (
                <>
                  <div className="w-6 h-0.5 bg-white/[0.06] rounded-full my-2" />
                  <button
                    onClick={expandSidebar}
                    className="w-10 h-10 rounded-lg flex items-center justify-center
                               text-mist hover:text-cream hover:bg-white/[0.06]
                               transition-all duration-200 hover:scale-110"
                    title={`+${conversations.length - 5} more chats`}
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ) : !user ? (
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
                  (() => {
                    const Icon = NS_ICONS[convo.namespace] || MessageSquare;
                    const isEditing = editingId === convo.id;
                    return (
                      <div
                        key={convo.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleLoadConversation(convo)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLoadConversation(convo); }}
                        className={clsx(
                          'w-full group flex items-center gap-2 px-3 py-2.5 rounded-lg text-left',
                          'transition-all duration-200',
                          convo.id === conversationId
                            ? 'bg-white/[0.08] text-cream border border-mustard-500/20'
                            : 'text-ash hover:text-cream hover:bg-white/[0.04] border border-transparent',
                        )}
                      >
                        <span className="flex-shrink-0 text-mist">
                          <Icon className="w-3.5 h-3.5" />
                        </span>

                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleRenameSubmit(e, convo.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 flex-1"
                          >
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleRenameKeyDown(e, convo.id)}
                              className="flex-1 text-sm bg-white/[0.05] border border-white/[0.12] rounded px-2 py-1 text-cream focus:outline-none focus:ring-1 focus:ring-mustard-500"
                              placeholder="Rename chat"
                            />
                            <button
                              type="submit"
                              className="p-1 rounded text-green-400 hover:bg-green-500/10 transition-all duration-150"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                              className="p-1 rounded text-mist/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="flex-1 truncate text-sm">{convo.title}</span>
                            <div className="hidden group-hover:flex items-center gap-1">
                              <button
                                onClick={(e) => handleStartRename(e, convo)}
                                className="p-1 rounded text-mist/60 hover:text-cream hover:bg-white/[0.08] transition-all duration-200"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, convo.id)}
                                disabled={deleting === convo.id}
                                className="p-1 rounded text-mist/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] flex-shrink-0">
          {user ? (
            <div className={clsx(
              'flex items-center gap-3 px-2 transition-all duration-500',
              sidebarMinimized && 'lg:justify-center'
            )}>
              <div className="w-8 h-8 rounded-full bg-mustard-600/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-mustard-400" />
              </div>
              <div className={clsx(
                'flex-1 min-w-0 transition-all duration-500 overflow-hidden',
                sidebarMinimized ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
              )}>
                <p className="text-xs text-cream truncate whitespace-nowrap">
                  {user.user_metadata?.full_name || user.email}
                </p>
                <p className="text-2xs text-mist/60 truncate whitespace-nowrap">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className={clsx(
                  'p-1.5 rounded-lg text-mist/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200',
                  sidebarMinimized ? 'lg:hidden' : 'flex-shrink-0'
                )}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg',
                'text-xs text-mist hover:text-cream hover:bg-white/[0.04]',
                'transition-all duration-200',
                sidebarMinimized && 'lg:justify-center'
              )}
            >
              <LogIn className="w-4 h-4 flex-shrink-0" />
              <span className={clsx(
                'transition-all duration-500 overflow-hidden whitespace-nowrap',
                sidebarMinimized ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
              )}>
                Sign in to save chats
              </span>
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
