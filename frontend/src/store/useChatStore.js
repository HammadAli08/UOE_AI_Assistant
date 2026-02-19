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
  turnCount: 0,

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
  apiOnline: null,      // null = unknown, true/false

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
    };
    set((s) => ({
      messages: [...s.messages, msg],
      isStreaming: false,
      streamingContent: '',
    }));
  },

  cancelStreaming: () => set({ isStreaming: false, streamingContent: '' }),

  setSessionId: (id) => set({ sessionId: id }),

  setNamespace: (ns) => set({
    namespace: ns,
    messages: [],
    sessionId: null,
    turnCount: 0,
  }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  enterChat: () => set({ showChat: true }),

  setApiOnline: (v) => set({ apiOnline: v }),

  newChat: () => set({
    messages: [],
    sessionId: null,
    turnCount: 0,
    isStreaming: false,
    streamingContent: '',
  }),

  isMaxTurns: () => get().turnCount >= MAX_TURNS,
}));

export default useChatStore;
