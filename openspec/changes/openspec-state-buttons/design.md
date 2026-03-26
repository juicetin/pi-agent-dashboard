## Context

The OpenSpec section in `SessionCard` shows action buttons per change with ad-hoc visibility logic. The current code checks `change.status === "complete"` and `allArtifactsDone()` independently, leading to inconsistencies (e.g., Apply showing on completed changes, no Verify button). The `+ New Change` button is inside the expanded accordion body, making it hard to discover. New sessions inherit `attachedProposal` from ended sessions in the same CWD, which is undesirable.

## Goals / Non-Goals

**Goals:**
- Formal state derivation from existing `OpenSpecChange` data (no new server data needed)
- Button visibility driven by a single state enum
- Cross-session proposal visibility (which sessions work on a change)
- New Change dialog with name/description fields
- Attached proposal name visually distinct in header
- Remove carry-over of `attachedProposal` on session registration

**Non-Goals:**
- Changing the OpenSpec CLI or server-side openspec data format
- Adding new server→browser messages (all data already available in client state)
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

**Why:** No storage, no sync issues. The function is trivial and can be called wherever needed. Shared location lets server use it too if needed later.

### 2. Button visibility matrix driven by `ChangeState`

| Button | Condition |
|--------|-----------|
| Explore | Always |
| Continue | `state === PLANNING` |
| FF | `state === PLANNING` |
| Apply | `state === READY \|\| state === IMPLEMENTING` |
| Verify | `state === COMPLETE` |
| Archive | Always |

**Why:** Replaces the current mix of `isComplete` / `canApply` / `change.status` checks with a single state lookup. Verify is new — sends `/opsx:verify <name>`.

### 3. Cross-session proposal links in `ChangeCard`

**Choice:** Pass `allSessions` and `onNavigateToSession` as props to `OpenSpecSection`, then to `ChangeCard`. Each card filters sessions by `attachedProposal === change.name`, excludes the current session, and renders clickable session names.

**Data flow:**
```
SessionCard
  → passes sessions + currentSessionId + onNavigateToSession
    → OpenSpecSection
      → ChangeCard
        → filters sessions where attachedProposal matches
        → renders clickable links (calls onNavigateToSession)
```

**Why:** All session data already exists in the client's event-reducer state. No new server messages needed. The `onNavigateToSession` callback maps to the existing session selection mechanism.

Only shown when no proposal is attached (unattached mode shows all changes, so cross-linking is useful). When attached, you're already focused on one change — no need.

### 4. `NewChangeDialog` component

**Choice:** New component similar to `ExploreDialog` — modal with two fields:
- Change name (single-line input, optional)
- Description (multiline textarea, optional)

Sends `/opsx:new <name>\n<description>` (omits parts that are empty).

**Why:** Reuses the dialog pattern from `ExploreDialog` and `ConfirmDialog`. Keeps it simple — just two optional fields.

### 5. `+ New` button moves to header, disabled when attached

**Choice:** Render `+ New` in the header bar (next to Bulk Archive / Detach / Refresh). When `attachedProposal` is set, the button is hidden (not just disabled) since New Change while focused on a specific proposal is confusing.

### 6. Attached proposal name colored differently

**Choice:** Use `text-blue-400` for the attached proposal name in the header (`OpenSpec: <name>`), contrasting with the default `text-[var(--text-tertiary)]` of the "OpenSpec" label.

### 7. Remove `attachedProposal` carry-over in `server.ts`

**Choice:** Delete the carry-over block in the `session_register` handler (lines ~134-141). New sessions start with `attachedProposal = null`. Auto-attach from activity detection still works.

## Risks / Trade-offs

- **[Risk] Session list in change cards could be noisy** → Mitigated by only showing in unattached mode and hiding current session. Most changes have 0-1 other sessions.
- **[Risk] Removing carry-over may surprise users who expect continuity** → Mitigated by activity-based auto-attach still working — if you start working on the same change, it attaches naturally.
- **[Risk] NewChangeDialog adds another modal** → Acceptable — follows existing pattern (ExploreDialog, ConfirmDialog). Keeps the header clean.
