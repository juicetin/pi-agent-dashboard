# Tasks

## 1. Confirm the design decision

- [x] 1.1 Decision locked: **P2** (keep `pollOne` pure; emit pending from the
  three broadcast wrappers via a shared `emitPendingIfDiscovered(cwd)` helper).
  See design.md.
- [ ] 1.2 Verify `onChangeCallback` wiring timing on the `onDirectoryAdded`
  path — confirm the broadcast callback is set when a new cwd registers so the
  shared helper's emit reaches browsers (P2 puts the emit in the wrapper, where
  the callback should already be wired).

## 2. Server: emit transitional pending from the poll path

- [ ] 2.1 Write failing test: a poll for a cwd whose `openspec/changes/` exists
  but cache holds no `initialized` data emits `openspec_update` with
  `{ initialized:false, pending:true }` **before** the final `initialized`
  payload.
- [ ] 2.2 Write failing test (Scenario 2): a cwd registered while
  `openspec/changes/` is absent, then the dir is created and the next
  tick/watcher poll discovers it — the discovery poll emits `pending:true`
  then `initialized:true` (not initialized-only).
- [ ] 2.3 Implement the emit per the chosen P1/P2 path: stat
  `openspec/changes/`; when it exists and cache is not yet `initialized`,
  broadcast `pending:true` immediately before the slow `openspec list` spawn.
- [ ] 2.4 Wire the emit into all three broadcast paths: periodic tick wrapper
  (`directory-service.ts:626`), `onWatcherFired` (`:544`), and
  `event-wiring.ts onDirectoryAdded` (`:732`).

## 3. Non-openspec + terminal-state safety

- [ ] 3.1 Test: a cwd with no `openspec/` dir is polled — no `pending:true` is
  ever broadcast; payload stays `{ initialized:false, pending:false }`.
- [ ] 3.2 Test: a cwd with `openspec/` but no `changes/` subdir (init-only, no
  proposals) is polled — `rootMtime` undefined, no `pending:true` emitted, card
  renders nothing.
- [ ] 3.3 Test: `pending:true → initialized:false (no changes)` transition
  clears the spinner (CLI error / empty result terminal state). Confirm
  `FolderOpenSpecSection` resolves `!initialized && !pending` to render-nothing.

## 4. Spec + regression

- [ ] 4.1 Update `server-openspec-polling` delta requirements (this change's
  spec file) to reflect the poll-path pending emit.
- [ ] 4.2 Run full suite: `npm test 2>&1 | tee /tmp/pi-test.log`, grep failures.
- [ ] 4.3 Manual verify both scenarios: (1) worktree off a parent with
  committed `openspec/` → spinner then content; (2) worktree with delayed
  `openspec init` hook → spinner appears when dir lands, then content.
