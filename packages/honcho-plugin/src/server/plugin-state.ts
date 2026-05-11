/**
 * Plugin-process singleton state: current `HonchoPluginStatus`, an
 * in-flight compose operation lock, and a status-broadcast hook wired by
 * the runtime context.
 *
 * Tests reset state via `resetState()`.
 */
import type { HonchoPluginStatus } from "../shared/types.js";

let current: HonchoPluginStatus = {
  id: "honcho",
  state: "stopped",
  mode: "cloud",
  endpoint: "https://api.honcho.dev",
  cacheChars: 0,
  sessionKey: null,
};

type Broadcaster = (msg: unknown) => void;
let broadcaster: Broadcaster | null = null;

/** In-flight compose op promise (single-flight mutex for /server/{start,stop,restart}). */
let inFlight: Promise<HonchoPluginStatus> | null = null;

export function setBroadcaster(b: Broadcaster | null): void {
  broadcaster = b;
}

export function getStatus(): HonchoPluginStatus {
  return { ...current };
}

export function setStatus(patch: Partial<HonchoPluginStatus>): HonchoPluginStatus {
  current = { ...current, ...patch };
  try {
    broadcaster?.({ type: "honcho_plugin_status", status: { ...current } });
  } catch {
    /* never throw from broadcast */
  }
  // Also emit the intent-protocol broadcast for the session-card-memory
  // slot. This is GLOBAL (sessionId=null) because honcho status is process-
  // wide, not per-session. Connected clients render via the IntentStore
  // path; legacy honcho_plugin_status broadcast remains for the existing
  // useHonchoStatus polling helper. See change:
  // adopt-server-driven-intent-rendering.
  try {
    broadcaster?.({
      type: "plugin_intents",
      pluginId: "honcho",
      sessionId: null,
      slot: "session-card-memory",
      intent: {
        primitive: "ui:status-pill",
        props: {
          state: deriveStatusPillState(current.state),
          text: deriveStatusPillText(current.state),
          icon: "mdiBrain",
        },
      },
    });
  } catch {
    /* never throw from broadcast */
  }
  return { ...current };
}

/** Map honcho's internal state to the status-pill primitive's state enum. */
function deriveStatusPillState(
  s: HonchoPluginStatus["state"],
): "running" | "success" | "error" | "info" | "warn" | "muted" {
  switch (s) {
    case "running":
    case "connected":
      return "success";
    case "syncing":
    case "starting":
      return "warn";
    case "configured":
      return "info";
    case "offline":
    case "docker-missing":
    case "port-conflict":
      return "error";
    case "stopped":
    case "uninstalled":
    default:
      return "muted";
  }
}

function deriveStatusPillText(s: HonchoPluginStatus["state"]): string {
  // Reuse the state token as the label — matches honcho-plugin's badge today.
  return s;
}

export function resetState(): void {
  current = {
    id: "honcho",
    state: "stopped",
    mode: "cloud",
    endpoint: "https://api.honcho.dev",
    cacheChars: 0,
    sessionKey: null,
  };
  broadcaster = null;
  inFlight = null;
}

/** Single-flight wrapper: serialise concurrent compose ops. */
export async function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight) await inFlight.catch(() => undefined);
  const p = (async () => {
    return (await fn()) as unknown as HonchoPluginStatus;
  })();
  inFlight = p;
  try {
    return (await p) as unknown as T;
  } finally {
    if (inFlight === p) inFlight = null;
  }
}
