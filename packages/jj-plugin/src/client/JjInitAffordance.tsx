/**
 * The opt-in "Enable jj workspaces" button rendered on plain-git
 * sessions. Two gates apply:
 *
 *   1. Slot predicate `isInGitRepoButNotJj` — claim-level filter.
 *   2. Plugin config `showInitColocatedSuggestion` — read inside the
 *      component via `usePluginConfig`. Default `false` per Decision 11.
 *
 * Calling the endpoint runs `jj git init --colocate` after a precise
 * dirty-INDEX-only check; refuses 409 `DIRTY_INDEX` only on staged
 * changes. Working-tree dirt is allowed (jj snapshots it as the new `@`).
 *
 * See change: add-jj-workspace-plugin.
 */
import React, { useState } from "react";
import { Icon } from "@mdi/react";
import { mdiSourceMerge } from "@mdi/js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { usePluginConfig } from "@blackbelt-technology/dashboard-plugin-runtime/context";
import { initColocated } from "./api.js";
import type { JjPluginConfig } from "./JjPluginSettings.js";

export function JjInitAffordance({
  session,
}: {
  session: DashboardSession;
}): React.ReactElement | null {
  const config = usePluginConfig<JjPluginConfig>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plugin-config gate: hidden by default unless the user has opted in.
  if (!config.showInitColocatedSuggestion) return null;

  // Defensive predicate re-check (the slot-level predicate already filters,
  // but components are responsible for their own correctness).
  if (session.jjState?.isJjRepo) return null;
  if (!session.gitBranch) return null;

  const onClick = async () => {
    if (
      !window.confirm(
        `Run 'jj git init --colocate' in ${session.cwd}? This is non-destructive but adds .jj/ alongside .git/. Refuses if the git index has staged changes.`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await initColocated(session.cwd);
      if (!result.ok) {
        const messageFromData =
          result.data && typeof (result.data as { message?: unknown }).message === "string"
            ? (result.data as { message: string }).message
            : null;
        setError(messageFromData ?? result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="jj-init-affordance" className="flex items-center gap-1 text-[10px]">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        title="Convert this git repo to jj-colocated and unlock parallel-workspace tooling"
        className="inline-flex items-center px-1.5 py-[1px] rounded border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
        data-testid="jj-init-button"
      >
        <Icon path={mdiSourceMerge} size={0.45} className="inline mr-0.5" />
        Enable jj workspaces
      </button>
      {error && (
        <span
          className="text-[10px] text-red-400"
          data-testid="jj-init-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}
