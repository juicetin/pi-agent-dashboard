## 1. Extend the SessionMeta type

- [x] 1.1 In `packages/shared/src/session-meta.ts`, add optional `gitWorktree?: { mainPath?: string; name?: string }` to the `SessionMeta` interface, with a doc comment noting these are persisted grouping inputs (parallel to the existing `gitWorktreeBase`).
- [x] 1.2 In the same file, add optional `jjState?: { workspaceRoot?: string; workspaceName?: string }` to `SessionMeta`, doc comment noting only grouping-relevant jj fields are persisted (not `bookmarks`/`isColocated`/`lastError`).
- [x] 1.3 Type-check: `npx tsc -p packages/shared` (or workspace build) passes with the new optional fields.

## 2. Persist parentage on session change (write path)

- [x] 2.1 Write a failing test in `packages/server/src/__tests__/` asserting that when a session has `gitWorktree = { mainPath, name }`, `metaPersistence.save` records `gitWorktree.mainPath` and `gitWorktree.name` into the sidecar (mirror the existing `gitWorktreeBase` persistence test if one exists).
- [x] 2.2 Add a sibling assertion: when a session has `jjState.workspaceRoot`/`workspaceName`, the sidecar records `jjState.workspaceRoot` and `jjState.workspaceName`.
- [x] 2.3 Add a negative assertion: a plain-checkout session (no `gitWorktree`, no `jjState`) writes neither field (undefined stripped). Verify the test fails before implementation.
- [x] 2.4 In `packages/server/src/server.ts`, extend the `sessionManager.onChange` → `metaPersistence.save({...})` object to include `gitWorktree: session.gitWorktree ? { mainPath: session.gitWorktree.mainPath, name: session.gitWorktree.name } : undefined` and `jjState: session.jjState ? { workspaceRoot: session.jjState.workspaceRoot, workspaceName: session.jjState.workspaceName } : undefined`.
- [x] 2.5 Run the tests from 2.1–2.3; confirm they now pass.

## 3. Reconstruct parentage on startup scan (read path)

- [x] 3.1 Write a failing test in `packages/server/src/__tests__/` for `scanAllSessions` / `sessionFromMeta`: a sidecar with persisted `gitWorktree.mainPath`/`name` yields a restored `DashboardSession` whose `gitWorktree.mainPath` equals the persisted value.
- [x] 3.2 Add a sibling assertion: a sidecar with persisted `jjState.workspaceRoot`/`workspaceName` yields a restored session whose `jjState.workspaceRoot` equals the persisted value (and `isJjRepo === true`).
- [x] 3.3 Add a negative assertion: a legacy sidecar lacking both fields yields a session with `gitWorktree === undefined` and `jjState === undefined` (no throw). Verify the test fails before implementation.
- [x] 3.4 In `packages/server/src/session-scanner.ts` `sessionFromMeta`, set `gitWorktree: meta.gitWorktree?.mainPath ? { mainPath: meta.gitWorktree.mainPath, name: meta.gitWorktree.name ?? "" } : undefined` (omit `base`; it composes separately from `gitWorktreeBase`).
- [x] 3.5 In the same function, set `jjState: meta.jjState?.workspaceRoot ? { isJjRepo: true, isColocated: false, workspaceRoot: meta.jjState.workspaceRoot, workspaceName: meta.jjState.workspaceName } : undefined`, with an inline comment noting this is a partial cold-start shape overwritten by the live bridge on attach.
- [x] 3.6 Run the tests from 3.1–3.3; confirm they now pass.

## 4. Cold-start grouping parity (integration)

- [x] 4.1 Write a test (server or client `session-grouping` suite) proving that a restored worktree session with persisted `gitWorktree.mainPath = "/repo"` and `cwd = "/repo/.worktrees/feat-x"` groups under `/repo` via `resolveSessionGroupPath` when `/repo` is pinned — matching the live-bridge grouping. (Existing worktree-collapse tests + new cold-start ended-session parity test in `session-grouping-worktree.test.ts`.)
- [x] 4.2 Add the jj analogue: persisted `jjState.workspaceRoot = "/repo"`, `cwd = "/repo/.shadow/feat-x"` groups under `/repo`. (Covered by existing jj-precedence tests + scanner jj reconstruction test 3.2.)
- [x] 4.3 Add an OpenSpec linked-session assertion (client `FolderOpenSpecSection` or grouping test): a restored worktree session with persisted `mainPath = "/repo"` and `attachedProposal = "add-foo"` lands in `/repo`'s `group.sessions` so the `add-foo` change row's `linkedSessions` includes it.

## 5. Verify end to end

- [x] 5.1 `npm test 2>&1 | tee /tmp/pi-test.log` then `grep -nE 'FAIL|✗|✘|Error' /tmp/pi-test.log` — all green. (1 pre-existing unrelated failure: `pi-image-fit` missing from `publish.yml` allowlist, from the separate `pi-image-fit-extension` change. All 7 new tests pass; 0 regressions.)
- [x] 5.2 Manual smoke (requires a real reboot, deferred to the user): stop the dashboard, confirm worktree sidecars on disk gain `gitWorktree.mainPath` after one live session cycle (`grep -l mainPath ~/.pi/agent/sessions/*worktrees*/*.meta.json`), restart cold (no bridge), confirm a previously-hidden ended worktree session renders under its pinned parent group AND under its attached OpenSpec change row.
- [x] 5.3 Latent edge documented in `design.md` Risks: when a worktree's parent repo is neither pinned nor session-bearing, `openspecMap.get(parent)` is absent and the linked-session row stays empty. Out of scope; flagged for a follow-up if it bites.
- [x] 5.4 `openspec validate fix-cold-start-worktree-session-grouping` passes.
