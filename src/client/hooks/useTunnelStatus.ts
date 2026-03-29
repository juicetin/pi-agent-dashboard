import { useState, useEffect, useCallback } from "react";
import type { TunnelStatus } from "../../shared/rest-api.js";

const POLL_INTERVAL = 30_000;

/**
 * Fetches tunnel status on mount and polls every 30s.
 * Returns the current TunnelStatus or null if unknown.
 */
export function useTunnelStatus(): TunnelStatus | null {
  const [status, setStatus] = useState<TunnelStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/tunnel-status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // ignore — server may be unreachable
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return status;
}
