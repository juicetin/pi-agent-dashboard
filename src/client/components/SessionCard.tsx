import React, { type ReactNode } from "react";
import Icon from "@mdi/react";
import { mdiFlash, mdiKeyboard, mdiAlphaIBoxOutline, mdiPencil, mdiSourceBranch } from "@mdi/js";
import type { DashboardSession } from "../../shared/types.js";
import { formatRelativeTime } from "../lib/format.js";
import type { DetectedEditor } from "../lib/editor-api.js";
import { ContextUsageBar } from "./ContextUsageBar.js";
import type { ContextUsageInfo } from "./SessionList.js";
import type { OpenSpecData } from "../../shared/types.js";
import { OpenSpecSection } from "./OpenSpecSection.js";

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
    return <span className="text-yellow-400 truncate inline-flex items-center gap-0.5"><Icon path={mdiFlash} size={0.5} /> {session.currentTool}</span>;
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
      <Icon path={mdiSourceBranch} size={0.5} />
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
      <Icon path={mdiSourceBranch} size={0.5} />
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

const editorIcons: Record<string, ReactNode> = {
  zed: "Z",
  vscode: <Icon path={mdiKeyboard} size={0.5} />,
  idea: <Icon path={mdiAlphaIBoxOutline} size={0.5} />,
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
          <span className="inline-flex items-center gap-0.5">{editorIcons[editor.id] ?? <Icon path={mdiPencil} size={0.5} />} {editor.name}</span>
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
  contextUsage,
  openspecData,
  onSendPrompt,
  onOpenSpecRefresh,
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
  contextUsage?: ContextUsageInfo;
  openspecData?: OpenSpecData;
  onSendPrompt?: (text: string) => void;
  onOpenSpecRefresh?: () => void;
}) {
  const isSelected = selectedId === session.id;

  return (
    <li
      onClick={() => onSelect(session.id)}
      className={`px-3 py-2.5 cursor-pointer rounded-xl shadow-md shadow-black/40 border border-white/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${
        isSelected ? "bg-gray-800 border-l-2 border-l-blue-500/40" : ""
      } ${isHidden ? "opacity-40" : ""}`}
    >
      {/* Line 1: status dot + name + time */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[session.status] ?? "bg-gray-500"}`}
        />
        <span className="text-sm truncate flex-1">
          {session.cwd.split("/").pop() ?? session.id.slice(0, 8)}
        </span>
        <span className="text-[10px] text-gray-600">
          {formatRelativeTime(now - session.startedAt)}
        </span>
      </div>

      {/* Line 2: model + thinking level */}
      {session.model && (
        <div className="text-xs text-gray-500 mt-0.5 ml-4 truncate">
          {session.model}{session.thinkingLevel ? ` (${session.thinkingLevel})` : ""}
        </div>
      )}

      {/* Line 3: activity + cost */}
      <div className="flex items-center justify-between mt-0.5 ml-4 text-[11px] gap-2">
        <ActivityIndicator session={session} />
        {session.cost != null && session.cost > 0 && (
          <span className="text-gray-500">${session.cost.toFixed(2)}</span>
        )}
      </div>

      {/* Line 4: context usage bar */}
      <div className="mt-1 ml-4">
        <ContextUsageBar
          tokens={contextUsage?.tokens ?? null}
          contextWindow={contextUsage?.contextWindow}
        />
      </div>

      {/* Line 4: git info (only for single-session groups) */}
      {showGitInfo && <GitInfo session={session} />}

      {/* Thin divider before action row */}
      <div className="border-t border-gray-700/30 mt-1.5 pt-1.5 ml-4 flex items-center gap-2">
        {/* Editor buttons (left) */}
        {editors && editors.length > 0 && onOpenEditor && (
          <EditorButtons editors={editors} onOpen={onOpenEditor} />
        )}
        {/* Source badge */}
        <span className={`text-[10px] ${sourceBadgeColors[session.source] ?? "text-gray-500"}`}>
          {session.source}
        </span>
        {/* Spacer */}
        <span className="flex-1" />
        {/* Hide/unhide button (right) */}
        {isHidden ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnhide(session.id); }}
            className="text-[10px] text-gray-500 hover:text-green-400"
            title="Unhide session"
          >↩</button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onHide(session.id); }}
            className="text-[10px] text-gray-500 hover:text-red-400"
            title="Hide session"
          >✕</button>
        )}
      </div>

      {/* Accordion expanded section */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: isSelected ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {isSelected && openspecData?.initialized && (
            <div className="mt-2 pt-2 border-t border-gray-700/30">
              <OpenSpecSection
                data={openspecData}
                onSendPrompt={onSendPrompt}
                onRefresh={onOpenSpecRefresh}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
