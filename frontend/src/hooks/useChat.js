// ──────────────────────────────────────────
// useChat hook — orchestrates sending messages (streaming + fallback)
// ──────────────────────────────────────────
import { useCallback, useRef } from 'react';
import useChatStore from '@/store/useChatStore';
import { chatStreaming, chatNonStreaming } from '@/utils/api';

export default function useChat() {
  const abortRef = useRef(null);
  const metaRef = useRef({});

  const {
    namespace,
    sessionId,
    settings,
    isStreaming,
    addUserMessage,
    addAssistantMessage,
    startStreaming,
    appendStreamToken,
    finishStreaming,
    cancelStreaming,
    setSessionId,
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
            finishStreaming(metaRef.current);
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
      settings,
      isStreaming,
      addUserMessage,
      addAssistantMessage,
      startStreaming,
      appendStreamToken,
      finishStreaming,
      cancelStreaming,
      setSessionId,
      isMaxTurns,
    ]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    cancelStreaming();
  }, [cancelStreaming]);

  return { send, stop, isStreaming };
}
