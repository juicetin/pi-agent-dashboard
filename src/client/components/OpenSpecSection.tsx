import React, { useState } from "react";
import Icon from "@mdi/react";
import { mdiRefresh, mdiPlus } from "@mdi/js";
import type { OpenSpecData, OpenSpecChange } from "../../shared/types.js";
import { ExploreDialog } from "./ExploreDialog.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

interface Props {
  data: OpenSpecData;
  onSendPrompt?: (text: string) => void;
  onRefresh?: () => void;
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-blue-400 hover:border-blue-500/50"
    >
      {label}
    </button>
  );
}

const LETTER_MAP: Record<string, string> = {
  proposal: "P",
  design: "D",
  specs: "S",
  tasks: "T",
};

function artifactLetter(id: string): string {
  return LETTER_MAP[id] ?? id.charAt(0).toUpperCase();
}

function statusColor(status: string): string {
  if (status === "done") return "text-green-500";
  if (status === "ready") return "text-yellow-500";
  return "text-[var(--text-muted)]";
}

function ArtifactLetters({ artifacts }: { artifacts: OpenSpecChange["artifacts"] }) {
  return (
    <div className="flex items-center gap-1">
      {artifacts.map((a) => (
        <span
          key={a.id}
          data-testid="artifact-letter"
          title={`${a.id}: ${a.status}`}
          className={`text-[10px] font-bold font-mono ${statusColor(a.status)}`}
        >
          {artifactLetter(a.id)}
        </span>
      ))}
    </div>
  );
}

function allArtifactsDone(artifacts: OpenSpecChange["artifacts"]): boolean {
  return artifacts.length > 0 && artifacts.every((a) => a.status === "done");
}

function ChangeCard({
  change,
  onSendPrompt,
}: {
  change: OpenSpecChange;
  onSendPrompt?: (text: string) => void;
}) {
  const [exploreOpen, setExploreOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasTasks = change.totalTasks > 0;
  const canApply = allArtifactsDone(change.artifacts);
  const isComplete = change.status === "complete";

  return (
    <>
      <div className="px-2 py-1.5 space-y-1">
        {/* Line 1: name + letters + task count */}
        <div className="flex items-center gap-2">
          <span data-testid="change-name" className="text-[11px] font-medium text-[var(--text-secondary)] truncate">{change.name}</span>
          <ArtifactLetters artifacts={change.artifacts} />
          {hasTasks && (
            <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap ml-auto">
              {change.completedTasks}/{change.totalTasks} tasks
            </span>
          )}
        </div>
        {/* Line 2: action buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <ActionButton label="Explore" onClick={() => setExploreOpen(true)} />
          {!isComplete && (
            <>
              <ActionButton label="Continue" onClick={() => onSendPrompt?.(`/opsx:continue ${change.name}`)} />
              <ActionButton label="FF" onClick={() => onSendPrompt?.(`/opsx:ff ${change.name}`)} />
            </>
          )}
          {canApply && (
            <ActionButton label="Apply" onClick={() => onSendPrompt?.(`/opsx:apply ${change.name}`)} />
          )}
          <ActionButton label="Archive" onClick={() => setConfirmOpen(true)} />
        </div>
      </div>

      {exploreOpen && (
        <ExploreDialog
          changeName={change.name}
          onSend={(text) => {
            onSendPrompt?.(`/skill:openspec-explore ${change.name}\n${text}`);
            setExploreOpen(false);
          }}
          onClose={() => setExploreOpen(false)}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          message={`Archive "${change.name}"?`}
          confirmLabel="Archive"
          onConfirm={() => {
            onSendPrompt?.(`/opsx:archive ${change.name}`);
            setConfirmOpen(false);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export function OpenSpecSection({ data, onSendPrompt, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!data.initialized) return null;

  // Flat list: in-progress first, then completed
  const sorted = [
    ...data.changes.filter((c) => c.status !== "complete"),
    ...data.changes.filter((c) => c.status === "complete"),
  ];

  return (
    <div className="space-y-2" data-testid="openspec-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          data-testid="openspec-header"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase hover:text-[var(--text-secondary)]"
        >
          <span>{expanded ? "▼" : "▶"}</span>
          <span>OpenSpec</span>
        </button>
        {onRefresh && (
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title="Refresh"
            data-testid="openspec-refresh"
          >
            <Icon path={mdiRefresh} size={0.5} />
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {sorted.map((c) => (
            <ChangeCard key={c.name} change={c} onSendPrompt={onSendPrompt} />
          ))}

          <button
            onClick={(e) => { e.stopPropagation(); onSendPrompt?.("/opsx:new"); }}
            className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-blue-400"
            data-testid="openspec-new"
          >
            <Icon path={mdiPlus} size={0.45} />
            New Change
          </button>
        </>
      )}
    </div>
  );
}
