## 1. Types

- [x] 1.1 Add `"idle"` to `SessionStatus` in `src/shared/types.ts`
- [x] 1.2 Update `statusColors` mapping in `SessionList.tsx` to include `idle`

## 2. Server-side event parsing

- [x] 2.1 Add tests for server extracting status/currentTool from forwarded events
- [x] 2.2 In `server.ts` `piGateway.onEvent`, parse `event_forward` for `agent_start`, `agent_end`, `tool_execution_start`, `tool_execution_end` and call `sessionManager.update()` + `browserGateway.broadcastSessionUpdated()`

## 3. Enriched session card UI

- [x] 3.1 Add `formatTokens` utility function (e.g., 12400 → "12.4k") with tests
- [x] 3.2 Add `formatRelativeTime` utility function (e.g., 180000ms → "3m") with tests
- [x] 3.3 Update `SessionList.tsx` card to show: source badge, relative time, activity state label, current tool name, token counts, and cost
