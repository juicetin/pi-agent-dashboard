import React, { useState, useEffect } from "react";
import type { DashboardSession } from "../../shared/types.js";
import type { SessionState } from "../lib/event-reducer.js";

interface Props {
  session?: DashboardSession;
  state: SessionState;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SessionHeader({ session, state }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!session) {
    return (
      <div className="px-4 py-2 border-b border-gray-800 text-sm text-gray-500">
        No session selected
      </div>
    );
  }

  const duration = now - session.startedAt;

  return (
    <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-4 text-sm">
      <span className="font-medium">
        {session.cwd.split("/").pop() ?? session.id.slice(0, 8)}
      </span>
      {state.model && <span className="text-gray-400">{state.model}</span>}
      {state.thinkingLevel && (
        <span className="text-gray-500">💭 {state.thinkingLevel}</span>
      )}
      <span className="text-gray-500">
        ↓{formatTokens(state.tokensIn)} ↑{formatTokens(state.tokensOut)}
      </span>
      {state.cost > 0 && (
        <span className="text-gray-500">${state.cost.toFixed(4)}</span>
      )}
      <span className="text-gray-600 ml-auto">{formatDuration(duration)}</span>
    </div>
  );
}
