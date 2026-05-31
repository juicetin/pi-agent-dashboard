## Why

`WorktreeSpawnDialog` derives the worktree path from the branch input (`derivedPath = <repo>/.worktrees/<slug(newBranch)>`). The per-change `⑂+` entry (`FolderOpenSpecSection`) passes `initialBranch="os/<change>"` as a prop, so branch and path are both correctly preloaded on first paint.

A follow-up change is expected to add an in-dialog proposal picker (so the user can attach a change — including archived — from the generic `+Worktree` entry). Once that picker exists, the `attachProposal` prop becomes a value that can change at runtime, not just at mount. The dialog today only honors `initialBranch` on first paint via `useState(initialBranch ?? "")` — a mid-dialog proposal selection would not propagate to the branch field.

This change adds the one-effect bridge: when `attachProposal` changes, the branch field follows (`os/<name>`) unless the user has typed into it. Path follows for free via the existing `derivedPath` chain. Lands standalone, no behavior change today (the prop never changes at runtime yet); unlocks the picker change when it arrives.

## What Changes

- **`WorktreeSpawnDialog.tsx` — dirty-flag the branch input.** Track whether the user has typed into `newBranch` since mount. Set the flag on every `onChange`. Mount-time value (from `initialBranch`) does NOT count as dirty.
- **`WorktreeSpawnDialog.tsx` — react to `attachProposal` prop changes.** New effect: when `attachProposal` transitions to a non-empty string AND the dirty flag is false, `setNewBranch("os/" + attachProposal)`. When it transitions to `undefined`/empty AND not dirty, revert to `initialBranch ?? ""`.
- **No prop signature change.** `attachProposal` already exists on the dialog; only its runtime semantics broaden (mount-only → mount-or-change).
- **No server change, no protocol change, no config change.**

Out of scope:

- Adding the in-dialog proposal picker itself (separate change — `attach-archived-openspec-changes` or similar).
- Auto-fill of the path-override field (path already follows branch via existing `derivedPath`; no separate effect needed).
- Munging the change name (`slugifyBranch` runs downstream on the full `newBranch`; kebab-case proposal names pass through unchanged).
- Touching the `⑂+` per-change entry point (its `initialBranch` flow already lands the same result via mount-time prop).

## Capabilities

### Modified Capabilities

- **`worktree-spawn-dialog`**: `attachProposal` prop now reactive — changes after mount drive the branch input via the dirty-flag rule above. Today no caller mutates the prop; behavior unchanged in practice until a future picker is wired.

## Impact

- **Modified files**:
  - `packages/client/src/components/WorktreeSpawnDialog.tsx` — add `branchDirty` state, mark on `onChange`, effect on `attachProposal`.
  - `packages/client/src/components/__tests__/WorktreeSpawnDialog.test.tsx` (or equivalent) — new test arms (see tasks).
  - `docs/file-index-client.md` — append to `WorktreeSpawnDialog.tsx` row.
- **Protocol / persistence / config**: none.
- **Risk**: very low. Pure local-state effect inside one component. No effect when `attachProposal` is unset or unchanged (the prop's current usage).
