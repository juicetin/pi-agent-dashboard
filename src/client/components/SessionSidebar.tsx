import React from "react";
import type { DashboardSession } from "../../shared/types.js";

interface Props {
  sessions: DashboardSession[];
  selectedId?: string;
  onSelect: (sessionId: string) => void;
}

const sourceIcons: Record<string, string> = {
  tui: "🖥",
  zed: "⚡",
  tmux: "📺",
  dashboard: "🌐",
  unknown: "❓",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  streaming: "bg-yellow-500 animate-pulse",
  idle: "bg-green-500",
  ended: "bg-gray-600",
};

function formatTokens(n?: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n?: number): string {
  if (!n) return "$0.00";
  return `$${n.toFixed(4)}`;
}

export function SessionSidebar({ sessions, selectedId, onSelect }: Props) {
  const active = sessions.filter((s) => s.status !== "ended");
  const ended = sessions.filter((s) => s.status === "ended");

  return (
    <div className="w-72 border-r border-gray-800 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Sessions</h2>
      </div>

      {/* Active sessions */}
      {active.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No active sessions</div>
      ) : (
        <ul>
          {active.map((session) => (
            <li
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`px-3 py-2 cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/50 ${
                selectedId === session.id ? "bg-gray-800" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[session.status] ?? "bg-gray-500"}`}
                />
                <span className="text-sm font-medium truncate flex-1">
                  {session.cwd.split("/").pop() ?? session.id.slice(0, 8)}
                </span>
                <span className="text-xs" title={session.source}>
                  {sourceIcons[session.source] ?? "❓"}
                </span>
              </div>
              <div className="ml-4 mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                {session.model && <span className="truncate">{session.model}</span>}
              </div>
              <div className="ml-4 mt-0.5 flex items-center gap-3 text-xs text-gray-600">
                <span title="Tokens in">↓{formatTokens(session.tokensIn)}</span>
                <span title="Tokens out">↑{formatTokens(session.tokensOut)}</span>
                <span>{formatCost(session.cost)}</span>
                {session.currentTool && (
                  <span className="text-yellow-500">⚙ {session.currentTool}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Ended sessions */}
      {ended.length > 0 && (
        <details className="border-t border-gray-800">
          <summary className="px-3 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-800/50">
            Ended ({ended.length})
          </summary>
          <ul>
            {ended.map((session) => (
              <li
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`px-3 py-2 cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/50 opacity-60 ${
                  selectedId === session.id ? "bg-gray-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
                  <span className="text-sm truncate">
                    {session.cwd.split("/").pop() ?? session.id.slice(0, 8)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
