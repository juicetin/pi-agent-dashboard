## Why

On mobile browsers (especially Chrome on Android and Safari on iOS), pulling down on the page triggers the browser's native pull-to-refresh, which reloads the entire dashboard and disconnects the WebSocket session. This is disruptive during active agent monitoring. The browser's overscroll bounce also interferes with normal scrolling in chat views.

## What Changes

- Add CSS `overscroll-behavior: none` on the `html`/`body` elements to disable the browser's native pull-to-refresh gesture and overscroll bounce effects
- This is a purely CSS change — no JavaScript or component modifications needed

## Capabilities

### New Capabilities
_None — this is a small CSS fix._

### Modified Capabilities
- `mobile-resilience`: Add requirement that the dashboard SHALL disable browser pull-to-refresh on mobile viewports

## Impact

- **Files**: `src/client/index.css` (add `overscroll-behavior: none` to html/body)
- **Risk**: Minimal — `overscroll-behavior` is well-supported (Chrome 63+, Safari 16+, Firefox 59+) and only affects overscroll, not normal in-page scrolling
