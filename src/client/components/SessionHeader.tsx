import React, { useState, useEffect } from "react";
import Icon from "@mdi/react";
import { mdiPencilOutline } from "@mdi/js";
import type { DashboardSession } from "../../shared/types.js";
import type { SessionState } from "../lib/event-reducer.js";
import { getSessionDisplayName } from "../lib/session-display-name.js";
import { InlineRenameInput } from "./InlineRenameInput.js";

interface Props {
  session?: DashboardSession;
  state: SessionState;
  onRename?: (sessionId: string, name: string) => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function SessionHeader({ session, state, onRename }: Props) {
  const [now, setNow] = useState(Date.now());
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!session) {
    return (
      <div className="px-4 py-2 border-b border-[var(--border-primary)] text-sm text-[var(--text-tertiary)]">
        No session selected
      </div>
    );
  }

  const duration = now - session.startedAt;
  const canRename = session.status !== "ended" && onRename;

  function handleConfirmRename(name: string) {
    setIsRenaming(false);
    if (onRename && session) {
      onRename(session.id, name);
    }
  }

  return (
    <div className="px-4 py-2 border-b border-[var(--border-primary)] flex items-center gap-4 text-sm">
      {isRenaming ? (
        <InlineRenameInput
          currentName={getSessionDisplayName(session)}
          onConfirm={handleConfirmRename}
          onCancel={() => setIsRenaming(false)}
          className="font-medium"
        />
      ) : (
        <span className="font-medium flex items-center gap-1">
          <span
            onDoubleClick={() => canRename && setIsRenaming(true)}
            className={canRename ? "cursor-pointer" : ""}
          >
            {getSessionDisplayName(session)}
          </span>
          {canRename && (
            <button
              onClick={() => setIsRenaming(true)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-0.5"
              title="Rename session"
            >
              <Icon path={mdiPencilOutline} size={0.5} />
            </button>
          )}
        </span>
      )}
      {(state.model || session.model) && <span className="text-[var(--text-secondary)]">{state.model || session.model}</span>}
      {(state.thinkingLevel || session.thinkingLevel) && (
        <span className="text-[var(--text-tertiary)]">💭 {state.thinkingLevel || session.thinkingLevel}</span>
      )}
      <span className="text-[var(--text-muted)] ml-auto">{formatDuration(duration)}</span>
    </div>
  );
}
