// ──────────────────────────────────────────
// Zustand store — global chat state
// ──────────────────────────────────────────
import { create } from 'zustand';
import { DEFAULT_NAMESPACE, MAX_TURNS } from '@/constants';

const useChatStore = create((set, get) => ({
  // ── Messages ──
  messages: [],        // [{ id, role:'user'|'assistant', content, timestamp, sources?, agenticInfo?, enhancedQuery? }]
  isStreaming: false,
  streamingContent: '',

  // ── Session ──
  sessionId: null,
  conversationId: null,
  turnCount: 0,

  // ── Conversation History ──
  conversations: [],

  // ── Namespace ──
  namespace: DEFAULT_NAMESPACE,

  // ── Pipeline Settings ──
  settings: {
    enhanceQuery: true,
    enableAgentic: false,
    topKRetrieve: 5,
  },

  // ── UI State ──
  showChat: false,
  sidebarOpen: false,
  sidebarMinimized: false,
  apiOnline: null,      // null = unknown, true/false
  feedbackMap: {},      // { [messageId]: 'up' | 'down' }
  lastUserQuery: '',    // last user message for retry
  draftInput: '',       // pre-filled input text (e.g. from retry)

  // ── Conversation Cache & Loading ──
  messageCache: {},         // { [conversationId]: formattedMessages[] }
  scrollCache: {},          // { [conversationId]: scrollTop number }
  isLoadingConversation: false,

  // ── Actions ──

  addUserMessage: (content) => {
    const msg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    const { conversationId } = get();
    set((s) => {
      const updated = [...s.messages, msg];
      return {
        messages: updated,
        turnCount: s.turnCount + 1,
        lastUserQuery: content,
        // Keep cache hot
        ...(conversationId && { messageCache: { ...s.messageCache, [conversationId]: updated } }),
      };
    });
    return msg;
  },

  addAssistantMessage: (content, meta = {}) => {
    const msg = {
      id: `asst-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      sources: meta.sources || [],
      agenticInfo: meta.agenticInfo || null,
      enhancedQuery: meta.enhancedQuery || null,
      runId: meta.runId || null,
    };
    const { conversationId } = get();
    set((s) => {
      const updated = [...s.messages, msg];
      return {
        messages: updated,
        ...(conversationId && { messageCache: { ...s.messageCache, [conversationId]: updated } }),
      };
    });
    return msg;
  },

  startStreaming: () => set({ isStreaming: true, streamingContent: '' }),

  appendStreamToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),

  finishStreaming: (meta = {}) => {
    const { streamingContent, conversationId } = get();
    const msg = {
      id: `asst-${Date.now()}`,
      role: 'assistant',
      content: streamingContent,
      timestamp: new Date().toISOString(),
      sources: meta.sources || [],
      agenticInfo: meta.agenticInfo || null,
      enhancedQuery: meta.enhancedQuery || null,
      runId: meta.runId || null,
    };
    set((s) => {
      const updated = [...s.messages, msg];
      return {
        messages: updated,
        isStreaming: false,
        streamingContent: '',
        ...(conversationId && { messageCache: { ...s.messageCache, [conversationId]: updated } }),
      };
    });
  },

  cancelStreaming: () => set({ isStreaming: false, streamingContent: '' }),

  setSessionId: (id) => set({ sessionId: id }),

  setConversationId: (id) => set({ conversationId: id }),
  setConversations: (convos) => set({ conversations: convos }),

  /** Save current messages to cache before switching away */
  _cacheCurrentMessages: () => {
    const { conversationId, messages } = get();
    // CRITICAL: Only cache if we actually have messages.
    // Otherwise we might accidentally cache `[]` when clicking "New Chat" 
    // or switching namespaces, effectively deleting the chat from the local cache.
    if (conversationId && messages && messages.length > 0) {
      set((s) => ({
        messageCache: { ...s.messageCache, [conversationId]: messages },
      }));
    }
  },

  /** Load a conversation — replaces current state (used for first-time loads) */
  loadConversation: (convo, rawMessages) => {
    // Cache the conversation we're leaving
    get()._cacheCurrentMessages();

    const messages = rawMessages || [];

    const formatted = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      sources: m.sources || [],
      // Support both legacy column name and the current schema
      agenticInfo: m.agentic_info || m.smart_info || null,
      enhancedQuery: m.enhanced_query || null,
      runId: m.run_id || null,
    }));

    set((s) => ({
      conversationId: convo.id,
      namespace: convo.namespace,
      messages: formatted,
      turnCount: formatted.filter((m) => m.role === 'user').length,
      sessionId: null,
      isStreaming: false,
      streamingContent: '',
      isLoadingConversation: false,
      // Update cache with fresh data ONLY if there is data
      ...(formatted.length > 0 && { messageCache: { ...s.messageCache, [convo.id]: formatted } }),
    }));
  },

  /**
   * Silent background refresh — updates cache only.
   * If user is still viewing this conversation AND new messages appeared,
   * append only the new ones (no full re-render).
   */
  refreshConversationCache: (convoId, rawMessages) => {
    const formatted = rawMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      sources: m.sources || [],
      agenticInfo: m.agentic_info || m.smart_info || null,
      enhancedQuery: m.enhanced_query || null,
      runId: m.run_id || null,
    }));

    const { conversationId, messages } = get();

    // Always update cache
    set((s) => ({
      messageCache: { ...s.messageCache, [convoId]: formatted },
    }));

    // Only touch visible messages if this is the active conversation
    // AND the message count actually changed (new messages arrived)
    if (conversationId === convoId && formatted.length !== messages.length) {
      set({
        messages: formatted,
        turnCount: formatted.filter((m) => m.role === 'user').length,
      });
    }
  },

  /** Instantly switch to cached messages (before network fetch completes) */
  loadConversationFromCache: (convo) => {
    const cached = get().messageCache[convo.id];
    // Must be a valid array with at least 1 message to be considered a real cache hit.
    // If it's empty, we should fall through to the DB fetch to be safe.
    if (!cached || cached.length === 0) return false;

    // Cache the conversation we're leaving
    get()._cacheCurrentMessages();

    set({
      conversationId: convo.id,
      namespace: convo.namespace,
      messages: cached,
      turnCount: cached.filter((m) => m.role === 'user').length,
      sessionId: null,
      isStreaming: false,
      streamingContent: '',
      isLoadingConversation: false,
    });
    return true;
  },

  cacheScrollPosition: (convoId, scrollTop) =>
    set((s) => ({
      scrollCache: { ...s.scrollCache, [convoId]: scrollTop },
    })),

  setLoadingConversation: (v) => set({ isLoadingConversation: v }),

  /**
   * ATOMIC state transition for loading a conversation from the sidebar.
   * Sets namespace + conversationId + loading flag in ONE Zustand set() call.
   * This prevents any intermediate render where ChatContainer sees
   * messages=[] + isLoadingConversation=false → Welcome Screen flash.
   */
  prepareConversationLoad: (convo) => {
    // Cache the conversation we're leaving
    get()._cacheCurrentMessages();
    set({
      namespace: convo.namespace,
      conversationId: convo.id,
      messages: [],
      sessionId: null,
      turnCount: 0,
      isStreaming: false,
      streamingContent: '',
      isLoadingConversation: true,   // ← keeps skeleton visible until loadConversation fires
    });
  },

  setNamespace: (ns) => {
    // Cache before switching namespace
    get()._cacheCurrentMessages();
    // Preserve loading state if already loading (to prevent Welcome Screen flash)
    const currentlyLoading = get().isLoadingConversation;
    set({
      namespace: ns,
      messages: [],
      sessionId: null,
      conversationId: null,
      turnCount: 0,
      isLoadingConversation: currentlyLoading,
    });
  },

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  enterChat: () => set({ showChat: true }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  
  minimizeSidebar: () => set({ sidebarMinimized: true }),
  expandSidebar: () => set({ sidebarMinimized: false }),
  toggleSidebarMinimized: () => set((s) => ({ sidebarMinimized: !s.sidebarMinimized })),

  setApiOnline: (v) => set({ apiOnline: v }),

  setFeedback: (messageId, value) =>
    set((s) => ({
      feedbackMap: { ...s.feedbackMap, [messageId]: value },
    })),

  setDraftInput: (v) => set({ draftInput: v }),

  newChat: () => {
    // Cache before clearing
    get()._cacheCurrentMessages();
    set({
      messages: [],
      sessionId: null,
      conversationId: null,
      turnCount: 0,
      isStreaming: false,
      streamingContent: '',
      isLoadingConversation: false,
    });
  },

  isMaxTurns: () => get().turnCount >= MAX_TURNS,
}));

export default useChatStore;
