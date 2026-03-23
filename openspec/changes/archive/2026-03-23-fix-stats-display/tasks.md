## 1. Fix bridge stats extraction

- [x] 1.1 Update `turn_end` handler in `src/extension/bridge.ts` to read usage from `event.message.usage` instead of top-level fields
- [x] 1.2 Add/update tests for the bridge `turn_end` stats extraction

## 2. Fix server stats accumulation

- [x] 2.1 Update `stats_update` handler in `src/server/server.ts` to accumulate totals into session manager and broadcast cumulative values
- [x] 2.2 Add/update tests for the server stats accumulation and broadcasting
