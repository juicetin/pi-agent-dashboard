## Context

After a machine reboot the dashboard server scans `~/.pi/agent/sessions/` and restores every session as `ended`. Worktree and jj-`.shadow/` sessions group correctly only while a live bridge feeds `gitWorktree.mainPath` / `jjState.workspaceRoot`; those fields collapse the session under its parent repo (`resolveSessionGroupPath`). Neither field is persisted to `.meta.json` — verified against disk: 34/34 worktree sidecars for this repo carry `gitWorktreeBase` (3) but **zero** carry `gitWorktree.mainPath`, `gitWorktree.name`, `jjState.workspaceRoot`, or `jjState.workspaceName`. Cold-start, every worktree session falls back to its own `cwd` group, which is unpinned and all-ended, and is therefore suppressed by the documented "hide unpinned-only-ended folders" rule (`session-search`). The same gap empties `FolderOpenSpecSection`'s linked-session row for the 23/34 sessions that carry `attachedProposal`.

Persistence today (`server.ts` `sessionManager.onChange` → `metaPersistence.save`) already writes `gitWorktreeBase`; restore (`session-scanner.ts` `sessionFromMeta`) already reads it into `gitWorktreeBase`. The four missing fields follow the exact same path.

## Goals / Non-Goals

**Goals:**
- Persist `gitWorktree.{mainPath,name}` and `jjState.{workspaceRoot,workspaceName}` to `.meta.json` when the live session carries them.
- On startup scan, reconstruct `session.gitWorktree` / `session.jjState` from persisted fields so `resolveSessionGroupPath` collapses restored sessions under their parent — identical grouping to a live bridge.
- Restore both surfaces (sidebar group visibility + OpenSpec linked-session row) with zero client edits.
- Stay backward-compatible: legacy sidecars lacking the fields read without error and fall back to status-quo own-cwd grouping.

**Non-Goals:**
- Changing the "hide unpinned-only-ended folders by default" rule (`session-search`). Collapsing under the rendered parent sidesteps it.
- Editing `FolderOpenSpecSection` or `resolveSessionGroupPath` — they already consume these fields.
- Back-filling parentage for legacy sessions whose sidecars predate this change (they self-heal on next bridge attach).
- Any protocol/wire-shape change. `DashboardSession` already carries `gitWorktree`/`jjState`; only the `.meta.json` sidecar gains fields.

## Decisions

### D1. Persist a minimal subset, not the whole object
Persist only `gitWorktree.mainPath` + `gitWorktree.name` (not `base` — already covered by the separate `gitWorktreeBase` field) and `jjState.workspaceRoot` + `jjState.workspaceName` (not `isJjRepo`/`isColocated`/`bookmarks`/`lastError`, which are live-probe state, not grouping inputs).
**Why:** grouping needs exactly these four. Persisting volatile probe state (bookmarks, lastError) would cache staleness and bloat the sidecar. Alternative — persist the full objects — rejected: stores fields that are meaningless without a live probe and risks the cold-start UI trusting stale `bookmarks`.

### D2. Reconstruct partial objects on restore
`sessionFromMeta` builds `gitWorktree = { mainPath, name }` (omitting `base`, which is composed separately from `gitWorktreeBase` at broadcast time per existing logic) and `jjState = { isJjRepo: true, isColocated: false, workspaceRoot, workspaceName }` only when the persisted fields are present.
**Why:** `resolveSessionGroupPath` reads only `jjState?.workspaceRoot` and `gitWorktree?.mainPath`; a partial object satisfies it. The `isJjRepo: true` seed is cosmetically honest (we only persist `workspaceRoot` when the live session was a jj workspace) and harmless — a live bridge overwrites the full `jjState` on attach. Alternative — store a flat `worktreeMainPath` scalar on `DashboardSession` — rejected: would force a parallel resolver branch; reusing the existing object shape keeps `resolveSessionGroupPath` untouched.

### D3. Persist conditionally (only when present)
The `metaPersistence.save` call writes the four fields only when the in-memory session carries them, mirroring how `gitWorktreeBase` is written today. Undefined values are not emitted (the meta writer already strips undefined).
**Why:** keeps plain-checkout sidecars unchanged and the "all fields optional" invariant intact (`meta-json-session-cache`).

### D4. SessionMeta type carries nested shapes, not flattened scalars
Extend `SessionMeta` with optional `gitWorktree?: { mainPath?: string; name?: string }` and `jjState?: { workspaceRoot?: string; workspaceName?: string }`.
**Why:** symmetric with `DashboardSession`, makes save/restore a near-direct copy, and reads naturally in the JSON. Alternative — flat keys like `gitWorktreeMainPath` — rejected: diverges from the in-memory shape and complicates the round-trip.

## Risks / Trade-offs

- **Stale parentage after a worktree is removed** → a restored session may collapse under a parent whose worktree dir no longer exists. Mitigation: the existing `cwdMissing` probe (`existsSync(meta.cwd)`) already flags removed cwds at scan time; grouping under a still-present parent is still correct, and a removed parent surfaces via the same probe. No new staleness class introduced.
- **Partial `jjState` on cold start could mislead a consumer that reads `bookmarks`/`isColocated`** → Mitigation: only `resolveSessionGroupPath` (mainPath/workspaceRoot) consumes these pre-bridge; badge/fold-back consumers run against live bridge data. Document the partial shape in the restore site.
- **Legacy sidecars stay broken until next bridge attach** → accepted and spec'd (scenario "Legacy session without persisted parentage"). Rare and self-healing.
- **Parent group must be a known/polled directory for the OpenSpec linked-session row** → in the reported case the parent repo is pinned, so `openspecMap.get(parent)` is populated. If a worktree's parent were neither pinned nor session-bearing, the OpenSpec data would be absent. Out of scope; noted as a latent edge in tasks.

## Migration Plan

- Pure additive change; no migration step. New fields are written going forward on every `onChange`. Existing sidecars gain the fields the first time their session's `onChange` fires with a live `gitWorktree`/`jjState` (i.e., next bridge attach), or stay legacy-shaped harmlessly.
- Rollback: reverting the code leaves the extra fields in sidecars as unread optional keys — no corruption, fully forward/backward compatible.

## Open Questions

- None blocking. The "unpinned parent not polled" edge (above) is deferred, not resolved here.
