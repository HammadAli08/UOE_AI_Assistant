// ──────────────────────────────────────────
// useChat hook — orchestrates sending messages (streaming + fallback)
// ──────────────────────────────────────────
import { useCallback, useRef } from 'react';
import useChatStore from '@/store/useChatStore';
import useAuthStore from '@/store/useAuthStore';
import { chatStreaming, chatNonStreaming } from '@/utils/api';
import { createConversation, saveMessage, fetchConversations } from '@/lib/chatPersistence';

export default function useChat() {
  const abortRef = useRef(null);
  const metaRef = useRef({});

  const {
    namespace,
    sessionId,
    conversationId,
    settings,
    isStreaming,
    addUserMessage,
    addAssistantMessage,
    startStreaming,
    appendStreamToken,
    finishStreaming,
    cancelStreaming,
    setSessionId,
    setConversationId,
    setConversations,
    isMaxTurns,
  } = useChatStore();

  const send = useCallback(
    async (query) => {
      if (!query.trim() || isStreaming) return;
      if (isMaxTurns()) return;

      // Add user message
      addUserMessage(query.trim());

      // Prepare abort controller
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      metaRef.current = {};

      // ═══ Supabase: ensure conversation exists & save user message ═══
      const user = useAuthStore.getState().user;
      let convId = conversationId;

      if (user && !convId) {
        try {
          const title = query.trim().length > 50
            ? query.trim().slice(0, 50) + '…'
            : query.trim();
          const conv = await createConversation(user.id, namespace, title);
          if (conv) {
            convId = conv.id;
            setConversationId(conv.id);
            fetchConversations(user.id).then(setConversations).catch(() => {});
          }
        } catch (err) {
          console.warn('[Persist] Failed to create conversation:', err);
        }
      }

      if (user && convId) {
        saveMessage(convId, { role: 'user', content: query.trim() }).catch(() => {});
      }

      startStreaming();

      try {
        await chatStreaming({
          query: query.trim(),
          namespace,
          sessionId,
          settings,
          signal: abortRef.current.signal,

          onToken: (token) => {
            appendStreamToken(token);
          },

          onMetadata: (meta) => {
            if (meta.sources) metaRef.current.sources = meta.sources;
            if (meta.smart_info) metaRef.current.smartInfo = meta.smart_info;
            if (meta.enhanced_query) metaRef.current.enhancedQuery = meta.enhanced_query;
            if (meta.run_id) metaRef.current.runId = meta.run_id;
            if (meta.session_id) {
              metaRef.current.sessionId = meta.session_id;
              setSessionId(meta.session_id);
            }
          },

          onDone: () => {
            // Capture content before finishStreaming clears it
            const finalContent = useChatStore.getState().streamingContent;
            finishStreaming(metaRef.current);

            // ═══ Persist assistant message ═══
            if (user && convId) {
              saveMessage(convId, {
                role: 'assistant',
                content: finalContent,
                sources: metaRef.current.sources,
                smartInfo: metaRef.current.smartInfo,
                enhancedQuery: metaRef.current.enhancedQuery,
                runId: metaRef.current.runId,
              }).catch(() => {});
            }
          },

          onError: async (err) => {
            console.warn('Stream failed, falling back to non-streaming:', err.message);
            cancelStreaming();

            try {
              const data = await chatNonStreaming({
                query: query.trim(),
                namespace,
                sessionId,
                settings,
                signal: abortRef.current.signal,
              });

              if (data.session_id) setSessionId(data.session_id);

              addAssistantMessage(data.answer, {
                sources: data.sources || [],
                smartInfo: data.smart_info || null,
                enhancedQuery: data.enhanced_query || null,
                runId: data.run_id || null,
              });

              // ═══ Persist fallback assistant message ═══
              if (user && convId) {
                saveMessage(convId, {
                  role: 'assistant',
                  content: data.answer,
                  sources: data.sources,
                  smartInfo: data.smart_info,
                  enhancedQuery: data.enhanced_query,
                  runId: data.run_id,
                }).catch(() => {});
              }
            } catch (fallbackErr) {
              if (fallbackErr.name === 'AbortError') return;
              addAssistantMessage(
                'Sorry, I encountered an error processing your request. Please try again.',
                {}
              );
            }
          },
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          cancelStreaming();
          addAssistantMessage(
            'Sorry, I encountered an error processing your request. Please try again.',
            {}
          );
        }
      }
    },
    [
      namespace,
      sessionId,
      conversationId,
      settings,
      isStreaming,
      addUserMessage,
      addAssistantMessage,
      startStreaming,
      appendStreamToken,
      finishStreaming,
      cancelStreaming,
      setSessionId,
      setConversationId,
      setConversations,
      isMaxTurns,
    ]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    cancelStreaming();
  }, [cancelStreaming]);

  return { send, stop, isStreaming };
}
