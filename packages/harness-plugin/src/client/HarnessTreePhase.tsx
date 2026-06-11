import React, { useEffect, useId, useMemo, useState } from "react";
import Icon from "@mdi/react";
import { mdiClipboardCheckOutline } from "@mdi/js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import {
  extractHarnessTaskId,
  findHarnessStatus,
  harnessDetailValue,
  harnessPhaseLabel,
  harnessPhaseTone,
  HARNESS_PHASE_TONE_CLASS,
  parseHarnessTooltip,
} from "./harness-status-data.js";
import { HarnessStatusDialog } from "./HarnessStatusDialog.js";

/**
 * Compact harness phase pill for the session-card title row in the left tree.
 * Shows Planning / Execute / Validate at a glance; click opens full details.
 */
export function HarnessTreePhase({ session }: { session: DashboardSession }): React.ReactElement | null {
  const status = findHarnessStatus(session);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const details = useMemo(
    () => parseHarnessTooltip(status?.kind === "footer-segment" ? status.payload.tooltip : undefined),
    [status],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!status || status.kind !== "footer-segment") return null;

  const run = harnessDetailValue(details, "Run");
  const phase = harnessDetailValue(details, "Phase");
  const task = harnessDetailValue(details, "Task");
  const taskId = extractHarnessTaskId(task);
  const label = harnessPhaseLabel(phase);
  const tone = harnessPhaseTone(phase);
  const toneClass = HARNESS_PHASE_TONE_CLASS[tone];
  const accessibleName = ["Harness", label, taskId, "details"].filter(Boolean).join(" ");

  return (
    <>
      <button
        type="button"
        data-testid="harness-tree-phase"
        title={status.payload.tooltip}
        aria-label={accessibleName}
        className={`inline-flex max-w-full flex-shrink-0 items-center gap-1 rounded border px-1.5 py-[1px] font-mono text-[10px] shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${toneClass}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Icon path={mdiClipboardCheckOutline} size={0.45} className="flex-shrink-0 opacity-80" />
        <span className="truncate">{label}</span>
        {taskId ? <span className="flex-shrink-0 opacity-80">· {taskId}</span> : null}
      </button>
      <HarnessStatusDialog
        open={open}
        titleId={titleId}
        runLabel={run ?? status.payload.text}
        details={details}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
