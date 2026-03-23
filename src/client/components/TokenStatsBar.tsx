import React from "react";
import type { TurnStat } from "../lib/event-reducer.js";

interface Props {
  turnStats: TurnStat[];
  contextUsage?: { tokens: number | null; contextWindow: number };
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TokenStatsBar({ turnStats, contextUsage, tokensIn, tokensOut, cost }: Props) {
  const maxTokens = turnStats.reduce(
    (max, t) => Math.max(max, t.input + t.output + t.cacheRead),
    0
  );

  const contextPercent =
    contextUsage?.tokens != null && contextUsage.contextWindow > 0
      ? (contextUsage.tokens / contextUsage.contextWindow) * 100
      : null;

  const contextWarning = contextPercent != null && contextPercent > 80;

  return (
    <div className="px-4 py-2 border-b border-gray-800 space-y-1.5">
      {/* Per-turn bar chart */}
      {turnStats.length > 0 && (
        <div className="flex items-end gap-px h-8">
          {turnStats.map((turn, i) => {
            const total = turn.input + turn.output + turn.cacheRead;
            const scale = maxTokens > 0 ? total / maxTokens : 0;
            const height = Math.max(scale * 100, 4); // min 4% so bars are visible
            const inputPct = total > 0 ? (turn.input / total) * 100 : 0;
            const outputPct = total > 0 ? (turn.output / total) * 100 : 0;
            const cachePct = total > 0 ? (turn.cacheRead / total) * 100 : 0;

            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end min-w-[3px] max-w-[12px]"
                style={{ height: "100%" }}
                title={`In: ${formatTokens(turn.input)} Out: ${formatTokens(turn.output)} Cache: ${formatTokens(turn.cacheRead)}`}
              >
                <div
                  className="w-full flex flex-col overflow-hidden rounded-sm"
                  style={{ height: `${height}%` }}
                >
                  {cachePct > 0 && (
                    <div className="bg-green-500" style={{ height: `${cachePct}%` }} />
                  )}
                  <div className="bg-blue-500" style={{ height: `${inputPct}%` }} />
                  <div className="bg-gray-500" style={{ height: `${outputPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context window progress bar */}
      {contextUsage && contextUsage.contextWindow > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{contextUsage.tokens != null ? formatTokens(contextUsage.tokens) : "—"}</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            {contextPercent != null && (
              <div
                className={`h-full rounded-full transition-all ${contextWarning ? "bg-yellow-500" : "bg-gray-500"}`}
                style={{ width: `${Math.min(contextPercent, 100)}%` }}
              />
            )}
          </div>
          <span>{formatTokens(contextUsage.contextWindow)}</span>
        </div>
      )}

      {/* Token counters and cost */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>↓{formatTokens(tokensIn)}</span>
        <span>↑{formatTokens(tokensOut)}</span>
        {cost > 0 && <span>${cost.toFixed(4)}</span>}
      </div>
    </div>
  );
}
