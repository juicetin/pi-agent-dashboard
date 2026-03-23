## Why

The dashboard shows only accumulated token totals (↓45.2k ↑12.1k) in a text-only format with no per-turn breakdown, no context window usage, and no cache hit visibility. Users cannot tell how much context remains, whether cache is being used effectively, or how token consumption trends across turns. The pi SDK provides rich per-turn usage data (`Usage` on `AssistantMessage`) and context window info (`ctx.getContextUsage()`), but the bridge only forwards crude totals.

## What Changes

- **Bridge extension**: Enrich the `stats_update` message with per-turn usage breakdown (input, output, cacheRead, cacheWrite, cost) and context window usage (tokens, contextWindow) by extracting `message.usage` from `turn_end` events and calling `ctx.getContextUsage()`
- **Shared protocol**: Extend `stats_update` message type with `turnUsage` and `contextUsage` fields
- **Event reducer**: Add `turnStats[]` array and `contextUsage` to `SessionState`, populated from `turn_end` event data
- **Wire `SessionHeader` into `App.tsx`**: The component exists but is never rendered — add it above `ChatView`
- **New `TokenStatsBar` component**: Mini bar chart of per-turn token usage (blue=input, gray=output, green=cache), context window progress bar, and input/output counters with cost
- **Layout**: Stats bar renders between `SessionHeader` and `ChatView` for the selected session

## Capabilities

### New Capabilities

- `token-stats-bar`: Visual token usage display with per-turn bar chart, context window progress bar, and token/cost counters

### Modified Capabilities

- `bridge-extension`: Forward per-turn usage breakdown and context window usage via `stats_update`
- `shared-protocol`: Extend `stats_update` with `turnUsage` and `contextUsage` fields

## Impact

- `src/extension/bridge.ts` — Extract `message.usage` and `ctx.getContextUsage()` on `turn_end`, send enriched `stats_update`
- `src/shared/protocol.ts` — Extend `StatsUpdateMessage` type
- `src/shared/types.ts` — Add `TurnUsage` and `ContextUsage` types
- `src/client/lib/event-reducer.ts` — Add `turnStats[]` and `contextUsage` to `SessionState`, extract from `turn_end` data
- `src/client/components/TokenStatsBar.tsx` — New component: bar chart + context bar + counters
- `src/client/components/SessionHeader.tsx` — Already exists, may need minor updates
- `src/client/App.tsx` — Wire `SessionHeader` and `TokenStatsBar` into layout
