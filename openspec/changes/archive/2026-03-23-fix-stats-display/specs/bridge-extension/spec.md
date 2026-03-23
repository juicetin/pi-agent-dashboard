## MODIFIED Requirements

### Requirement: Stats tracking
The bridge extension SHALL extract token usage and cost from `turn_end` events by reading `event.message.usage` and send `stats_update` messages to the dashboard server. Each `stats_update` SHALL include per-turn token counts and cost, and when available, per-turn usage breakdown and context window usage.

On `turn_end`, the bridge SHALL:
1. Check if `event.message.usage` exists; if not, skip sending stats
2. Extract per-turn values: `usage.input` → tokensIn, `usage.output` → tokensOut, `usage.cost.total` → cost
3. Extract per-turn breakdown: `{ input: usage.input, output: usage.output, cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite }`
4. Call `ctx.getContextUsage()` for current context window state
5. Send a `stats_update` with per-turn values, `turnUsage`, and `contextUsage`

Stats SHALL include: tokensIn, tokensOut, cost (per-turn), turnUsage (per-turn breakdown), contextUsage (current window).

#### Scenario: Stats update after turn
- **WHEN** a `turn_end` event fires with `event.message.usage` containing `{ input: 1500, output: 300, cacheRead: 800, cacheWrite: 200, cost: { total: 0.004 } }`
- **THEN** the extension SHALL send a `stats_update` with `tokensIn: 1500`, `tokensOut: 300`, `cost: 0.004`, `turnUsage: { input: 1500, output: 300, cacheRead: 800, cacheWrite: 200 }`, and context window state from `ctx.getContextUsage()`

#### Scenario: Turn end without usage data
- **WHEN** a `turn_end` event fires but `event.message.usage` is undefined
- **THEN** the extension SHALL NOT send a `stats_update` message

#### Scenario: Context usage unavailable
- **WHEN** `ctx.getContextUsage()` returns undefined
- **THEN** the extension SHALL omit `contextUsage` from the `stats_update` message
