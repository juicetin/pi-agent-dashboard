## Why

Context-window usage is rendered in two places, and they disagree.

The **session card** reads its value from `contextUsageMap` (built in `App.tsx`), a two-tier lookup:

1. **Live** — `state.contextUsage` from the event reducer (set on turn events).
2. **Fallback** — server-persisted `session.contextTokens` + `session.contextWindow`, covering every session even before a live turn arrives.

The **content header** (the selected-session panel) reads `selectedState.contextUsage` **directly**, with no fallback. Two surfaces consume that raw value:

- Desktop `TokenStatsBar` context window progress bar.
- Mobile info strip's inline context bar.

Result: in the window between opening a session and its first live turn event — fresh page load, reconnect, or a resumed session that has not run a turn this connection — the **card shows a usage bar but the content header shows nothing** (empty/absent), for the same session. The two surfaces tell the user different things about the same fact.

## What Changes

Derive the content header's context-usage value the **same way the card does** — through the shared two-tier `contextUsageMap` (live value, else persisted fallback) — instead of raw `selectedState.contextUsage`.

- Look up `contextUsageMap.get(selectedId)` for the selected session and pass that to both content-header surfaces.
- Fall back to `selectedState.contextUsage` only if the map has no entry (preserves current behavior in the rare case the map is empty).
- `TokenStatsBar`'s per-segment proportioning already degrades gracefully: when the value comes from the persisted fallback there is no `latestTurn`, so the bar renders as a single `contextPercent` segment (same as the card). No segmentation change needed.

Out of scope (deferred): unifying the **visibility toggles**. The card bar is gated by the `contextUsageBar` display pref; the header bar is bundled into the `tokenStatsBar` pref. Aligning those toggles is a separate concern and not part of this change.

## Capabilities

### Modified Capabilities

- `token-stats-bar`: The "Context window progress bar" requirement is amended so the bar's value derives from the shared session context-usage source (live event-reducer value, else server-persisted `contextTokens`/`contextWindow`), matching the session card. The "Context usage unavailable" scenario now means *neither* live nor persisted data exists.

## Impact

**Code touched:**
- `packages/client/src/App.tsx` — pass `contextUsageMap.get(selectedId) ?? selectedState.contextUsage` to the desktop `TokenStatsBar` (L~1230) and the mobile info-strip inline bar (L~1203), instead of raw `selectedState.contextUsage`.
- Tests: extend `TokenStatsBar.test.tsx` (or an App-level test) to assert the header bar shows persisted usage when live `contextUsage` is absent but the session carries `contextTokens`/`contextWindow`.

**Not touched:**
- `packages/client/src/components/TokenStatsBar.tsx` — pure component; it already accepts `contextUsage` as a prop and degrades correctly when `turnStats` is empty. No internal change.
- `packages/client/src/components/ContextUsageBar.tsx` / `SessionCard.tsx` — card path unchanged; it is the reference behavior.
- `contextUsageMap` construction in `App.tsx` — already correct; this change only reuses it for the header.
- Display-preference toggles (`contextUsageBar`, `tokenStatsBar`) — visibility gating unchanged (toggle unification explicitly deferred).
