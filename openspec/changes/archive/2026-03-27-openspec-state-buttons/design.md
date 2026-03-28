## Context

The OpenSpec UI is split across two levels:
- **Folder level** (`FolderOpenSpecSection`): change list, artifact letters, Refresh, Bulk Archive
- **Session level** (`SessionOpenSpecActions`): attach combo, action buttons (Read, Explore, Continue, FF, Apply, Archive), Detach

Button visibility in `SessionOpenSpecActions` uses ad-hoc `isComplete` / `canApply` checks. There's no Verify button, no `+ New Change` entry point, and no cross-session visibility.

## Goals / Non-Goals

**Goals:**
- Formal state derivation from existing `OpenSpecChange` data (no new server data needed)
- Button visibility driven by a single state enum
- Cross-session change visibility in folder-level expanded list
- New Change dialog triggered from folder level
- Attached proposal name visually distinct

**Non-Goals:**
- Changing the OpenSpec CLI or server-side data format
- Adding new server→browser protocol messages
- Changing artifact order or workflow schemas

## Decisions

### 1. Shared `ChangeState` enum and `deriveChangeState()` in `src/shared/types.ts`

**Choice:** Pure function in shared types, computed on the fly.

```
enum ChangeState { PLANNING, READY, IMPLEMENTING, COMPLETE }

deriveChangeState(change: OpenSpecChange): ChangeState
  isAllDone = artifacts.length > 0 && every artifact status === "done"
  if !isAllDone → PLANNING
  if change.status === "complete" → COMPLETE
  if change.status === "in-progress" → IMPLEMENTING
  else → READY
```

**Why:** No storage, no sync issues. Trivial function, callable wherever needed. Shared location allows server use later.

### 2. Button visibility matrix driven by `ChangeState`

Applies to `SessionOpenSpecActions` (session-level action buttons when attached):

| Button | Condition |
|--------|-----------|
| Read | Always (when artifacts exist) |
| Explore | Always |
| Continue | `state === PLANNING` |
| FF | `state === PLANNING` |
| Apply | `state === READY \|\| state === IMPLEMENTING` |
| Verify | `state === COMPLETE` |
| Archive | `state === COMPLETE` |

**Why:** Replaces current mix of `isComplete` / `canApply` checks with single state lookup. Verify is new — sends `/opsx:verify <name>`.

### 3. Attached proposal name colored differently

**Choice:** Use `text-blue-400` for the attached proposal name in the badge (`📋 {attached}`), contrasting with default `text-[var(--text-tertiary)]`.

### 4. `+ New Change` button in folder-level header

**Choice:** Add a `+ New` button in `FolderOpenSpecSection` header, next to Refresh and Bulk Archive. Opens `NewChangeDialog`.

**Session selection:** The dialog needs a session to send `/opsx:new` to. Use the first active (non-ended) session in that folder group. If no active sessions exist, the button is disabled.

### 5. `NewChangeDialog` component

**Choice:** Modal with two fields:
- Change name (single-line input, optional — CLI auto-generates if empty)
- Description (multiline textarea, optional)

Sends `/opsx:new <name>\n<description>` (omits parts that are empty). Follows existing dialog pattern from `ExploreDialog`.

### 6. Cross-session links per change in folder expanded list

**Choice:** In `FolderOpenSpecSection`'s expanded change list, each change row shows clickable session names/IDs for sessions that have `attachedProposal === change.name`. Clicking navigates to that session.

**Data flow:**
```
SessionList
  → passes allSessions + onNavigateToSession to FolderOpenSpecSection
    → Each change row filters sessions by attachedProposal
    → Renders clickable session links
```

**Why:** All session data already exists in the client state. No new server messages.

## Risks / Trade-offs

- **[Risk] Session list in change rows could be noisy** → Most changes have 0-1 sessions. Only shows in expanded state.
- **[Risk] NewChangeDialog needs active session** → Button disabled when no active sessions in folder. Clear UX signal.
- **[Risk] `+ New` button adds clutter to folder header** → Acceptable — header already has Refresh + Bulk Archive.
