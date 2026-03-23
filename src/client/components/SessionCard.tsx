import React from "react";
import type { DashboardSession } from "../../shared/types.js";
import { formatTokens, formatRelativeTime } from "../lib/format.js";
import type { DetectedEditor } from "../lib/editor-api.js";

export const statusColors: Record<string, string> = {
  active: "bg-green-500",
  streaming: "bg-yellow-500 animate-pulse",
  idle: "bg-green-500",
  ended: "bg-gray-600",
};

export const sourceBadgeColors: Record<string, string> = {
  tui: "text-blue-400",
  zed: "text-purple-400",
  tmux: "text-orange-400",
  dashboard: "text-green-400",
  unknown: "text-gray-500",
};

export function ActivityIndicator({ session }: { session: DashboardSession }) {
  if (session.status === "ended") return null;

  if (session.currentTool) {
    return <span className="text-yellow-400 truncate">⚡ {session.currentTool}</span>;
  }

  if (session.status === "streaming") {
    return <span className="text-green-400">Thinking…</span>;
  }

  if (session.status === "idle") {
    return <span className="text-gray-500">Waiting for input</span>;
  }

  return null;
}

export function TokenStats({ session }: { session: DashboardSession }) {
  const hasStats = (session.tokensIn ?? 0) > 0 || (session.tokensOut ?? 0) > 0;
  if (!hasStats) return null;

  return (
    <span className="text-gray-500 whitespace-nowrap">
      {formatTokens(session.tokensIn ?? 0)}↑ {formatTokens(session.tokensOut ?? 0)}↓
      {(session.cacheRead ?? 0) > 0 && (
        <span className="ml-1">R{formatTokens(session.cacheRead ?? 0)}</span>
      )}
      {(session.cacheWrite ?? 0) > 0 && (
        <span className="ml-1">W{formatTokens(session.cacheWrite ?? 0)}</span>
      )}
      {session.cost != null && session.cost > 0 && (
        <span className="ml-1">${session.cost.toFixed(2)}</span>
      )}
    </span>
  );
}

export function GitInfo({ session }: { session: DashboardSession }) {
  if (!session.gitBranch) return null;

  return (
    <div className="text-[11px] mt-0.5 ml-4 flex items-center gap-1.5 text-gray-500">
      <span>🌿</span>
      {session.gitBranchUrl ? (
        <a href={session.gitBranchUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
          {session.gitBranch}
        </a>
      ) : (
        <span className="truncate">{session.gitBranch}</span>
      )}
      {session.gitPrNumber != null && (
        <>
          <span className="text-gray-600">·</span>
          {session.gitPrUrl ? (
            <a href={session.gitPrUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              #{session.gitPrNumber}
            </a>
          ) : (
            <span>#{session.gitPrNumber}</span>
          )}
        </>
      )}
    </div>
  );
}

export function GroupGitInfo({ sessions }: { sessions: DashboardSession[] }) {
  const session = sessions.find((s) => s.gitBranch);
  if (!session?.gitBranch) return null;

  return (
    <div className="text-[11px] flex items-center gap-1.5 text-gray-500">
      <span>🌿</span>
      {session.gitBranchUrl ? (
        <a href={session.gitBranchUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
          {session.gitBranch}
        </a>
      ) : (
        <span className="truncate">{session.gitBranch}</span>
      )}
      {session.gitPrNumber != null && (
        <>
          <span className="text-gray-600">·</span>
          {session.gitPrUrl ? (
            <a href={session.gitPrUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              #{session.gitPrNumber}
            </a>
          ) : (
            <span>#{session.gitPrNumber}</span>
          )}
        </>
      )}
    </div>
  );
}

const editorIcons: Record<string, string> = {
  zed: "Z",
  vscode: "⌨",
  idea: "🅸",
};

export function EditorButtons({
  editors,
  onOpen,
}: {
  editors: DetectedEditor[];
  onOpen: (editorId: string) => void;
}) {
  if (editors.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {editors.map((editor) => (
        <button
          key={editor.id}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(editor.id);
          }}
          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-blue-400 hover:border-blue-500/50"
          title={`Open in ${editor.name}`}
        >
          {editorIcons[editor.id] ?? "📝"} {editor.name}
        </button>
      ))}
    </div>
  );
}

export function SessionCard({
  session,
  selectedId,
  onSelect,
  now,
  showGitInfo,
  isHidden,
  onHide,
  onUnhide,
  editors,
  onOpenEditor,
}: {
  session: DashboardSession;
  selectedId?: string;
  onSelect: (id: string) => void;
  now: number;
  showGitInfo: boolean;
  isHidden: boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  editors?: DetectedEditor[];
  onOpenEditor?: (editorId: string) => void;
}) {
  return (
    <li
      onClick={() => onSelect(session.id)}
      className={`px-3 py-2 cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/50 ${
        selectedId === session.id ? "bg-gray-800" : ""
      } ${isHidden ? "opacity-40" : ""}`}
    >
      {/* Line 1: status dot + name + source + time + hide/unhide */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[session.status] ?? "bg-gray-500"}`}
        />
        <span className="text-sm truncate flex-1">
          {session.cwd.split("/").pop() ?? session.id.slice(0, 8)}
        </span>
        <span className={`text-[10px] ${sourceBadgeColors[session.source] ?? "text-gray-500"}`}>
          {session.source}
        </span>
        <span className="text-[10px] text-gray-600">
          {formatRelativeTime(now - session.startedAt)}
        </span>
        {isHidden ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnhide(session.id); }}
            className="text-[10px] text-gray-500 hover:text-green-400"
            title="Unhide session"
          >↩</button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onHide(session.id); }}
            className="text-[10px] text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
            title="Hide session"
          >✕</button>
        )}
      </div>

      {/* Line 2: model + thinking level */}
      {session.model && (
        <div className="text-xs text-gray-500 mt-0.5 ml-4 truncate">
          {session.model}{session.thinkingLevel ? ` (${session.thinkingLevel})` : ""}
        </div>
      )}

      {/* Line 3: activity + stats */}
      <div className="flex items-center justify-between mt-0.5 ml-4 text-[11px] gap-2">
        <ActivityIndicator session={session} />
        <TokenStats session={session} />
      </div>

      {/* Line 4: git info (only for single-session groups) */}
      {showGitInfo && <GitInfo session={session} />}

      {/* Line 5: editor buttons (single-session groups only) */}
      {editors && editors.length > 0 && onOpenEditor && (
        <div className="mt-1 ml-4">
          <EditorButtons editors={editors} onOpen={onOpenEditor} />
        </div>
      )}
    </li>
  );
}
