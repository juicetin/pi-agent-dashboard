import React from "react";
import type { TurnStat } from "../lib/event-reducer.js";
import { contextGradientColor } from "../lib/context-gradient.js";

interface Props {
  turnStats: TurnStat[];
  contextUsage?: { tokens: number | null; contextWindow: number };
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TokenStatsBar({ turnStats, contextUsage, tokensIn, tokensOut, cacheRead, cacheWrite, cost }: Props) {
  const maxTokens = turnStats.reduce(
    (max, t) => Math.max(max, t.input + t.output),
    0
  );

  const contextPercent =
    contextUsage?.tokens != null && contextUsage.contextWindow > 0
      ? (contextUsage.tokens / contextUsage.contextWindow) * 100
      : null;

  // Compute gradient color based on context usage percentage
  const gradientColor = contextPercent != null ? contextGradientColor(contextPercent) : null;

  // Latest turn for context bar segment proportions
  const latestTurn = turnStats.length > 0 ? turnStats[turnStats.length - 1] : null;
  const latestTotal = latestTurn
    ? latestTurn.cacheRead + latestTurn.cacheWrite + latestTurn.input + latestTurn.output
    : 0;

  return (
    <div className="px-4 py-2 border-b border-gray-800 space-y-1.5">
      {/* Per-turn bar chart */}
      {turnStats.length > 0 && (
        <div className="flex items-end gap-px h-8">
          {turnStats.map((turn, i) => {
            const total = turn.input + turn.output;
            const scale = maxTokens > 0 ? total / maxTokens : 0;
            const height = Math.max(scale * 100, 4); // min 4% so bars are visible
            const inputPct = total > 0 ? (turn.input / total) * 100 : 0;
            const outputPct = total > 0 ? (turn.output / total) * 100 : 0;

            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end min-w-[3px] max-w-[12px]"
                style={{ height: "100%" }}
                title={`In: ${formatTokens(turn.input)} Out: ${formatTokens(turn.output)}`}
              >
                <div
                  className="w-full flex flex-col overflow-hidden rounded-sm"
                  style={{ height: `${height}%` }}
                >
                  <div className="bg-blue-500" style={{ height: `${inputPct}%` }} />
                  <div className="bg-purple-500" style={{ height: `${outputPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context window stacked progress bar */}
      {contextUsage && contextUsage.contextWindow > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{contextUsage.tokens != null ? formatTokens(contextUsage.tokens) : "—"}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex" data-testid="context-bar">
            {contextPercent != null && latestTurn && latestTotal > 0 ? (
              <>
                {latestTurn.cacheRead > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(latestTurn.cacheRead / latestTotal) * contextPercent}%`, backgroundColor: gradientColor! }}
                  />
                )}
                {latestTurn.cacheWrite > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(latestTurn.cacheWrite / latestTotal) * contextPercent}%`, backgroundColor: gradientColor! }}
                  />
                )}
                <div
                  className="h-full transition-all"
                  style={{ width: `${(latestTurn.input / latestTotal) * contextPercent}%`, backgroundColor: gradientColor! }}
                />
                {latestTurn.output > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(latestTurn.output / latestTotal) * contextPercent}%`, backgroundColor: gradientColor! }}
                  />
                )}
              </>
            ) : contextPercent != null ? (
              <div
                className="h-full transition-all"
                style={{ width: `${Math.min(contextPercent, 100)}%`, backgroundColor: gradientColor! }}
              />
            ) : null}
          </div>
          <span>{formatTokens(contextUsage.contextWindow)}</span>
        </div>
      )}

      {/* Bar chart legend */}
      {turnStats.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
            input
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" />
            output
          </span>
        </div>
      )}

      {/* Token counters — cumulative, matching pi CLI format */}
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        <span>↑{formatTokens(tokensOut)}</span>
        <span>↓{formatTokens(tokensIn)}</span>
        {cacheRead > 0 && <span>R{formatTokens(cacheRead)}</span>}
        {cacheWrite > 0 && <span>W{formatTokens(cacheWrite)}</span>}
        {cost > 0 && <span>${cost.toFixed(4)}</span>}
      </div>
    </div>
  );
}
