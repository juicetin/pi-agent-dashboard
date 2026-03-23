## Context

The pi SDK provides rich per-turn usage data on `AssistantMessage.usage` (input, output, cacheRead, cacheWrite tokens + cost breakdown) and context window info via `ctx.getContextUsage()` (tokens used, contextWindow size, percent). The bridge extension already forwards `turn_end` events containing the full `message` object with usage, but only extracts crude `tokensIn`/`tokensOut`/`cost` totals for `stats_update`. The `SessionHeader` component exists but is never rendered in `App.tsx`.

## Goals / Non-Goals

**Goals:**
- Forward per-turn usage breakdown and context window usage from bridge to client
- Store per-turn usage history in client state for bar chart visualization
- Display a stats bar with mini bar chart, context progress bar, and counters
- Wire the existing `SessionHeader` into the layout

**Non-Goals:**
- Historical stats persistence (stats are session-scoped, lost on page refresh — same as current behavior)
- Aggregate stats across sessions
- Cost breakdown by turn (only total cost shown)
- Modifying the server — data flows through existing `event_forward` and `stats_update` mechanisms

## Decisions

### 1. Enrich `stats_update` with per-turn usage and context usage (Option A)

**Decision**: Extend the existing `stats_update` message with two new optional fields:
- `turnUsage?: { input, output, cacheRead, cacheWrite }` — per-turn token breakdown
- `contextUsage?: { tokens: number | null, contextWindow: number }` — current context window state

**Rationale**: Extends the existing stats mechanism rather than adding new message types or relying on parsing raw `turn_end` event data in the reducer. The bridge already has a `turn_end` handler that sends `stats_update` — just enrich it.

**Alternative rejected**: Extracting usage from raw `event_forward` data in the reducer. While the data is there, it requires the reducer to understand `AssistantMessage` structure. Keeping extraction in the bridge (close to the SDK) is cleaner.

### 2. Extract usage in the bridge's `turn_end` handler

**Decision**: In the existing `turn_end` handler in `bridge.ts`:
- Access `event.message.usage` for per-turn breakdown
- Call `ctx.getContextUsage()` for context window state
- Include both in the `stats_update` message

**Rationale**: The bridge already handles `turn_end` to send stats. `ctx.getContextUsage()` is only available in the extension context, not from the raw event data, so this must happen in the bridge.

### 3. Store turn history as a capped array in SessionState

**Decision**: Add `turnStats: TurnStat[]` to `SessionState`, capped at 50 turns. Each entry: `{ input, output, cacheRead, cacheWrite }`. Populated from `stats_update` messages when `turnUsage` is present.

**Rationale**: 50 turns is more than enough for the bar chart (UI shows last ~15-20). Capping prevents unbounded memory growth in long sessions.

### 4. New `TokenStatsBar` component below `SessionHeader`

**Decision**: Create a new component that renders:
- Mini stacked bar chart showing last N turns (input=blue, output=gray, cacheRead=green)
- Context window progress bar (used/total with formatted labels)
- Token counters (↓input ↑output) and cost

**Rationale**: Separating from `SessionHeader` keeps components focused. The stats bar is visually distinct and could be collapsible later.

### 5. Wire `SessionHeader` into App.tsx

**Decision**: Import and render `SessionHeader` above `TokenStatsBar` and `ChatView`. Pass the selected session and state.

**Rationale**: The component already exists with model, duration, and basic stats display. Just needs to be connected.

## Risks / Trade-offs

- **[Risk] `ctx.getContextUsage()` may return undefined** → Handle gracefully: don't send `contextUsage` field if undefined, UI shows "unknown" or hides context bar
- **[Risk] `message.usage` shape may vary by provider** → The pi SDK normalizes all providers to the `Usage` interface, so this is safe
- **[Trade-off] Stats lost on page refresh** → Acceptable for MVP. Turn history rebuilds as new turns complete. Could persist via event replay later.
- **[Trade-off] cacheWrite not shown in bar chart** → Only input, output, cacheRead shown as bars to match the reference UI. cacheWrite is rarely meaningful for visualization.
