# Tasks

> **Dependency**: this change assumes `add-worktree-from-pull-request` has landed first, introducing the binary "From a branch" / "From a pull request" source toggle in `WorktreeSpawnDialog`. Tasks below extend that toggle. The §5 fallback addresses the case where PR change is still blocked.

## Server (independent of PR change)

- [x] **1. Make `newBranch` optional in `AddWorktreeOptions`** (`packages/server/src/git-operations.ts`)
  - Change type: `newBranch?: string`.
  - In `addWorktree()`: when `newBranch` is set, run `git worktree add -b <newBranch> <path> <base>` (current behaviour). When `newBranch` is absent, run `git worktree add <path> <base>` (checkout existing branch; `base` carries the branch ref).
  - Path derivation: when `newBranch` absent, derive `slug` from `localNameOf(base)` where `localNameOf("origin/foo") === "foo"` and `localNameOf("foo") === "foo"`.
  - Success envelope: `branch` field reflects the actually-checked-out branch (for `origin/foo` DWIM, `foo`, not `origin/foo`).

- [x] **2. Enrich `branch_in_use` stderr parsing**
  - Extract the holding-worktree path from git stderr when present (`already used by worktree at '<path>'`); include in the `message` field so the UI can render it inline. Fall back to generic phrasing when path cannot be parsed.

- [x] **3. Update route body validation** (`packages/server/src/routes/git-routes.ts`)
  - `newBranch` becomes optional in the request schema for `POST /api/git/worktree`. `base` (now: the branch ref) remains required. No new endpoint. No new error code.

- [x] **4. Unit tests** (`packages/server/src/__tests__/git-operations.test.ts` or sibling)
  - `addWorktree({newBranch: "foo", base: "main"})` → emits `-b foo <path> main`.
  - `addWorktree({base: "main"})` → emits `<path> main` (no `-b`).
  - `addWorktree({base: "origin/foo"})` → derived path slug is `foo`, not `origin-foo`; success envelope `branch === "foo"`.
  - `branch_in_use` stderr containing `at '/repo/.worktrees/bar'` → `message` includes that path.

## Client — extend the PR-change toggle

- [x] **5. Update client helper** (`packages/client/src/lib/git-api.ts`)
  - `createWorktree({cwd, base, newBranch?, path?})` — `newBranch` optional.

- [x] **6. Widen mode type in `WorktreeSpawnDialog`** (landed PR-change used `"branch"|"pr"` button toggle, not `"from-branch"|"from-pr"` radios; widened to `"fork"|"checkout"|"pr"` to match real code) (`packages/client/src/components/WorktreeSpawnDialog.tsx`)
  - Change `mode: "from-branch" | "from-pr"` (PR change's shape) to `mode: "fork" | "checkout" | "from-pr"`.
  - Rename the existing "From a branch" radio label to **"Fork to new branch"**. No field or submit-path change for this mode.
  - Add **"Check out existing branch"** radio between fork and from-pr.

- [x] **7. Implement checkout-mode UI**
  - In `mode === "checkout"`: relabel the existing base-branch combobox to **Branch** (no separate field needed — reuse the same `BranchCombobox` instance, possibly via a prop or a label override).
  - Hide the new-branch input (`worktree-new-branch-input`) entirely in checkout mode.
  - Derive `effectivePath` from `slugifyBranch(localNameOf(base))` when no `pathOverride`.
  - `canSubmit` in checkout mode requires `base.trim().length > 0` (no `newBranch` validation).

- [x] **8. Refine default-mode logic**
  - The PR change defaults `mode` to `"from-branch"` unconditionally. Replace with:
    - `attachProposal` non-empty → initial `mode = "fork"`.
    - `attachProposal` empty/undefined → initial `mode = "checkout"`.
    - `mode = "from-pr"` is never the auto-pick (preserves PR change's lazy-load contract).
  - Mode flip after first paint is user-controlled (no auto re-pick on `attachProposal` runtime change).

- [x] **9. Submit path for checkout mode**
  - `handleCreateAndSpawn` omits `newBranch` from the `createWorktree` payload when `mode === "checkout"`. Existing path otherwise unchanged.

- [x] **10. Server-error rendering for `branch_in_use`** (existing submitError block renders enriched `message` inline)
  - When the server returns `branch_in_use`, render the enriched `message` (including the holding worktree path) inline below the picker. Extend the existing `mapErrorCode` text; no new code.

- [x] **11. Component tests** (`packages/client/src/components/__tests__/WorktreeSpawnDialog.test.tsx`)
  - Default mode is `"checkout"` when `attachProposal` undefined.
  - Default mode is `"fork"` when `attachProposal` provided.
  - Checkout mode: submit calls `createWorktree` with no `newBranch` field.
  - Checkout mode: `branch_in_use` server error renders the enriched message including the holding worktree path.
  - Fork mode unchanged: all existing tests still pass (rename `from-branch` → `fork` everywhere in test expectations).
  - PR mode unchanged: existing PR-change tests still pass.

## Fallback (only if `add-worktree-from-pull-request` has NOT landed)

- [x] **12. Introduce the toggle ourselves** — N/A: `add-worktree-from-pull-request` already landed (archive/2026-06-05). Followed the main path (widen ternary), not the fallback.
  - If the PR change is still unmerged at implementation time, introduce a binary toggle (`"fork" | "checkout"`) here instead of widening a ternary. The PR change rebases on top later.
  - Skip §6's rename step; the new radio set is the first toggle to land.
  - Strip the `"from-pr"` test assertions in §11.
  - Document the order swap in the implementation PR description.

## Docs

- [x] **13. Update file-index rows** (annotated git-operations.ts, git-worktree.ts, git-routes.ts, git-api.ts, WorktreeSpawnDialog.tsx; shared-helper row skipped — localNameOf documented at re-export + consumer rows) (`docs/file-index-server.md`, `docs/file-index-client.md`)
  - Annotate `git-operations.ts`, `git-routes.ts`, `git-api.ts`, `WorktreeSpawnDialog.tsx` rows with `See change: worktree-checkout-existing-branch` per the docs protocol. Delegate to a general-purpose subagent with caveman-style rule verbatim.

## Verification

- [ ] **14. Manual smoke** (automated unit + component tests cover all five scenarios; live browser smoke pending)
  - Plain `+Worktree` (no proposal) → defaults to **Check out existing branch**; picker lists branches; submit creates a worktree without a new branch.
  - OpenSpec `⑂+` (proposal attached) → defaults to **Fork to new branch**; current flow unchanged.
  - PR mode toggle still works exactly as `add-worktree-from-pull-request` specified (regression check).
  - Pick a branch currently checked out elsewhere → server returns `branch_in_use`; UI shows holding worktree path inline.
  - Pick `origin/<x>` (remote-only branch) → worktree gets created with local branch `<x>` tracking origin.

- [x] **15. `npx openspec validate worktree-checkout-existing-branch --strict`** — valid
