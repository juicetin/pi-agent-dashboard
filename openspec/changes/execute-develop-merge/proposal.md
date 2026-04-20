## Why

Execute the `origin/develop` → local `develop` merge captured in `pre-merge-cleanup` and `adapt-windows-integration-pr9`. 20 conflicts remain after auto-merge. This change documents the per-file resolution decision for each conflict so the merge is auditable (PR reviewer can cross-reference commit → proposal).

## What Changes

Merge commit on local `develop` bringing in 45 `origin/develop` commits with documented conflict resolutions (below). Then push to `origin/windows-integration` to update PR #9.

### Conflict resolution table

| # | File | Resolution | Rationale |
|---|------|-----------|-----------|
| 1 | `AGENTS.md` | Union of both | Keep Windows/platform notes (ours) + new entries from develop (marketing site, CHANGELOG, etc.) |
| 2 | `openspec/changes/adapt-windows-integration-pr9/tasks.md` | Ours (HEAD) | Robert's file; develop shouldn't have touched it — accept ours |
| 3 | `openspec/changes/archive/2026-04-19-explore-dialog-image-paste-remove-terminal-button/.openspec.yaml` | Theirs | Spurious add/add; content identical after inspection |
| 4 | `openspec/changes/archive/2026-04-20-fix-fork-entryid-timing/tasks.md` | Union | Apply our refinements on top of develop's archived version per adapt §3.7 |
| 5–7 | `openspec/changes/archive/2026-04-20-fix-portable-windows-package-manager/*` | Theirs | Accept develop's archive structure; our 2026-04-19 version was already deleted by rename/rename |
| 8 | `openspec/specs/bridge-extension/spec.md` | Union | Both sides synced from same deltas; merge all unique requirements |
| 9 | `openspec/specs/provider-auth-ui/spec.md` | Union with semantic resolution | Device-code auto-open conflict; our synced version already resolves it — prefer ours |
| 10–12 | `openspec/specs/{test-execution,vm-image-building,vm-lifecycle}/spec.md` | Theirs | Develop synced cross-platform-qa-vms first; content equivalent |
| 13 | `packages/client/src/components/PathPicker.tsx` | Develop's UX + our `parsePathInput()` | Per `prep-for-develop-merge` reconciliation plan |
| 14–16 | `packages/server/src/__tests__/{browse-endpoint,editor-registry}.test.ts`, `packages/shared/src/__tests__/config.test.ts` | Union | Keep all test cases from both sides |
| 17 | `packages/server/src/headless-pid-registry.ts` | Union | Our cross-platform kill + develop's `isUnsafeTestHomeScan()` guards |
| 18 | `packages/server/src/server.ts` | Union | Additive route registrations; merge hunks manually |
| 19 | `packages/server/src/tunnel.ts` | Ours for binary resolution, theirs for lifecycle | Per MERGE-PLAN §3.11 |
| 20 | `packages/shared/src/openspec-poller.ts` | Union | Both additive; inspect hunks |

## Capabilities

### New Capabilities
_(none)_

### Modified Capabilities
_(none — this is a merge execution, not a behavior change. All capability changes come from the 45 develop commits being merged, already documented in their own proposals.)_

## Impact

- **Branch state**: local `develop` becomes 52+45=97 commits ahead of merge-base, 0 behind `origin/develop`.
- **PR #9**: Single merge commit added on top of our 12 windows-integration commits.
- **Tests**: Need to pass the 5 test files modified above + the repo-wide baseline. `vitest run` targeted to affected packages.
- **Rollback**: `git reset --hard HEAD~1` before pushing. After pushing: `git push origin HEAD~1:windows-integration --force-with-lease`.
