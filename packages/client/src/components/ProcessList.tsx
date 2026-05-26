import React from "react";
import { Icon } from "@mdi/react";
import { mdiClose, mdiCog } from "@mdi/js";

export interface ProcessEntry {
  pid: number;
  pgid: number;
  command: string;
  elapsedMs: number;
}

/**
 * Stable row floor: when the process list is non-empty, the rendered list
 * pads to this many row slots with invisible skeleton rows so the session
 * card footer height does not bounce.
 *
 * Stable row ceiling: at most this many real process rows are rendered.
 * Excess processes collapse into a single "+N more processes" overflow
 * row with a tooltip listing the hidden command lines.
 *
 * See change: tighten-process-list-ux.
 */
const MIN_SLOTS = 5;
const MAX_VISIBLE = 5;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes.toString().padStart(2, "0")}m`;
}

function truncateCommand(command: string, maxLen = 40): string {
  if (command.length <= maxLen) return command;
  return command.slice(0, maxLen - 1) + "…";
}

interface VisibleRows {
  visible: ProcessEntry[];
  overflow: ProcessEntry[];
  skeletonCount: number;
}

/**
 * Pure helper: sort by `elapsedMs` descending, slice to `MAX_VISIBLE`,
 * compute overflow + skeleton padding. Skeletons only pad when there is
 * no overflow row (floor and ceiling do not double-pad).
 *
 * Exported for unit tests.
 */
export function computeVisibleRows(processes: readonly ProcessEntry[]): VisibleRows {
  const sorted = [...processes].sort((a, b) => b.elapsedMs - a.elapsedMs);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.slice(MAX_VISIBLE);
  const skeletonCount = overflow.length === 0 ? Math.max(0, MIN_SLOTS - visible.length) : 0;
  return { visible, overflow, skeletonCount };
}

interface ProcessListProps {
  processes: ProcessEntry[];
  onKill: (pgid: number) => void;
  compact?: boolean;
}

export function ProcessList({ processes, onKill, compact }: ProcessListProps) {
  if (processes.length === 0) return null;

  const { visible, overflow, skeletonCount } = computeVisibleRows(processes);
  const overflowTitle = overflow.map((p) => p.command).join("\n");

  if (compact) {
    // Mobile: inline entries without header
    return (
      <div className="mt-1 space-y-0.5">
        {visible.map((p) => (
          <div key={p.pid} className="flex items-center gap-1.5 text-[11px]">
            <Icon path={mdiCog} size={0.4} className="text-[var(--text-muted)] flex-shrink-0" />
            <span className="text-[var(--text-secondary)] truncate flex-1" title={p.command}>
              {truncateCommand(p.command, 30)}
            </span>
            <span className="text-[var(--text-tertiary)] flex-shrink-0">{formatElapsed(p.elapsedMs)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onKill(p.pgid); }}
              className="text-[var(--text-muted)] hover:text-red-400 flex-shrink-0 p-0.5"
              title="Kill process"
            >
              <Icon path={mdiClose} size={0.35} />
            </button>
          </div>
        ))}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            aria-hidden="true"
            className="flex items-center gap-1.5 text-[11px]"
          >
            <Icon path={mdiCog} size={0.4} className="opacity-0 flex-shrink-0" />
            <span className="flex-1">&nbsp;</span>
          </div>
        ))}
        {overflow.length > 0 && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]"
            title={overflowTitle}
          >
            <Icon path={mdiCog} size={0.4} className="opacity-0 flex-shrink-0" />
            <span className="truncate flex-1">+{overflow.length} more processes</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mb-0.5">
        <Icon path={mdiCog} size={0.4} />
        <span>Processes</span>
      </div>
      {visible.map((p) => (
        <div key={p.pid} className="flex items-center gap-1.5 text-[11px] ml-1 pl-2 border-l border-[var(--border-subtle)]">
          <span className="text-[var(--text-secondary)] truncate flex-1" title={p.command}>
            {truncateCommand(p.command)}
          </span>
          <span className="text-[var(--text-tertiary)] flex-shrink-0">{formatElapsed(p.elapsedMs)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onKill(p.pgid); }}
            className="text-[var(--text-muted)] hover:text-red-400 flex-shrink-0 p-0.5"
            title="Kill process"
          >
            <Icon path={mdiClose} size={0.4} />
          </button>
        </div>
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          aria-hidden="true"
          className="flex items-center gap-1.5 text-[11px] ml-1 pl-2 border-l border-[var(--border-subtle)]"
        >
          <span className="flex-1">&nbsp;</span>
        </div>
      ))}
      {overflow.length > 0 && (
        <div
          className="flex items-center gap-1.5 text-[11px] ml-1 pl-2 border-l border-[var(--border-subtle)] text-[var(--text-tertiary)]"
          title={overflowTitle}
        >
          <span className="truncate flex-1">+{overflow.length} more processes</span>
        </div>
      )}
    </div>
  );
}
