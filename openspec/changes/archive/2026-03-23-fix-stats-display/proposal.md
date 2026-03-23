## Why

Token stats, transfer counters (↓in ↑out), and the per-turn bar graph never appear in the dashboard because the bridge extension reads usage data from fields that don't exist on the `turn_end` event. The guard condition always fails, so `stats_update` messages are never sent.

## What Changes

- **Fix bridge `turn_end` handler**: Read usage from `event.message.usage` (where pi actually puts it) instead of non-existent top-level `event.tokensIn`/`event.tokensOut`/`event.usage` fields.
- **Fix server stats accumulation**: The server's `stats_update` handler must accumulate totals into the session manager (currently skipped) and broadcast cumulative values (currently broadcasts per-turn deltas that overwrite cumulative fields).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `bridge-extension`: The stats tracking requirement's implementation doesn't match the spec — must read `message.usage` from the `TurnEndEvent` and extract `usage.input`, `usage.output`, `usage.cost.total`.
- `dashboard-server`: Must accumulate stats into session state and broadcast cumulative totals (not raw deltas) via `session_updated`.

## Impact

- `src/extension/bridge.ts` — Fix `turn_end` handler to read correct fields
- `src/server/server.ts` — Accumulate stats into session manager, broadcast totals
- `src/server/session-manager.ts` — No structural change, just needs to be called
- Client code (`TokenStatsBar`, `SessionHeader`, `SessionList`) — No changes needed, already correct
- `src/client/lib/event-reducer.ts` — No changes needed, accumulation logic is correct
