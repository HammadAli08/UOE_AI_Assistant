// ──────────────────────────────────────────
// useHealthCheck — resilient periodic backend health polling
// ──────────────────────────────────────────
import { useEffect, useRef } from 'react';
import useChatStore from '@/store/useChatStore';
import { checkHealth } from '@/utils/api';

const FAILURES_BEFORE_OFFLINE = 3;

export default function useHealthCheck(intervalMs = 30000) {
  const setApiOnline = useChatStore((s) => s.setApiOnline);
  const mounted = useRef(true);
  const consecutiveFailures = useRef(0);
  const checkInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;

    const check = async () => {
      // Avoid overlapping probes if the backend is busy with a long RAG request.
      if (checkInFlight.current) return;
      checkInFlight.current = true;

      try {
        const ok = await checkHealth();
        if (!mounted.current) return;

        if (ok) {
          consecutiveFailures.current = 0;
          setApiOnline(true);
          return;
        }

        consecutiveFailures.current += 1;

        // A single delayed/failed health request must not mark the whole app offline.
        // Render/free-tier cold starts and long synchronous RAG work can delay /health.
        if (consecutiveFailures.current >= FAILURES_BEFORE_OFFLINE) {
          setApiOnline(false);
        }
      } finally {
        checkInFlight.current = false;
      }
    };

    check(); // immediate
    const id = setInterval(check, intervalMs);

    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [intervalMs, setApiOnline]);
}
