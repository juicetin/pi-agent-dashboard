## 1. Shared Types and Protocol

- [x] 1.1 Add `TurnUsage` type to `src/shared/types.ts`: `{ input: number, output: number, cacheRead: number, cacheWrite: number }`
- [x] 1.2 Add `ContextUsage` type to `src/shared/types.ts`: `{ tokens: number | null, contextWindow: number }`
- [x] 1.3 Extend `StatsUpdateMessage` in `src/shared/protocol.ts` to include optional `turnUsage?: TurnUsage` and `contextUsage?: ContextUsage` in the stats object

## 2. Bridge Extension

- [x] 2.1 Update `turn_end` handler in `src/extension/bridge.ts` to extract `message.usage` (input, output, cacheRead, cacheWrite) and include as `turnUsage` in `stats_update`
- [x] 2.2 Update `turn_end` handler to call `ctx.getContextUsage()` and include as `contextUsage` in `stats_update` (omit if undefined)

## 3. Event Reducer

- [x] 3.1 Add `TurnStat` type and `turnStats: TurnStat[]` array to `SessionState` (capped at 50)
- [x] 3.2 Add `contextUsage?: { tokens: number | null, contextWindow: number }` to `SessionState`
- [x] 3.3 Extract per-turn usage from `turn_end` event data (`data.message.usage`) and push to `turnStats`
- [x] 3.4 Extract context usage from `turn_end` event data (`data.contextUsage`) and store in `contextUsage`
- [x] 3.5 Write tests: `turn_end` with usage data populates `turnStats` and `contextUsage`
- [x] 3.6 Write test: `turnStats` caps at 50 entries

## 4. TokenStatsBar Component

- [x] 4.1 Create `src/client/components/TokenStatsBar.tsx` with props: `turnStats`, `contextUsage`, `tokensIn`, `tokensOut`, `cost`
- [x] 4.2 Render mini stacked bar chart (blue=input, gray=output, green=cacheRead) scaled to max turn
- [x] 4.3 Render context window progress bar with formatted labels (used/total)
- [x] 4.4 Render token counters (↓input ↑output) and cost display
- [x] 4.5 Handle empty state (no turns, no context usage)

## 5. App Layout Integration

- [x] 5.1 Import and render `SessionHeader` in `App.tsx` above `ChatView`, passing selected session and state
- [x] 5.2 Import and render `TokenStatsBar` between `SessionHeader` and `ChatView`, passing state fields
- [x] 5.3 Hide `TokenStatsBar` when no session is selected
