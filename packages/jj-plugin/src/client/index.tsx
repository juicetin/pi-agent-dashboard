/**
 * Client entry barrel for the jj-plugin.
 *
 * Phase-3 scaffold: predicates are real (gates work end-to-end), components
 * are placeholder shells that render minimal/no UI. Phase 4 fills the
 * component bodies (badge with workspace name, action bar with workspace
 * controls, sidebar list, content-area view, settings form).
 *
 * See change: add-jj-workspace-plugin.
 */
import React from "react";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export { isInJjRepo, isInJjWorkspace, isInGitRepoButNotJj } from "./predicates.js";

// ── Placeholder components (Phase 4 will implement) ────────────────────────

interface SessionProps {
  session: DashboardSession;
}

/**
 * Phase-3 placeholder. Phase 4: render a small chip showing
 * `session.jjState.workspaceName` with a tooltip listing bookmarks.
 */
export function JjWorkspaceBadge({ session }: SessionProps): React.ReactElement | null {
  const name = session.jjState?.workspaceName;
  if (!name) return null;
  return (
    <span
      data-testid="jj-workspace-badge"
      title={`jj workspace: ${name}`}
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontSize: "10px",
        borderRadius: "3px",
        background: "rgba(99, 102, 241, 0.15)",
        color: "rgb(165, 180, 252)",
        fontFamily: "monospace",
      }}
    >
      jj: {name}
    </span>
  );
}

/**
 * Phase-3 placeholder. Phase 4: render Add Workspace / Fold back / Forget
 * buttons + the opt-in "Enable jj workspaces" button on plain-git sessions.
 */
export function JjActionBar({ session: _session }: SessionProps): React.ReactElement | null {
  return null;
}

/** Phase-3 placeholder. Phase 4: per-folder collapsed workspace listing. */
export function JjWorkspaceList(): React.ReactElement | null {
  return null;
}

/** Phase-3 placeholder. Phase 4: full /jj content-area route. */
export function JjWorkspaceView(): React.ReactElement | null {
  return null;
}

/** Phase-3 placeholder. Phase 4: settings form bound to the configSchema. */
export function JjPluginSettings(): React.ReactElement {
  return (
    <div
      data-testid="jj-plugin-settings"
      style={{ padding: "8px", border: "1px dashed #555", borderRadius: "4px" }}
    >
      <div style={{ fontSize: "11px", color: "#999" }}>
        Jujutsu Workspaces — settings form lands in Phase 4.
      </div>
    </div>
  );
}
