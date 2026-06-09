## Why

Model proxy configuration (enabled toggle, default model, second port) is editable in the Settings UI but changes are never persisted to `config.json`. The `handleSave` function in `SettingsPanel.tsx` builds a diff of every other config section (port, tunnel, memory limits, openspec, editor, auth, etc.) but omits `modelProxy`. After a page reload or server restart, any proxy settings revert to their previous values. Users configure the proxy, click Save, see "Settings saved", and later find their settings gone.

## What Changes

- Add `modelProxy` diff check to `handleSave` in `SettingsPanel.tsx`, matching the pattern used by `tunnel`, `memoryLimits`, `openspec`, `editor`, and `auth`
- Add a test verifying that `handleSave` includes `modelProxy` in the partial when it changed

## Capabilities

### New Capabilities

<!-- None — this is a bug fix within existing capabilities -->

### Modified Capabilities

- `model-proxy`: Add requirement that the Settings panel MUST persist model proxy configuration changes to the server config. The existing spec covers proxy behavior when config is set (proxy enabled/disabled, second port binding, default model fallback) but does not cover the UI→disk persistence path.

## Impact

- **Code**: `packages/client/src/components/SettingsPanel.tsx` — one line added to `handleSave` diff builder, plus structural merge in `writeConfigPartial` on the server side
- **Tests**: `packages/client/src/__tests__/SettingsPanel.test.tsx` (or a new save-handler unit test) — verify modelProxy changes are included in the PUT body
- **Server**: `packages/server/src/config-api.ts` already handles arbitrary partial keys via `{ ...existing, ...partial }`, so no server-side changes needed — `modelProxy` merges correctly by default
- **No API changes, no dependency changes, no breaking changes**
