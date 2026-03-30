## Context

Mobile browsers implement pull-to-refresh as a native gesture when the user overscrolls the page. This causes a full page reload, disconnecting the dashboard's WebSocket and losing in-memory state. The dashboard is a long-lived SPA that should never be refreshed by accident.

## Goals / Non-Goals

**Goals:**
- Prevent browser pull-to-refresh from triggering on the dashboard
- Prevent overscroll bounce effects that feel non-native in the SPA context

**Non-Goals:**
- Custom pull-to-refresh UI (not needed — the dashboard has no refresh-on-pull feature)
- Disabling normal in-page scrolling (chat views, sidebars must scroll normally)

## Decisions

### Use `overscroll-behavior: none` on `html` and `body`

**Rationale**: This is the standard CSS property designed for exactly this purpose. It disables the browser's overscroll effects (pull-to-refresh, bounce) without affecting normal scrolling within the page. No JavaScript needed.

**Alternative considered**: `touch-action: manipulation` — this only affects double-tap zoom, not pull-to-refresh. Rejected.

**Alternative considered**: JavaScript `touchmove` preventDefault on the document — fragile, can interfere with normal scrolling, and requires `passive: false` listeners which hurt scroll performance. Rejected.

## Risks / Trade-offs

- [Minimal] `overscroll-behavior` is not supported on very old browsers (pre-2018). → No mitigation needed; the dashboard already targets modern browsers.
