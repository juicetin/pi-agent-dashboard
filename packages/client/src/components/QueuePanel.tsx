/**
 * Mid-turn prompt queue panel.
 *
 * Renders above the chat input when the bridge-owned queue is non-empty.
 * Each chip shows the message text (truncated) and an X button to remove
 * that single entry. A "Clear all" button drops the entire queue.
 *
 * Render order keeps the LATEST entry visible at the right: when more than
 * `MAX_VISIBLE` entries are queued, the OLDEST entries collapse into a
 * "+N earlier" affordance on the left, and the most recent `MAX_VISIBLE`
 * entries render to its right (oldest-to-newest within the visible window).
 *
 * See capability `mid-turn-prompt-queue` / change `surface-mid-turn-prompt-queue`.
 */
import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import type { PendingPrompt } from "@blackbelt-technology/pi-dashboard-shared/types.js";

const MAX_VISIBLE = 5;

interface Props {
  pending: PendingPrompt[];
  onClearAll: () => void;
  onRemove: (id: string) => void;
}

export function QueuePanel({ pending, onClearAll, onRemove }: Props) {
  if (pending.length === 0) return null;

  const overflow = Math.max(0, pending.length - MAX_VISIBLE);
  // Keep latest entries visible (the user just typed them). Hide oldest in overflow.
  const visible = overflow > 0 ? pending.slice(pending.length - MAX_VISIBLE) : pending;

  return (
    <div
      data-testid="queue-panel"
      className="border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 px-3 py-2"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
          Queued ({pending.length})
        </div>
        <button
          type="button"
          onClick={onClearAll}
          data-testid="queue-panel-clear-all"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline-offset-2 hover:underline"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {overflow > 0 && (
          <div
            data-testid="queue-overflow"
            className="inline-flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-full px-2.5 py-0.5 text-xs text-[var(--text-tertiary)]"
            title={`${overflow} earlier message${overflow === 1 ? "" : "s"} hidden`}
          >
            +{overflow} earlier
          </div>
        )}
        {visible.map((p) => (
          <div
            key={p.id}
            data-testid="queue-chip"
            className="inline-flex items-center max-w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-full pl-2.5 pr-1 py-0.5 text-xs text-[var(--text-secondary)] gap-1.5 group"
            title={p.text}
          >
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide shrink-0">
              queued
            </span>
            <span className="truncate max-w-[280px]">{p.text}</span>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              data-testid="queue-chip-remove"
              aria-label="Remove from queue"
              title="Remove from queue"
              className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
            >
              <Icon path={mdiClose} size={0.45} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
