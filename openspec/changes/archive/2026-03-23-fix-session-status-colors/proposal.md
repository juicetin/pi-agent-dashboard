## Why

Session status colors in the sidebar are semantically inverted. "Active" (just connected) pulses yellow as if working, "streaming" (agent thinking) shows solid green as if idle, and "idle" (connected, waiting for input) shows gray as if offline. Users cannot quickly distinguish connected-and-waiting from actively-working from disconnected.

## What Changes

- Remap status colors in `SessionList.tsx` so:
  - `active` and `idle` → 🟢 solid green (connected)
  - `streaming` → 🟡 pulsing yellow (working)
  - `ended` → ⚫ gray (offline)
- Apply same color mapping in `SessionSidebar.tsx` for consistency

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `session-sidebar`: Status indicator colors change from current mapping to semantically correct mapping (connected=green, working=yellow-pulse, offline=gray)

## Impact

- `src/client/components/SessionList.tsx` — change `statusColors` object
- `src/client/components/SessionSidebar.tsx` — change `statusColors` object
- Client-only change, no protocol or server changes
