// ──────────────────────────────────────────
// useChat hook — orchestrates sending messages (streaming + fallback)
// ──────────────────────────────────────────
import { useCallback, useRef, useEffect } from 'react';
import useChatStore from '@/store/useChatStore';
import useAuthStore from '@/store/useAuthStore';
import { chatStreaming, chatNonStreaming } from '@/utils/api';
import { MAX_TURNS } from '@/constants';
import { createConversation, saveMessage, fetchConversations } from '@/lib/chatPersistence';

export default function useChat() {
  const abortRef = useRef(null);
  const metaRef = useRef({});
  const queueRef = useRef('');        // incoming token buffer
  const pumpRef = useRef(null);       // interval id for smooth typing
  const streamEndedRef = useRef(false);
  const finalizedRef = useRef(false);

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

  const stopPump = useCallback(() => {
    if (pumpRef.current) {
      clearInterval(pumpRef.current);
      pumpRef.current = null;
    }
  }, []);

  const resetQueue = useCallback(() => {
    queueRef.current = '';
    streamEndedRef.current = false;
    finalizedRef.current = false;
  }, []);

  const send = useCallback(
    async (query) => {
      if (!query.trim() || isStreaming) return;
      if (isMaxTurns()) return;

      // Capture existing messages (before appending the new user turn) to build chat history
      const priorMessages = [...useChatStore.getState().messages];

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

      // Build chat history payload from prior turns (exclude the new user message to avoid duplication)
      const chatHistory = priorMessages
        .slice(-MAX_TURNS * 2) // last N turns (user+assistant pairs)
        .map((m) => ({ role: m.role, content: m.content }));

      startStreaming();
      resetQueue();

      const flushAndFinish = () => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;

        if (queueRef.current.length > 0) {
          appendStreamToken(queueRef.current);
          queueRef.current = '';
        }

        stopPump();

        const finalContent = useChatStore.getState().streamingContent;
        finishStreaming(metaRef.current);

        // ═══ Persist assistant message ═══
        if (user && convId) {
          saveMessage(convId, {
            role: 'assistant',
            content: finalContent,
            sources: metaRef.current.sources,
            agenticInfo: metaRef.current.agenticInfo,
            enhancedQuery: metaRef.current.enhancedQuery,
            runId: metaRef.current.runId,
          }).catch(() => {});
        }
      };

      const ensurePump = () => {
        if (pumpRef.current) return;
        pumpRef.current = window.setInterval(() => {
          if (queueRef.current.length > 0) {
            const chunkSize = queueRef.current.length > 20 ? 4 : 2;
            const chunk = queueRef.current.slice(0, chunkSize);
            queueRef.current = queueRef.current.slice(chunkSize);
            appendStreamToken(chunk);
            return;
          }

          if (streamEndedRef.current) {
            flushAndFinish();
          }
        }, 18);
      };

      try {
        await chatStreaming({
          query: query.trim(),
          namespace,
          sessionId,
          settings,
          chatHistory,
          signal: abortRef.current.signal,

          onToken: (token) => {
            queueRef.current += token;
            ensurePump();
          },

          onMetadata: (meta) => {
            if (meta.sources) metaRef.current.sources = meta.sources;
            if (meta.agentic_info) metaRef.current.agenticInfo = meta.agentic_info;
            if (meta.enhanced_query) metaRef.current.enhancedQuery = meta.enhanced_query;
            if (meta.run_id) metaRef.current.runId = meta.run_id;
            if (meta.session_id) {
              metaRef.current.sessionId = meta.session_id;
              setSessionId(meta.session_id);
            }
          },

          onDone: () => {
            streamEndedRef.current = true;
            ensurePump();
          },

          onError: async (err) => {
            console.warn('Stream failed, falling back to non-streaming:', err.message);
            stopPump();
            resetQueue();
            cancelStreaming();

            try {
              const data = await chatNonStreaming({
                query: query.trim(),
                namespace,
                sessionId,
                settings,
                chatHistory,
                signal: abortRef.current.signal,
              });

              if (data.session_id) setSessionId(data.session_id);

              addAssistantMessage(data.answer, {
                sources: data.sources || [],
                agenticInfo: data.agentic_info || null,
                enhancedQuery: data.enhanced_query || null,
                runId: data.run_id || null,
              });

              // ═══ Persist fallback assistant message ═══
              if (user && convId) {
                saveMessage(convId, {
                  role: 'assistant',
                  content: data.answer,
                  sources: data.sources,
                  agenticInfo: data.agentic_info,
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
          stopPump();
          resetQueue();
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
      stopPump,
      resetQueue,
    ]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    stopPump();
    resetQueue();
    cancelStreaming();
  }, [cancelStreaming, resetQueue, stopPump]);

  // Cancel any ongoing streams if the user switches namespaces or conversations
  // This prevents the response from the previous chat bleeding into the new one
  useEffect(() => {
    return () => {
      if (isStreaming) {
        stop();
      }
    };
  }, [conversationId, namespace, isStreaming, stop]);

  return { send, stop, isStreaming };
}
