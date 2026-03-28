import React, { useState, useEffect } from "react";
import Icon from "@mdi/react";
import { mdiPencilOutline, mdiArrowLeft } from "@mdi/js";
import type { DashboardSession, OpenSpecChange } from "../../shared/types.js";
import type { SessionState } from "../lib/event-reducer.js";
import type { DetectedEditor } from "../lib/editor-api.js";
import { getSessionDisplayName } from "../lib/session-display-name.js";
import { InlineRenameInput } from "./InlineRenameInput.js";
import { MobileActionMenu } from "./MobileActionMenu.js";
import { useMobile } from "../hooks/useMobile.js";

interface Props {
  session?: DashboardSession;
  state: SessionState;
  onRename?: (sessionId: string, name: string) => void;
  showBack?: boolean;
  onBack?: () => void;
  /** Mobile action menu props (only used on mobile) */
  mobileActions?: {
    editors?: DetectedEditor[];
    openspecChanges?: OpenSpecChange[];
    onHide?: () => void;
    onUnhide?: () => void;
    onResume?: (mode: "continue" | "fork") => void;
    onShutdown?: () => void;
    onOpenEditor?: (editorId: string) => void;
    onAttachProposal?: (changeName: string) => void;
    onDetachProposal?: () => void;
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function SessionHeader({ session, state, onRename, showBack, onBack, mobileActions }: Props) {
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

  const isMobile = useMobile();

  // Mobile: compact header with back + name + kebab
  if (isMobile) {
    return (
      <div className="px-2 py-1 border-b border-[var(--border-primary)] flex items-center gap-2 text-sm min-h-[44px]">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title="Go back"
            data-testid="back-button"
          >
            <Icon path={mdiArrowLeft} size={0.7} />
          </button>
        )}
        {isRenaming ? (
          <InlineRenameInput
            currentName={getSessionDisplayName(session)}
            onConfirm={handleConfirmRename}
            onCancel={() => setIsRenaming(false)}
            className="font-medium flex-1"
          />
        ) : (
          <span className="font-medium truncate flex-1">{getSessionDisplayName(session)}</span>
        )}
        {mobileActions && (
          <MobileActionMenu
            session={session}
            editors={mobileActions.editors}
            openspecChanges={mobileActions.openspecChanges}
            onRename={canRename ? () => setIsRenaming(true) : undefined}
            onHide={mobileActions.onHide}
            onUnhide={mobileActions.onUnhide}
            onResume={mobileActions.onResume}
            onShutdown={mobileActions.onShutdown}
            onOpenEditor={mobileActions.onOpenEditor}
            onAttachProposal={mobileActions.onAttachProposal}
            onDetachProposal={mobileActions.onDetachProposal}
          />
        )}
      </div>
    );
  }

  // Desktop: full header
  return (
    <div className="px-4 py-2 border-b border-[var(--border-primary)] flex items-center gap-4 text-sm">
      {showBack && onBack && (
        <button
          onClick={onBack}
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-0.5"
          title="Go back"
          data-testid="back-button"
        >
          <Icon path={mdiArrowLeft} size={0.65} />
        </button>
      )}
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
