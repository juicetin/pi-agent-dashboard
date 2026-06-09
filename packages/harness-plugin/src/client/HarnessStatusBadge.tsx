import React from "react";
import Icon from "@mdi/react";
import { mdiClipboardCheckOutline } from "@mdi/js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

function findHarnessStatus(session: DashboardSession) {
  return Object.values(session.uiDecorators ?? {}).find(
    (decorator) => decorator.kind === "footer-segment" && decorator.namespace === "harness" && decorator.id === "current-run",
  );
}

export function HarnessStatusBadge({ session }: { session: DashboardSession }): React.ReactElement | null {
  const status = findHarnessStatus(session);
  if (!status || status.kind !== "footer-segment") return null;

  return (
    <span
      data-testid="harness-status-badge"
      title={status.payload.tooltip}
      className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded font-mono text-[10px] border border-blue-500/30 text-blue-300 bg-blue-500/10"
      style={{ verticalAlign: "middle" }}
    >
      <Icon path={mdiClipboardCheckOutline} size={0.5} />
      <span>{status.payload.text}</span>
    </span>
  );
}
