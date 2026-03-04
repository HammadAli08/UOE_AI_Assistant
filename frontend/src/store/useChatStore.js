// ──────────────────────────────────────────
// Zustand store — global chat state
// ──────────────────────────────────────────
import { create } from 'zustand';
import { DEFAULT_NAMESPACE, MAX_TURNS } from '@/constants';

const useChatStore = create((set, get) => ({
  // ── Messages ──
  messages: [],        // [{ id, role:'user'|'assistant', content, timestamp, sources?, smartInfo?, enhancedQuery? }]
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
    enableSmart: false,
    topKRetrieve: 5,
  },

  // ── UI State ──
  showChat: false,
  sidebarOpen: false,
  apiOnline: null,      // null = unknown, true/false
  feedbackMap: {},      // { [messageId]: 'up' | 'down' }
  lastUserQuery: '',    // last user message for retry
  draftInput: '',       // pre-filled input text (e.g. from retry)

  // ── Actions ──

  addUserMessage: (content) => {
    const msg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      messages: [...s.messages, msg],
      turnCount: s.turnCount + 1,
      lastUserQuery: content,
    }));
    return msg;
  },

  addAssistantMessage: (content, meta = {}) => {
    const msg = {
      id: `asst-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      sources: meta.sources || [],
      smartInfo: meta.smartInfo || null,
      enhancedQuery: meta.enhancedQuery || null,
      runId: meta.runId || null,
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  startStreaming: () => set({ isStreaming: true, streamingContent: '' }),

  appendStreamToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),

  finishStreaming: (meta = {}) => {
    const { streamingContent } = get();
    const msg = {
      id: `asst-${Date.now()}`,
      role: 'assistant',
      content: streamingContent,
      timestamp: new Date().toISOString(),
      sources: meta.sources || [],
      smartInfo: meta.smartInfo || null,
      enhancedQuery: meta.enhancedQuery || null,
      runId: meta.runId || null,
    };
    set((s) => ({
      messages: [...s.messages, msg],
      isStreaming: false,
      streamingContent: '',
    }));
  },

  cancelStreaming: () => set({ isStreaming: false, streamingContent: '' }),

  setSessionId: (id) => set({ sessionId: id }),

  setConversationId: (id) => set({ conversationId: id }),
  setConversations: (convos) => set({ conversations: convos }),

  loadConversation: (convo, messages) => set({
    conversationId: convo.id,
    namespace: convo.namespace,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      sources: m.sources || [],
      smartInfo: m.smart_info || null,
      enhancedQuery: m.enhanced_query || null,
      runId: m.run_id || null,
    })),
    turnCount: messages.filter((m) => m.role === 'user').length,
    sessionId: null,
    isStreaming: false,
    streamingContent: '',
  }),

  setNamespace: (ns) => set({
    namespace: ns,
    messages: [],
    sessionId: null,
    conversationId: null,
    turnCount: 0,
  }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  enterChat: () => set({ showChat: true }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),

  setApiOnline: (v) => set({ apiOnline: v }),

  setFeedback: (messageId, value) =>
    set((s) => ({
      feedbackMap: { ...s.feedbackMap, [messageId]: value },
    })),

  setDraftInput: (v) => set({ draftInput: v }),

  newChat: () => set({
    messages: [],
    sessionId: null,
    conversationId: null,
    turnCount: 0,
    isStreaming: false,
    streamingContent: '',
  }),

  isMaxTurns: () => get().turnCount >= MAX_TURNS,
}));

export default useChatStore;
