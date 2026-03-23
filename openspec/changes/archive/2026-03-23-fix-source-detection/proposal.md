## Why

Plain terminal pi sessions show source as "unknown" instead of "tui". The `SessionSource` type includes `"tui"` but the detection logic in `source-detector.ts` falls through to `"unknown"` when no special environment variables are set. Terminal is the most common way to run pi and should be correctly identified.

## What Changes

- Change default fallthrough in `detectSessionSource()` from `"unknown"` to `"tui"`
- ACP-from-Zed detection is deferred to a future change (requires investigation of available env vars)

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `bridge-extension`: Session source detection default changes from `"unknown"` to `"tui"` for plain terminal sessions

## Impact

- `src/extension/source-detector.ts` — change fallthrough return value
- One-line change in the extension, no protocol or client changes
