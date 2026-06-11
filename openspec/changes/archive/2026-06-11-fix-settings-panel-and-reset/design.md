## Context

The chat display preferences system has three independent bugs discovered through testing:

1. **ChatViewMenu popover direction** — The popover (`right-0 mt-1`) always opens downward, clipping off-screen when near the viewport bottom. No viewport-awareness exists.
2. **DisplayPrefsSection hardcoded URL** — Uses `fetch("/api/preferences/display")` instead of `fetch(\`${getApiBase()}/api/preferences/display\`)`. Every other SettingsPanel API call uses `getApiBase()`. If the server is behind a reverse proxy or uses a non-root base path, global display preference changes silently fail.
3. **"Use global settings" broadcast loses the clear signal** — `handleSetSessionDisplayPrefs` builds `updates = { displayPrefsOverride: override === null ? undefined : override }`. When `override` is `null`, the value becomes `undefined`, which `JSON.stringify` drops during WS broadcast. The browser receives `updates: {}` and leaves the stale override in place.

## Goals / Non-Goals

**Goals:**
- ChatViewMenu popover auto-flips upward when the button is in the bottom ~200px of the viewport
- DisplayPrefsSection uses `getApiBase()` for its PATCH URL, matching every other API call in SettingsPanel
- Sending `override: null` over WS reliably clears the per-session override on all connected browsers
- Client `getSessionOverride` handles both `undefined` (session snapshot from JSON) and `null` (WS broadcast) correctly

**Non-Goals:**
- Not changing the display-prefs data model or persistence format
- Not adding a new artifact type to the schema
- Not changing the server-side REST API for display preferences

## Decisions

### Decision 1: Auto-flip via IntersectionObserver instead of viewport calculation

**Chosen:** Use a `useEffect` + `IntersectionObserver` on the popover's parent ref to detect when the popover would overflow the viewport bottom. Toggle between `top-full mt-1` (open down) and `bottom-full mb-1` (open up) via a state boolean.

**Alternatives considered:**
- `getBoundingClientRect()` on every open — simpler but runs on the main thread during the open animation.
- Pure CSS with `position: fixed` — would lose the relative positioning, differently on each screen.

**Why chosen:** IntersectionObserver is off-main-thread, composable, and doesn't add a dep. The observer fires on scroll and resize too, so the flip stays correct.

### Decision 2: Broadcast `null` instead of fixing the serializer

**Chosen:** In `handleSetSessionDisplayPrefs`, emit `updates.displayPrefsOverride = null` when the override is being cleared. On the client, `getSessionOverride` maps `null` → `undefined` so the rest of the consumer chain (`mergeDisplayPrefs`, `!override` guard, type narrowing) works without changes.

**Alternatives considered:**
- Custom `JSON.stringify` replacer — over-engineered, risks other bugs.
- Server-side `delete session.displayPrefsOverride` before broadcast — more invasive, requires changing the `sendTo`/broadcast path.
- Optimistic client-side clear — additional complexity in `ChatViewMenu`'s `clearOverride`.

**Why chosen:** Minimal change to one server line, one client line. The `getSessionOverride` function is the single point where override values enter the rendering pipeline, so mapping `null → undefined` there is the correct layer.

## Risks / Trade-offs

- **[Low] `null` in `updates` during broadcast** — The client's `session_updated` handler spreads `msg.updates` directly onto the session Map. Setting `displayPrefsOverride: null` on the session object is technically a type violation (`DisplayPrefs | undefined`), but `getSessionOverride` normalizes it on read. No runtime risk.
- **[Low] IntersectionObserver not in SSR** — This code only runs in the browser. No issue.
