# Design: Derive parent repo root in the jj probe

## Context

Discovered while applying `add-jj-workspace-plugin` Phase 4c: the new
`workspaceRoot`-based group-key collapse compiled, tested, and shipped, but
real workspace sessions still appeared as separate top-level folder cards
in the sidebar because the probe value never differs from `cwd`.

Two layers contribute:

1. **Recipe layer** (`packages/shared/src/platform/jj.ts`). `JJ_WORKSPACE_ROOT`
   shells out to `jj workspace root`, which jj documents as "the working
   copy's root directory" — i.e. the **current workspace's** cwd, not the
   shared repo root.
2. **Probe layer** (`packages/extension/src/vcs-info.ts`). `gatherJjInfo`
   takes the recipe output verbatim and assigns it to `JjState.workspaceRoot`.

The spec (Decision 15) treats `workspaceRoot` as the **parent repo root**
(the path that hosts `.git` in a colocated setup, and that all sibling
workspaces share). Aligning the probe to that contract is the smallest
change that activates the already-shipped grouping.

## Decisions

### Decision 1 — Use `jj root` (the repo root command), not `jj workspace root`

**What:** Replace the `JJ_WORKSPACE_ROOT` recipe call inside `gatherJjInfo`
with `jj root --no-pager` (or equivalent). `jj root` returns the **repo
root** — the parent directory shared by all workspaces in the same repo —
which is exactly what `JjState.workspaceRoot` should carry per Decision 15.

**Why:** This is the canonical jj primitive for "what's the parent of all
workspaces in this repo?". For default workspaces it equals the working
copy root (no behaviour change). For non-default workspaces it returns the
parent, which is what the grouping logic expects.

**Add a new recipe** `JJ_REPO_ROOT` in `platform/jj.ts` rather than mutating
`JJ_WORKSPACE_ROOT`'s semantics — other call sites (e.g. fold-back
operations that genuinely need the workspace's own cwd) keep their existing
semantics. The probe simply switches which primitive it consults.

**Field naming clarification:** The shipped name `workspaceRoot` is now
arguably a misnomer — it carries the *repo* root, not the workspace's own
root. We keep the name as-is to avoid a breaking change to the protocol
type. The doc comment on `JjState.workspaceRoot` is updated to read
"absolute path of the **parent repo root** (== cwd for default workspace)".
A future change can rename the field if needed.

### Decision 2 — Fall back to `jj.workspaceRoot()` only on hard error

**What:** If `jj root` fails for any reason (older jj version without that
subcommand, unexpected error), the probe falls back to `jj workspace root`
to preserve the prior (broken-but-non-empty) behaviour rather than
returning `undefined`.

**Why:** `JjState.workspaceRoot` being non-empty is part of the predicate
gating the badge and the workspace list UI. A fallback keeps those
features working in degenerate environments while logging the error to
`lastError`. The spec already permits `lastError` for diagnostic info.

### Decision 3 — Live integration test, skip when `jj` is absent

**What:** Add `packages/extension/src/__tests__/vcs-info-jj-probe.test.ts`
that:

1. Skips when `jj` isn't on PATH or the registry resolution fails.
2. Creates a tmp dir, runs `git init` + `jj git init --colocate`.
3. Calls `gatherJjInfo` from the tmp root → asserts `workspaceRoot` equals
   the tmp root.
4. Runs `jj workspace add ./.shadow/probe-test` → calls `gatherJjInfo`
   from the new workspace cwd → asserts `workspaceRoot` equals the **tmp
   root** (parent), not the workspace cwd.

**Why:** Pure unit tests against the spec's contract values are insufficient
— they hide exactly the kind of probe/spec mismatch this proposal exists to
fix. A live test catches future regressions.

The skip-when-absent guard is consistent with the existing `jj`-resolution
unit test (Phase 1, Task 5).

## Alternatives Considered

- **Read `.jj/repo` directly from the filesystem.** For a non-default
  workspace, `.jj/repo` is a file pointing to the main repo's `.jj`
  directory; the parent of that path is the parent repo root. This avoids
  a subprocess but couples to jj's on-disk layout, which the project has
  been deliberately treating as opaque. Rejected.
- **Add a parallel `repoRoot?: string` field to `JjState` and consume it
  from the grouping logic.** Cleaner naming, but requires a protocol bump
  and dual-population during the transition. The cost outweighs the
  benefit since the field's value is what matters, not its name. Captured
  as a possible future cleanup.
