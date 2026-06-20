# Fix Settings back arrow to return to its launching route

## Why

Opening Settings from a session and pressing back lands on the empty card
list (`/`) instead of returning to the session it was opened from. The
launching session is lost.

Two independent back affordances both discard the origin:

1. `SettingsPanel`'s own header back arrow (`SettingsPanel.tsx:529`) is
   hardcoded to `navigate("/")`. This is the only back arrow on desktop and
   one of two on mobile. It never consults navigation history.
2. The mobile `MobileShell` header arrow (`App.tsx:1762`) calls `goBack()`.
   Settings (`/settings`, depth 1) and session detail (`/session/:id`, depth 1)
   are the **same depth**, so the depth-aware fast-path (`pred.depth < current`,
   strict) is skipped and `computeBackTarget` collapses any depth-1 route to
   `/`. Origin discarded.

Settings and tunnel-setup are *modal* routes — entered from a place, expected
to return to it — but the routing model treats them as lateral depth-1
siblings of session detail, whose computed parent is always `/`. The in-app
nav tracker already records the true launching route; the strict
shallower-only rule just refuses to use it for same-depth modals.

A third, distinct instance: the flows-plugin content-view (flow YAML preview)
overlays the chat at the same `/session/:id` URL, gated by plugin UI state.
Its back button (`FlowYamlPreviewClaim.handleBack`) already clears the plugin
state — which reveals the chat again — but then also calls the shell's
`onClose`, which `App.tsx:1951` wires to `navigate("/")`. That override yanks
the user to the card list instead of leaving them on the chat. Different layer
(plugin UI-state dismissal, not routing), but the fix is a shell one-liner:
`onClose` must not navigate away.

## What Changes

- `SettingsPanel` gains an `onBack` prop; its header back arrow calls `onBack`
  instead of the hardcoded `navigate("/")`.
- `App` passes `onBack={goBack}` to `SettingsPanel` at both render sites
  (desktop + mobile), unifying the two back paths onto one resolver.
- `goBack` / `computeBackTarget` gain a **modal-route carve-out** for
  `/settings` and `/tunnel-setup`: back returns to the tracked in-app
  predecessor (via `window.history.back()` when the predecessor is in-app),
  falling back to `/` only when no in-app predecessor exists (cold-load /
  deep-link).
- The strictly-shallower fast-path rule for lateral routes
  (session / folder / overlays) is left unchanged.
- The `ContentViewSlot` `onClose` at `App.tsx:1951` stops calling
  `navigate("/")`; the plugin's own state-clear already reveals the chat at the
  current session, so `onClose` becomes a no-op. Closing the flow YAML preview
  leaves the user on `/session/:id`.

## Impact

- Affected specs: `url-routing` (Requirement: Back navigation button).
- Affected code: `packages/client/src/components/SettingsPanel.tsx`,
  `packages/client/src/lib/history-back.ts`,
  `packages/client/src/lib/back-target.ts`,
  `packages/client/src/App.tsx` (modal `onBack` wiring + `ContentViewSlot`
  `onClose`).
- Mixed-layer note: this change spans URL-routing back (Settings/tunnel) AND
  plugin content-view dismissal (flows YAML preview). Folded together by
  explicit decision; the content-view fix is a shell one-liner.
- Mobile regression: every existing back-regression scenario is a non-modal
  route and is unaffected by the carve-out. One new scenario is added
  (session → settings → back → session).
- No server / protocol / shared changes.
