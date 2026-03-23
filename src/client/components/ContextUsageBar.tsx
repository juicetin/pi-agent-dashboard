import React from "react";

interface Props {
  /** Tokens used, or null/undefined if unknown */
  tokens: number | null | undefined;
  /** Total context window size */
  contextWindow: number | undefined;
}

function getBarColor(pct: number): string {
  if (pct > 80) return "bg-red-500";
  if (pct > 50) return "bg-yellow-500";
  return "bg-green-500";
}

export function ContextUsageBar({ tokens, contextWindow }: Props) {
  const hasData = tokens != null && contextWindow != null && contextWindow > 0;
  const pct = hasData ? Math.min(100, (tokens / contextWindow) * 100) : 0;

  return (
    <div
      className="h-1 w-full rounded-full bg-gray-800 overflow-hidden"
      title={hasData ? `${Math.round(pct)}% context used (${tokens.toLocaleString()} / ${contextWindow.toLocaleString()})` : "No context data"}
      data-testid="context-usage-bar"
    >
      {hasData && (
        <div
          className={`h-full rounded-full ${getBarColor(pct)}`}
          style={{ width: `${pct}%` }}
          data-testid="context-usage-fill"
        />
      )}
    </div>
  );
}
