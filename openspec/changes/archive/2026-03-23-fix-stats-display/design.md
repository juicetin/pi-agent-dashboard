## Context

The bridge extension's `turn_end` handler checks for `event.tokensIn`, `event.tokensOut`, and `event.usage` — fields that don't exist on pi's `TurnEndEvent`. The actual type is `{ type: "turn_end", turnIndex: number, message: AgentMessage, toolResults: ToolResultMessage[] }`, where usage lives at `event.message.usage`.

Additionally, the server broadcasts raw per-turn deltas via `session_updated` instead of accumulated totals, and never persists stats to the session manager.

## Goals / Non-Goals

**Goals:**
- Bridge reads usage from `event.message.usage` (the correct location)
- Server accumulates stats into session manager and broadcasts cumulative totals
- Token counters, transfer arrows, cost, and per-turn bar graph all display correctly

**Non-Goals:**
- Changing the client-side reducer or UI components (they're already correct)
- Changing the `stats_update` protocol message format
- Adding new stats fields

## Decisions

### 1. Read from `event.message.usage`

The `TurnEndEvent.message` is an `AssistantMessage` with a `usage: Usage` field:
```
Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: { input, output, cacheRead, cacheWrite, total }
}
```

Mapping:
- `tokensIn` ← `usage.input`
- `tokensOut` ← `usage.output`
- `cost` ← `usage.cost.total`
- `turnUsage` ← `{ input, output, cacheRead, cacheWrite }` directly from usage

Remove the broken guard condition (`if (data.usage || data.tokensIn || data.tokensOut)`) and replace with a check on `event.message?.usage`.

### 2. Server accumulates before broadcasting

In the `stats_update` handler in `server.ts`:
1. Read current session from `sessionManager.get(sessionId)`
2. Compute accumulated totals: `session.tokensIn + msg.stats.tokensIn`
3. Call `sessionManager.update()` with the new totals
4. Broadcast the accumulated totals (not the deltas) via `session_updated`

The event store still records the per-turn deltas (unchanged) — the reducer correctly uses `+=` on those.

## Risks / Trade-offs

- **[Risk] Usage field absent on some turns** → Guard on `message?.usage` being truthy; skip stats_update if missing (matches existing spec for "turn end without usage data" scenario).
- **[Risk] Double-counting on reconnect** → Not a new risk; event replay already accumulates via reducer. Session manager totals are display-only for the sidebar.
