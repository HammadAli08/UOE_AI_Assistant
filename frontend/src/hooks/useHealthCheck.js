// ──────────────────────────────────────────
// useHealthCheck — periodic backend health polling
// ──────────────────────────────────────────
import { useEffect, useRef } from 'react';
import useChatStore from '@/store/useChatStore';
import { checkHealth } from '@/utils/api';

export default function useHealthCheck(intervalMs = 30000) {
  const setApiOnline = useChatStore((s) => s.setApiOnline);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const check = async () => {
      const ok = await checkHealth();
      if (mounted.current) setApiOnline(ok);
    };

    check(); // immediate
    const id = setInterval(check, intervalMs);

    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [intervalMs, setApiOnline]);
}
