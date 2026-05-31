## Why

After a machine reboot every pi session is `ended` and no bridge has reattached yet. Worktree (and jj `.shadow/`) sessions then **vanish from the sidebar entirely**: the field that collapses them under their parent repo (`gitWorktree.mainPath`, resp. `jjState.workspaceRoot`) is bridge-populated and NOT persisted, so cold-start grouping falls back to the worktree's own `cwd`. That produces an unpinned group containing only ended sessions, which the documented "hide unpinned-only-ended folders by default" rule (`session-search` spec) suppresses. Net effect: ended worktree sessions are collected by the scanner but never rendered.

The same missing-parentage cause has a **second symptom in the OpenSpec surface**: `FolderOpenSpecSection` links a change row to a session via `sessions.filter(s => s.attachedProposal === change.name)`, where `sessions = group.sessions` and the change list is `openspecMap.get(group.cwd)`. A worktree session's attached proposal lives in the **parent repo's** `openspec/`, so the session must sit in the parent repo's group to be linked. Cold-start, the un-collapsed worktree session is absent from `/repo`'s `group.sessions`, so the change's linked-session row is empty — the worktree-attached session also disappears under OpenSpec. The same re-collapse restores it.

## What Changes

- Persist worktree parentage in `.meta.json`: `gitWorktree.mainPath` + `gitWorktree.name` (today only `gitWorktreeBase`/`base` is persisted).
- Persist jj-workspace parentage in `.meta.json`: `jjState.workspaceRoot` + `jjState.workspaceName` (same class of cold-start bug for `.shadow/<name>/` workspaces).
- On startup scan (`session-scanner.ts`), restore these fields onto the `DashboardSession` so `resolveSessionGroupPath` collapses the restored session under its parent repo — exactly as it does when the bridge is live. The parent group is pinned/workspace-owned and therefore always rendered, regardless of alive-session count.
- Restoring the collapse also re-populates the parent group's `group.sessions`, so `FolderOpenSpecSection`'s linked-session filter re-attaches the worktree session to its OpenSpec change row. No change to `FolderOpenSpecSection` itself.
- No change to the "hide unpinned-only-ended folders by default" rule. Collapsing under the rendered parent group sidesteps it; the rule stays intact for genuinely orphaned ended folders.
- Known limitation (documented, not fixed here): sessions whose `.meta.json` predates this change carry no persisted parentage; they remain in their own group until a bridge attaches to that worktree once and re-stamps the meta. New and dashboard-spawned worktree sessions are correct immediately.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `meta-json-session-cache`: `.meta.json` SHALL additionally persist worktree parentage (`gitWorktree.mainPath`, `gitWorktree.name`) and jj-workspace parentage (`jjState.workspaceRoot`, `jjState.workspaceName`) when the live session carries them. Fields remain optional and backward-compatible.
- `session-grouping`: a session restored from `.meta.json` at server startup (no live bridge) SHALL group under its parent repo / workspace root using the persisted parentage, matching the grouping a live bridge would produce.

## Impact

- `packages/shared/src/session-meta.ts` — extend `SessionMeta` with the four optional fields.
- `packages/server/src/server.ts` — `sessionManager.onChange` meta save: write the parentage fields when present on the session.
- `packages/server/src/session-scanner.ts` — `sessionFromMeta`: reconstruct `session.gitWorktree` / `session.jjState` from persisted fields so cold-start grouping has the inputs `resolveSessionGroupPath` needs.
- No client changes; `resolveSessionGroupPath` already consumes these fields. No protocol/wire change.
- Tests: server scanner restore round-trip; grouping parity (live vs cold-start) in `session-grouping-workspaces` client test.
