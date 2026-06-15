# Tasks

## 1. Server — deferred order-key resolution (Defect B)
- [ ] 1.1 Add `rekey(oldKey, newKey, id, { toFront })` helper to
      `SessionOrderManager` (remove from oldKey, prune if empty, insert/unshift
      into newKey). Unit-test in isolation.
- [ ] 1.2 Write failing test: worktree session registers with
      `gitWorktree=undefined` → id under worktree-cwd key; then `git_info_update`
      sets `gitWorktree.mainPath` → id moved to FRONT of parent key, old key
      pruned, single `sessions_reordered { cwd: parent }` broadcast.
- [ ] 1.3 In `event-wiring.ts` gitWorktree-compose arm (and jjState arm),
      recompute `resolveOrderKey(session)`; if it differs from the id's current
      key, call `rekey(...)` and broadcast `sessions_reordered` for the resolved
      key (validIds filtered by resolved key). Guard on key inequality.
- [ ] 1.4 Write test: legacy bridge sends `gitWorktree` on register → no re-key,
      no extra broadcast (key already correct).
- [ ] 1.5 Make tests pass.

## 2. Client — Tier 2.5 placeholder clear fallback (Defect A)
- [ ] 2.1 Write failing test: `session_added` with NO matching `spawnRequestId`,
      `session.cwd` = worktree path matching a pending-spawn entry whose
      `placeholderCwd` = parent → placeholder cleared via `placeholderCwd`,
      `pendingSpawns` entry removed, navigation to `/session/<id>` fired.
- [ ] 2.2 Add Tier 2.5 branch in `useMessageHandler.ts` `case "session_added"`
      after Tier 1 + Tier 2 miss: scan `pendingSpawnsRef` for `kind==="spawn"`
      entry with `pathKey(entry.cwd) === pathKey(session.cwd)`; clear + navigate +
      delete; first-match-wins `break`.
- [ ] 2.3 Write test: plain spawn (placeholderCwd === session.cwd) still cleared
      by Tier 2 and not double-handled by Tier 2.5.
- [ ] 2.4 Make tests pass.

## 3. Verify end-to-end
- [ ] 3.1 `npm test 2>&1 | tee /tmp/pi-test.log` → grep failures; all green.
- [ ] 3.2 Manual / browser: spawn a worktree session → placeholder replaced in
      place at the TOP of the parent group; no orphaned placeholder; session
      not at bottom.
- [ ] 3.3 `openspec validate fix-worktree-spawn-placeholder-and-ordering --strict`.
