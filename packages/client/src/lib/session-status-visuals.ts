/**
 * Shared session-status visual primitives used by `SessionCard` (left-gutter
 * dot/source-icon) and `FolderOpenSpecSection` linked-session rows.
 *
 * Single source of truth for:
 *   - status → bg-color palette
 *   - source → mdi icon + label
 *   - dotColor derivation (with optional chat-panel error/retry flags)
 *   - dotColor → text-color mirror used when the source icon doubles as the
 *     status indicator
 *   - icon-only pulse rule (folder pills do not get card-level pulse stripes)
 *
 * See change: add-session-status-to-folder-proposal-rows
 */

import { mdiConsoleLine, mdiRobotOutline, mdiApplicationOutline, mdiCodeTags } from "@mdi/js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export const statusColors: Record<string, string> = {
  active: "bg-green-500",
  streaming: "bg-yellow-500 animate-pulse",
  idle: "bg-green-500",
  ended: "bg-[var(--bg-surface)]",
};

export const sourceBadgeColors: Record<string, string> = {
  tui: "text-blue-400",
  zed: "text-purple-400",
  tmux: "text-orange-400",
  dashboard: "text-blue-400",
  terminal: "text-cyan-400",
  unknown: "text-[var(--text-tertiary)]",
};

export const sourceIcons: Record<string, string> = {
  tui: mdiConsoleLine,
  dashboard: mdiRobotOutline,
  tmux: mdiApplicationOutline,
  zed: mdiCodeTags,
  terminal: mdiConsoleLine,
};

export const sourceLabels: Record<string, string> = {
  tui: "TUI",
  dashboard: "Headless",
  tmux: "tmux",
  zed: "Zed",
  terminal: "Terminal",
};

/**
 * Status-only dot color. Callers without chat-panel error/retry signals
 * (e.g. folder section) use this. Mirrors the `statusColors` palette with an
 * explicit fallback for unknown status.
 */
export function deriveDotColor(session: DashboardSession): string {
  if (session.resuming) return "bg-yellow-500 animate-pulse";
  return statusColors[session.status] ?? "bg-[var(--bg-surface)]";
}

/**
 * Full dot-color derivation as used by `SessionCard`. `hasError` and
 * `isRetrying` come from the chat panel; folder pills do NOT have these.
 */
export function deriveDotColorWithFlags(
  session: DashboardSession,
  flags: { hasError?: boolean; isRetrying?: boolean },
): string {
  if (session.resuming) return "bg-yellow-500 animate-pulse";
  if (flags.hasError) return "bg-red-500";
  if (flags.isRetrying) return "bg-amber-500 animate-pulse";
  return statusColors[session.status] ?? "bg-[var(--bg-surface)]";
}

/**
 * Mirror the bg-color into a text-color for use when the source icon doubles
 * as the status indicator. Ended sessions get a muted token — BUT only when
 * the dotColor was actually the ended palette (`bg-[var(--bg-surface)]`).
 * If resuming / hasError / isRetrying overrode the dotColor (yellow / red /
 * amber), honor the override so the icon matches the dot. Also defends
 * against arbitrary `bg-[var(...)]` tokens by only replacing leading
 * `bg-<palette>` forms.
 */
export function deriveIconStatusColor(
  dotColor: string,
  status: DashboardSession["status"],
): string {
  if (status === "ended" && dotColor.startsWith("bg-[var(--bg-surface)]")) {
    return "text-[var(--text-muted)]";
  }
  return dotColor.replace(/\bbg-(?!\[)/g, "text-");
}

/**
 * Icon-only pulse rule. Folder pills attach this directly to the icon's
 * className — they do NOT get card-level pulse stripes.
 */
export function pulseClassForStatus(session: DashboardSession): string {
  if (session.resuming) return "animate-pulse";
  if (session.status === "streaming") return "animate-pulse";
  return "";
}
