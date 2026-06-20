# Design — Settings back returns to launching route

## Context

Reported bug: `/session/abc` → open Settings → back → lands on `/` (empty
cards), not `/session/abc`.

Current back wiring (from `fix-mobile-back-depth-aware`,
`overlay-url-routing`):

- `getMobileDepth` derives depth from the URL: 0 = cards, 1 = detail, 2 = overlay.
- `/session/:id`, `/folder/:cwd/{terminals,editor}`, `/settings`, `/tunnel-setup`
  are all **depth 1**.
- `goBack` (hybrid): `window.history.back()` only when the tracked predecessor
  is an in-app route with depth **strictly less** than current; else
  `navigate(computeBackTarget(current))`. `computeBackTarget` returns `/` for
  any depth-1 route.
- `nav-tracker` records every in-app navigation as `{ url, depth }` and exposes
  `predecessor()`.

Two back affordances on Settings, both wrong:

| Affordance | Location | Behavior today |
|---|---|---|
| SettingsPanel header arrow | `SettingsPanel.tsx:529` | hardcoded `navigate("/")` (desktop + mobile) |
| MobileShell header arrow | `App.tsx:1762` → `goBack()` | same-depth → `computeBackTarget` → `/` |

Root cause: Settings is a *modal* route (entered-from, return-to), but is
classified as a lateral depth-1 sibling whose parent is hardcoded `/`. The
tracker knows the real launching route; the strict shallower-only rule won't
use it for same-depth.

## Goals / Non-Goals

**Goals:**
- Back from Settings returns to the route it was opened from when that route is
  a tracked in-app route.
- Desktop and mobile share one back resolver (no second hardcoded path).
- Cold-load / deep-link into Settings (no predecessor) still resolves to `/`.

**Non-Goals:**
- No change to lateral depth-1 back (`/session/A → /session/B → /` stays).
- No change to overlay (depth-2) back rules.
- No change to `getMobileDepth` route-derivation.
- No new routes, no server/protocol/shared changes.

## Decisions

### D1. Modal-route carve-out in `goBack`, ahead of the shallower-only rule

`goBack` gains one branch evaluated before the existing fast-path:

```
goBack(navigate, currentRoute, tracker):
  currentDepth = routeDepth(currentRoute)
  if currentDepth === 0: return                       // no-op

  pred = tracker.predecessor()

  if isModalRoute(currentRoute) && pred:               // NEW
      window.history.back(); tracker.popNav(); return  // return to launcher
                                                        // (any predecessor depth)
  if pred && pred.depth < currentDepth:                // UNCHANGED fast-path
      window.history.back(); tracker.popNav(); return

  navigate(computeBackTarget(currentRoute))            // UNCHANGED fallback
```

`isModalRoute(url)` = first path segment is `settings` or `tunnel-setup`.

- *Why `history.back()` for modals (not `navigate(pred.url)`):* preserves scroll
  restoration + forward entry, consistent with the existing fast-path. The
  tracker proves `pred` is in-app, so `history.back()` is safe.
- *Why ahead of the shallower rule:* the modal case is same-depth (1→1), which
  the shallower rule (`<`) rejects. The carve-out must run first.
- *Why fall to `computeBackTarget` (→ `/`) when no predecessor:* origin genuinely
  unknown on cold-load; `/` is the safe floor.

### D2. `SettingsPanel` delegates back to an `onBack` prop

Add `onBack?: () => void` to `SettingsPanel`. Header arrow calls
`onBack?.()` instead of `navigate("/")`. `App` passes `onBack={goBack}` at
both render sites (`App.tsx` mobile ~1775, desktop ~1966). Removes the
hardcoded `navigate("/")` divergence; both platforms funnel through `goBack`.

Fallback: if `onBack` is omitted, keep `navigate("/")` for safety
(back-compat with any other caller / tests).

### D3. `tunnel-setup` included in the carve-out

`ZrokInstallGuide` already takes `onBack` but App wires it to
`() => navigate("/")`. Reclassify `tunnel-setup` as modal and route its
`onBack` through `goBack` too, for consistency. (Lower priority than Settings;
can ship together since the mechanism is identical.)

### D4. Content-view dismissal stays on the session (different layer)

The flows-plugin content-view (`FlowYamlPreviewClaim`) overlays the chat at the
same `/session/:id` URL, gated by the plugin UI-state predicate
`isFlowYamlPreviewActive`. Its `handleBack` already does the correct dismissal:

```
handleBack = () => {
  actions.setFlowYamlPreview(null);   // predicate → false → sessionDetail (chat) reappears
  actions.setSourceOpenAgent(null);
  onClose();                          // shell-provided; currently navigate("/")  ← the bug
};
```

The state-clear alone restores the chat at the current URL. The trailing
`onClose()` then runs the shell handler, wired at `App.tsx:1951` to
`navigate("/")`, which leaves the session entirely.

*Decision:* change the shell `onClose` from `() => navigate("/")` to a no-op
`() => {}`. Rationale:
- Content-view always renders inside a selected session (gated on
  `selectedSession`); dismissal should reveal that session's chat, which the
  plugin already does.
- `navigate("/session/:id")` would be redundant (URL is already there) and is
  unnecessary — a no-op is the minimal correct handler.
- This is a different layer from D1–D3 (plugin UI-state, not URL routing); it
  cannot reuse `isModalRoute`/`goBack`. Folded into this change by explicit
  decision; isolated to one `App.tsx` line.

*Why not edit the plugin's `handleBack`:* `onClose` is part of the
`content-view` slot contract shared by all claims/intents; the per-call-site
shell handler is the right place to decide "close means stay on the session."

## Risks / Trade-offs

- **Tracker drift** (StrictMode double-invoke, missed record): degrades to
  "no predecessor" → `computeBackTarget` → `/`. Same safe floor as today, never
  worse.
- **Modal opened with no in-app predecessor mid-session** (e.g. external nav in):
  resolves to `/`. Acceptable — origin unknown.
- **Existing regression spec** "history.back() fast-path used when predecessor
  is a shallower in-app route" uses current route = overlay (depth 2), not a
  modal route → carve-out does not fire → unaffected.

## Migration Plan

Pure client change. Ship behind no flag. Existing tests must stay green; add
new coverage (see tasks). Rebuild client + restart server; reload not required
(no extension change).

## Open Questions

- Should `/settings/:page` subpage → back also return to launcher? Yes — same
  first segment `settings`, covered by `isModalRoute`.
- Do desktop overlay headers (non-settings) need the same treatment? Out of
  scope here; they are depth-2 and already covered by the shallower rule or the
  ambiguous-overlay `/` floor.
