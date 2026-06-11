## Why

Three bugs in the settings/display-preferences UI make the chat view's "View" popover unusable at the bottom of the viewport, global display preferences silently fail behind reverse proxies, and the "Use global settings" reset button appears to do nothing because the WebSocket broadcast drops `undefined` values during JSON serialization.

## What Changes

- ChatViewMenu popover flips upward when near the bottom of the viewport instead of extending off-screen
- `DisplayPrefsSection` in SettingsPanel uses `getApiBase()` for the PATCH URL instead of a hardcoded path, matching the pattern every other API call in SettingsPanel uses
- "Use global settings" button's WebSocket broadcast sends `null` instead of `undefined` so `JSON.stringify` preserves the field, and the client's `getSessionOverride` maps `null` to `undefined`
- The `handleSetSessionDisplayPrefs` server handler broadcasts `null` for cleared overrides and client merges correctly

## Capabilities

### New Capabilities

None — all three fixes are bug repairs to existing capabilities.

### Modified Capabilities

- `chat-display-preferences`: ChatViewMenu popover uses viewport-aware positioning (auto-flip direction). The "Use global settings" reset reliably clears per-session overrides via `null`-safe WS broadcast.
- `settings-panel`: `DisplayPrefsSection` uses `getApiBase()` for the `PATCH /api/preferences/display` call, fixing proxy/rewrite scenarios.

## Impact

- `packages/client/src/components/ChatViewMenu.tsx` — popover positioning logic + `clearOverride` / `patch` callbacks
- `packages/client/src/components/SettingsPanel.tsx` — `DisplayPrefsSection`'s `patch` fetch URL
- `packages/server/src/browser-handlers/session-meta-handler.ts` — `handleSetSessionDisplayPrefs` broadcast value type
- `packages/client/src/lib/DisplayPrefsContext.tsx` — `getSessionOverride` null-to-undefined mapping
