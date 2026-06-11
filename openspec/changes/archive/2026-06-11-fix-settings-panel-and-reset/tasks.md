## 1. ChatViewMenu popover auto-flip

- [x] 1.1 Add `flipUp` state + `useEffect` with `IntersectionObserver` to `ChatViewMenu` that detects when the dropdown would overflow the viewport bottom
- [x] 1.2 Toggle popover CSS class between `top-full mt-1` (down) and `bottom-full mb-1` (up) based on `flipUp` state
- [x] 1.3 Verify: popover opens downward on the upper viewport; flips upward within 200px of the bottom; re-evaluates on resize

## 2. Fix "Use global settings" WS broadcast losing the clear signal

- [x] 2.1 In `handleSetSessionDisplayPrefs` (`session-meta-handler.ts`), change `updates.displayPrefsOverride = undefined` to `null` when `override === null`
- [x] 2.2 In `getSessionOverride` (`DisplayPrefsContext.tsx`), normalize `null` to `undefined` before returning so downstream consumer types remain unchanged
- [x] 2.3 Verify: sending `override: null` clears the override on all connected browsers (not just the sender after reload)

## 3. Fix DisplayPrefsSection hardcoded PATCH URL

- [x] 3.1 In `DisplayPrefsSection` (`SettingsPanel.tsx`), change the `patch` function's fetch URL from `"/api/preferences/display"` to `` `${getApiBase()}/api/preferences/display` ``
- [x] 3.2 Import `getApiBase` if not already imported in scope (it's used elsewhere in `SettingsPanel.tsx`)
- [x] 3.3 Verify: `DisplayPrefsSection` PATCH goes through the same base path as every other SettingsPanel API call
