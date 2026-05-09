/**
 * HonchoBadge — session-card-badge slot.
 * Returns null when extension uninstalled. Renders MDI brain + state as a pill.
 * Uses MDI icons for size consistency across OS/browsers (emoji renders inconsistently).
 * Task 7.1.
 */
import React from "react";
import Icon from "@mdi/react";
import { mdiBrain } from "@mdi/js";
import { useExtensionInstalled, useHonchoStatus } from "./hooks.js";

const STATE_STYLE: Record<string, { bg: string; fg: string }> = {
  connected:        { bg: "rgba(34, 197, 94, 0.15)",  fg: "rgb(134, 239, 172)" },
  running:          { bg: "rgba(34, 197, 94, 0.15)",  fg: "rgb(134, 239, 172)" },
  syncing:          { bg: "rgba(234, 179, 8, 0.15)",  fg: "rgb(253, 224, 71)" },
  starting:         { bg: "rgba(234, 179, 8, 0.15)",  fg: "rgb(253, 224, 71)" },
  configured:       { bg: "rgba(59, 130, 246, 0.15)", fg: "rgb(147, 197, 253)" },
  offline:          { bg: "rgba(239, 68, 68, 0.15)",  fg: "rgb(252, 165, 165)" },
  "docker-missing": { bg: "rgba(239, 68, 68, 0.15)",  fg: "rgb(252, 165, 165)" },
  "port-conflict":  { bg: "rgba(239, 68, 68, 0.15)",  fg: "rgb(252, 165, 165)" },
  stopped:          { bg: "rgba(107, 114, 128, 0.2)", fg: "rgb(209, 213, 219)" },
  uninstalled:      { bg: "rgba(107, 114, 128, 0.2)", fg: "rgb(209, 213, 219)" },
};

export function HonchoBadge() {
  const { installed, checking } = useExtensionInstalled();
  const { status } = useHonchoStatus();

  if (checking || !installed) return null;

  const state = status?.state ?? "offline";
  const { bg, fg } = STATE_STYLE[state] ?? STATE_STYLE.stopped;

  return (
    <span
      data-testid="honcho-badge"
      title={`Honcho: ${state}`}
      className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded font-mono text-[10px]"
      // verticalAlign: middle as inline style — Tailwind's `align-middle` class
      // isn't shipped (honcho-plugin source not in dashboard's Tailwind content
      // scan). Without this, the pill's baseline (driven by the SVG icon's
      // bottom edge) differs from sibling pills (jj:default, etc.) whose
      // baseline comes from text. Result: ~4px vertical offset between pills.
      style={{ background: bg, color: fg, verticalAlign: "middle" }}
    >
      {/* mdiBrain viewbox has more padding than other MDI icons; 0.6 ≈ 0.5 of siblings. */}
      <Icon path={mdiBrain} size={0.6} />
      <span>{state}</span>
    </span>
  );
}
