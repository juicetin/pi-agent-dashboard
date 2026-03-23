## Context

The session sidebar currently shows all sessions in a flat list with no filtering controls. `SessionSidebar.tsx` has a basic active/ended split using `<details>` but `App.tsx` uses `SessionList.tsx` which has no filtering at all. Users need to manage clutter from accumulated sessions.

## Goals / Non-Goals

**Goals:**
- Per-card hide with unhide capability
- Bulk active-only toggle
- Show/reveal hidden sessions
- Persist filter state across page reloads

**Non-Goals:**
- Server-side filtering or hiding (purely client-side)
- Search/text filtering of sessions
- Sorting controls

## Decisions

**Three independent filter controls in the session list header:**
1. **Active-only toggle** — filters out ended/offline sessions. Default OFF.
2. **Hide button `[✕]`** — per-card, adds session ID to hidden set.
3. **Show hidden toggle** — reveals hidden cards in a muted style with unhide `[↩]` button.

**State stored in localStorage:**
- `dashboard:hiddenSessions` — JSON array of hidden session IDs
- `dashboard:activeOnly` — boolean

**Stale ID pruning:** On page load, intersect the hidden set with known session IDs to remove stale entries.

**Filter logic (applied in order):**
```
visible = sessions.filter(s => {
  if (activeOnly && s.status === "ended") return false
  if (hiddenSet.has(s.id) && !showHidden) return false
  return true
})
```

**Hidden card display:** When `showHidden` is ON, hidden cards appear with reduced opacity and an unhide `[↩]` button replacing the hide `[✕]` button.

**Hidden count indicator:** When hidden sessions exist and `showHidden` is OFF, show "N hidden" text at the bottom of the list.

## Risks / Trade-offs

- [localStorage only, not synced across browsers] → Acceptable for a developer dashboard; per-device preferences are fine
- [Hidden set grows unbounded] → Mitigated by pruning stale IDs on page load
