## MODIFIED Requirements

### Requirement: Stats tracking
The bridge extension SHALL accumulate token usage and cost from `turn_end` events and send `stats_update` messages to the dashboard server. Each `stats_update` SHALL include accumulated totals and, when available, per-turn usage breakdown and context window usage.

On `turn_end`, the bridge SHALL:
1. Extract `message.usage` from the event for per-turn breakdown (input, output, cacheRead, cacheWrite)
2. Call `ctx.getContextUsage()` for current context window state (tokens, contextWindow)
3. Send a `stats_update` with accumulated totals, `turnUsage`, and `contextUsage`

Stats SHALL include: tokensIn, tokensOut, cost (accumulated), turnUsage (per-turn), contextUsage (current window).

#### Scenario: Stats update after turn
- **WHEN** a `turn_end` event fires with a message containing usage data
- **THEN** the extension SHALL send a `stats_update` with accumulated totals, per-turn breakdown from `message.usage`, and context window state from `ctx.getContextUsage()`

#### Scenario: Turn end without usage data
- **WHEN** a `turn_end` event fires but `message.usage` is not available
- **THEN** the extension SHALL send a `stats_update` with accumulated totals only (no `turnUsage` field)

#### Scenario: Context usage unavailable
- **WHEN** `ctx.getContextUsage()` returns undefined (e.g., right after compaction)
- **THEN** the extension SHALL omit `contextUsage` from the `stats_update` message
