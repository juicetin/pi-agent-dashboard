/**
 * Status header — displays mode, state, endpoint, cacheChars, sessionKey.
 * Task 6.4.
 */
import React from "react";
import type { HonchoPluginStatus, RedactedHonchoPluginConfig } from "../shared/types.js";

const STATE_COLORS: Record<string, string> = {
  connected: "text-green-400",
  running: "text-green-400",
  configured: "text-blue-400",
  syncing: "text-yellow-400",
  starting: "text-yellow-400",
  stopped: "text-[var(--text-muted)]",
  offline: "text-red-400",
  "docker-missing": "text-red-400",
  "port-conflict": "text-red-400",
  uninstalled: "text-[var(--text-muted)]",
};

export function StatusHeader({
  status,
  config,
}: {
  status: HonchoPluginStatus | null;
  config: RedactedHonchoPluginConfig;
}) {
  const state = status?.state ?? "unknown";
  const mode = status?.mode ?? config.mode ?? "cloud";
  const endpoint = status?.endpoint ?? config.hosts?.pi?.endpoint ?? "honcho.dev";
  const cacheChars = status?.cacheChars ?? 0;
  const sessionKey = status?.sessionKey ?? null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs border-b border-[var(--border)] pb-2 mb-2">
      <span className="text-[var(--text-muted)]">
        Mode: <span className="text-[var(--text)]">{mode}</span>
      </span>
      <span className="text-[var(--text-muted)]">
        State:{" "}
        <span className={STATE_COLORS[state] ?? "text-[var(--text)]"}>
          {state}
        </span>
      </span>
      <span className="text-[var(--text-muted)]">
        Endpoint: <span className="text-[var(--text)] font-mono">{endpoint}</span>
      </span>
      <span className="text-[var(--text-muted)]">
        Cache: <span className="text-[var(--text)]">{cacheChars.toLocaleString()} chars</span>
      </span>
      {sessionKey && (
        <span className="text-[var(--text-muted)]">
          Session: <span className="text-[var(--text)] font-mono">{sessionKey}</span>
        </span>
      )}
    </div>
  );
}
