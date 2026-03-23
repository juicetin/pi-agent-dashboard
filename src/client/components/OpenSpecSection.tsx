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
      className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-blue-400 hover:border-blue-500/50"
    >
      {label}
    </button>
  );
}

function ArtifactDots({ artifacts }: { artifacts: OpenSpecChange["artifacts"] }) {
  return (
    <div className="flex items-center gap-1">
      {artifacts.map((a) => (
        <span
          key={a.id}
          className={`w-1.5 h-1.5 rounded-full ${
            a.status === "done" ? "bg-green-500" : a.status === "ready" ? "bg-yellow-500" : "bg-gray-600"
          }`}
          title={`${a.id}: ${a.status}`}
        />
      ))}
    </div>
  );
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

  const isComplete = change.status === "complete";
  const hasTasks = change.totalTasks > 0;

  return (
    <>
      <div className="px-2 py-1.5 rounded bg-gray-800/50 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-300 truncate">{change.name}</span>
          <ArtifactDots artifacts={change.artifacts} />
        </div>
        {hasTasks && (
          <div className="text-[10px] text-gray-500">
            {change.completedTasks}/{change.totalTasks} tasks
          </div>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          <ActionButton label="Explore" onClick={() => setExploreOpen(true)} />
          {!isComplete && (
            <>
              <ActionButton label="Continue" onClick={() => onSendPrompt?.(`/opsx:continue ${change.name}`)} />
              <ActionButton label="FF" onClick={() => onSendPrompt?.(`/opsx:ff ${change.name}`)} />
            </>
          )}
          {isComplete && (
            <>
              <ActionButton label="Apply" onClick={() => onSendPrompt?.(`/opsx:apply ${change.name}`)} />
              <ActionButton label="Archive" onClick={() => setConfirmOpen(true)} />
            </>
          )}
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
  const inProgress = data.changes.filter((c) => c.status !== "complete");
  const completed = data.changes.filter((c) => c.status === "complete");

  return (
    <div className="space-y-2" data-testid="openspec-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase">OpenSpec</span>
        {onRefresh && (
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="text-gray-600 hover:text-gray-300"
            title="Refresh"
            data-testid="openspec-refresh"
          >
            <Icon path={mdiRefresh} size={0.5} />
          </button>
        )}
      </div>

      {/* In progress */}
      {inProgress.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-600">In Progress</span>
          {inProgress.map((c) => (
            <ChangeCard key={c.name} change={c} onSendPrompt={onSendPrompt} />
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-600">Completed</span>
          {completed.map((c) => (
            <ChangeCard key={c.name} change={c} onSendPrompt={onSendPrompt} />
          ))}
        </div>
      )}

      {/* New Change */}
      <button
        onClick={(e) => { e.stopPropagation(); onSendPrompt?.("/opsx:new"); }}
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-400"
        data-testid="openspec-new"
      >
        <Icon path={mdiPlus} size={0.45} />
        New Change
      </button>
    </div>
  );
}
