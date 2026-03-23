import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DashboardSession } from "../../shared/types.js";
import {
  getHiddenSessionIds,
  setHiddenSessionIds,
  getActiveOnly,
  setActiveOnly as persistActiveOnly,
  pruneStaleHiddenIds,
} from "../lib/session-filter-storage.js";
import { SessionCard, GroupGitInfo, EditorButtons } from "./SessionCard.js";
import { useEditors } from "../lib/use-editors.js";
import { openEditor } from "../lib/editor-api.js";
import { Toast, useToast } from "./Toast.js";

interface Props {
  sessions: DashboardSession[];
  selectedId?: string;
  onSelect: (sessionId: string) => void;
}

/** Group sessions by cwd, ordered by most recent activity. */
export function groupSessionsByDirectory(sessions: DashboardSession[]): Array<{ cwd: string; sessions: DashboardSession[] }> {
  const groups = new Map<string, DashboardSession[]>();
  for (const session of sessions) {
    const existing = groups.get(session.cwd);
    if (existing) {
      existing.push(session);
    } else {
      groups.set(session.cwd, [session]);
    }
  }

  // Sort groups by most recent session startedAt (descending)
  return Array.from(groups.entries())
    .map(([cwd, sessions]) => ({ cwd, sessions }))
    .sort((a, b) => {
      const aMax = Math.max(...a.sessions.map((s) => s.startedAt));
      const bMax = Math.max(...b.sessions.map((s) => s.startedAt));
      return bMax - aMax;
    });
}

/** Apply filter pipeline: active-only → hidden → visible sessions */
export function filterSessions(
  sessions: DashboardSession[],
  activeOnly: boolean,
  hiddenSet: Set<string>,
  showHidden: boolean,
): DashboardSession[] {
  return sessions.filter((s) => {
    if (activeOnly && s.status === "ended") return false;
    if (hiddenSet.has(s.id) && !showHidden) return false;
    return true;
  });
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded border ${
        active
          ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
          : "border-gray-700 text-gray-500 hover:text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

export function SessionList({ sessions, selectedId, onSelect }: Props) {
  const now = Date.now();
  const { messages, showToast, dismissToast } = useToast();

  // Detect editors for all unique cwds
  const cwds = useMemo(() => sessions.map((s) => s.cwd), [sessions]);
  const editorMap = useEditors(cwds);

  const handleOpenEditor = useCallback(async (cwd: string, editorId: string) => {
    const result = await openEditor(cwd, editorId);
    if (!result.success) {
      showToast(result.error ?? "Failed to open editor");
    }
  }, [showToast]);

  // Filter state
  const [activeOnly, setActiveOnly] = useState(() => getActiveOnly());
  const [hiddenSet, setHiddenSet] = useState(() => getHiddenSessionIds());
  const [showHidden, setShowHidden] = useState(false);

  // Prune stale hidden IDs when sessions change
  useEffect(() => {
    if (sessions.length === 0) return;
    const knownIds = new Set(sessions.map((s) => s.id));
    const pruned = pruneStaleHiddenIds(knownIds);
    setHiddenSet(pruned);
  }, [sessions.length]);

  const handleActiveOnlyToggle = useCallback(() => {
    setActiveOnly((prev) => {
      const next = !prev;
      persistActiveOnly(next);
      return next;
    });
  }, []);

  const handleHide = useCallback((id: string) => {
    setHiddenSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      setHiddenSessionIds(next);
      return next;
    });
  }, []);

  const handleUnhide = useCallback((id: string) => {
    setHiddenSet((prev) => {
      const next = new Set(prev);
      next.delete(id);
      setHiddenSessionIds(next);
      return next;
    });
  }, []);

  const filteredSessions = useMemo(
    () => filterSessions(sessions, activeOnly, hiddenSet, showHidden),
    [sessions, activeOnly, hiddenSet, showHidden],
  );

  const hiddenCount = useMemo(() => {
    const afterActiveFilter = activeOnly
      ? sessions.filter((s) => s.status !== "ended")
      : sessions;
    return afterActiveFilter.filter((s) => hiddenSet.has(s.id)).length;
  }, [sessions, activeOnly, hiddenSet]);

  const groups = groupSessionsByDirectory(filteredSessions);

  return (
    <div className="w-64 border-r border-gray-800 overflow-y-auto">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">Sessions</h2>
          <div className="flex gap-1">
            <ToggleButton active={activeOnly} onClick={handleActiveOnlyToggle}>
              Active only
            </ToggleButton>
            <ToggleButton active={showHidden} onClick={() => setShowHidden((p) => !p)}>
              Show hidden
            </ToggleButton>
          </div>
        </div>
      </div>
      {filteredSessions.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No active sessions</div>
      ) : (
        <ul>
          {groups.map((group) => {
            const dirName = group.cwd.split("/").pop() ?? group.cwd;
            const isMulti = group.sessions.length > 1;

            if (isMulti) {
              return (
                <React.Fragment key={group.cwd}>
                  {/* Group header */}
                  <li className="px-3 py-1.5 bg-gray-900/50 border-b border-gray-800/50">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-400 truncate">📁 {dirName}</span>
                      <span className="text-[10px] text-gray-600">({group.sessions.length})</span>
                    </div>
                    <GroupGitInfo sessions={group.sessions} />
                    {editorMap.get(group.cwd)?.length ? (
                      <div className="mt-1">
                        <EditorButtons
                          editors={editorMap.get(group.cwd)!}
                          onOpen={(editorId) => handleOpenEditor(group.cwd, editorId)}
                        />
                      </div>
                    ) : null}
                  </li>
                  {group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      now={now}
                      showGitInfo={false}
                      isHidden={hiddenSet.has(session.id)}
                      onHide={handleHide}
                      onUnhide={handleUnhide}
                    />
                  ))}
                </React.Fragment>
              );
            }

            return (
              <SessionCard
                key={group.sessions[0].id}
                session={group.sessions[0]}
                selectedId={selectedId}
                onSelect={onSelect}
                now={now}
                showGitInfo={true}
                isHidden={hiddenSet.has(group.sessions[0].id)}
                onHide={handleHide}
                onUnhide={handleUnhide}
                editors={editorMap.get(group.cwd)}
                onOpenEditor={(editorId) => handleOpenEditor(group.cwd, editorId)}
              />
            );
          })}
        </ul>
      )}
      {hiddenCount > 0 && !showHidden && (
        <div className="p-2 text-center text-[11px] text-gray-600">
          {hiddenCount} hidden
        </div>
      )}
      <Toast messages={messages} onDismiss={dismissToast} />
    </div>
  );
}
