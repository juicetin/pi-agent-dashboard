import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export interface HarnessDetail {
  label: string;
  value: string;
}

export function findHarnessStatus(session: DashboardSession) {
  return Object.values(session.uiDecorators ?? {}).find(
    (decorator) => decorator.kind === "footer-segment" && decorator.namespace === "harness" && decorator.id === "current-run",
  );
}

export function parseHarnessTooltip(tooltip?: string): HarnessDetail[] {
  return (tooltip ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(": ");
      if (colonIdx === -1) return { label: "Detail", value: line };
      return {
        label: line.slice(0, colonIdx),
        value: line.slice(colonIdx + 2),
      };
    });
}

export function harnessDetailValue(details: HarnessDetail[], label: string): string | undefined {
  return details.find((detail) => detail.label.toLowerCase() === label.toLowerCase())?.value;
}

export function harnessPhaseLabel(phase?: string): string {
  switch ((phase ?? "").toLowerCase()) {
    case "define":
      return "Planning";
    case "execute":
      return "Execute";
    case "validate":
      return "Validate";
    case "complete":
    case "completed":
      return "Complete";
    default:
      return phase || "Harness";
  }
}

export function harnessPhaseTone(phase?: string): "planning" | "execute" | "validate" | "complete" | "default" {
  switch ((phase ?? "").toLowerCase()) {
    case "define":
      return "planning";
    case "execute":
      return "execute";
    case "validate":
      return "validate";
    case "complete":
    case "completed":
      return "complete";
    default:
      return "default";
  }
}

export const HARNESS_PHASE_TONE_CLASS: Record<ReturnType<typeof harnessPhaseTone>, string> = {
  planning: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  execute: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  validate: "border-violet-500/40 bg-violet-500/15 text-violet-200",
  complete: "border-slate-500/40 bg-slate-500/15 text-slate-200",
  default: "border-blue-500/40 bg-blue-500/15 text-blue-200",
};

export function extractHarnessTaskId(task?: string): string | null {
  if (!task || task.toLowerCase().startsWith("none")) return null;
  return task.match(/^\S+/)?.[0] ?? task;
}

export function formatHarnessUrlLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
