// ──────────────────────────────────────────
// API client — handles streaming (SSE) and non-streaming requests
// ──────────────────────────────────────────
import { API_BASE, BACKEND_BASE } from '@/constants';

/**
 * Check backend health.
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${BACKEND_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch available namespaces from the backend.
 * @returns {Promise<string[]>}
 */
export async function fetchNamespaces() {
  const res = await fetch(`${API_BASE}/namespaces`);
  if (!res.ok) throw new Error('Failed to fetch namespaces');
  const data = await res.json();
  return data.namespaces ?? data;
}

/**
 * Build the request payload for chat endpoints.
 */
function buildPayload({ query, namespace, sessionId, settings }) {
  return {
    query,
    namespace,
    session_id: sessionId || undefined,
    enhance_query: settings.enhanceQuery ?? true,
    enable_smart: settings.enableSmart ?? false,
    top_k_retrieve: settings.topKRetrieve ?? 5,
  };
}

/**
 * Non-streaming chat request (fallback).
 */
export async function chatNonStreaming({ query, namespace, sessionId, settings, signal }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload({ query, namespace, sessionId, settings })),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

/**
 * Streaming chat via SSE.
 *
 * @param {Object} params
 * @param {Function} params.onToken      - Called with each text token
 * @param {Function} params.onMetadata   - Called with metadata object (sources, smart_info, etc.)
 * @param {Function} params.onDone       - Called when stream completes
 * @param {Function} params.onError      - Called on error
 * @param {AbortSignal} params.signal    - Abort signal
 */
export async function chatStreaming({
  query,
  namespace,
  sessionId,
  settings,
  onToken,
  onMetadata,
  onDone,
  onError,
  signal,
}) {
  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload({ query, namespace, sessionId, settings })),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Stream request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();

        if (data === '[DONE]') {
          onDone?.();
          return;
        }

        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'token' && parsed.content) {
            onToken(parsed.content);
          } else if (parsed.type === 'metadata') {
            onMetadata(parsed);
          } else if (parsed.type === 'error') {
            onError?.(new Error(parsed.message || parsed.content || 'Stream error'));
            return;
          }
        } catch {
          // Not JSON → treat as raw token
          if (data) onToken(data);
        }
      }
    }

    // Stream ended without [DONE]
    onDone?.();
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError?.(err);
  }
}
