## Why

The session sidebar shows all sessions with no way to manage visual clutter. When many sessions accumulate (especially ended ones), it becomes hard to find the session you care about. Users need controls to hide irrelevant cards, filter to active-only, and reveal hidden cards when needed.

## What Changes

- Add **per-card hide button** `[✕]` on each session card to hide it from the list
- Add **"Active only" toggle** (default OFF) to bulk-filter ended/offline sessions
- Add **"Show hidden" toggle** to reveal manually hidden cards in a muted style with an unhide `[↩]` button
- Show a **"N hidden" indicator** when hidden sessions exist (only visible when showHidden is off)
- Store hidden session IDs and toggle states in `localStorage`
- Prune stale hidden IDs (sessions server no longer knows about) on page load

## Capabilities

### New Capabilities

- `session-filtering`: Client-side filtering controls for the session list — per-card hide, active-only toggle, show-hidden toggle, localStorage persistence

### Modified Capabilities

- `session-sidebar`: Session list gains filter controls in header area and hide/unhide buttons on cards

## Impact

- `src/client/components/SessionList.tsx` — add filter controls, hide buttons, filter logic
- New localStorage keys: `dashboard:hiddenSessions`, `dashboard:activeOnly`
- Client-only change, no protocol or server changes
