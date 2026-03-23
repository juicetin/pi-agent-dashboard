## Context

Session cards currently display only the project folder name and model. The data for richer cards (activity state, current tool, tokens, cost) already flows through the system but isn't surfaced in the session list. The server receives `event_forward` messages containing `agent_start`, `agent_end`, `tool_execution_start`, and `tool_execution_end` events, plus `stats_update` messages with token/cost data. However, it only broadcasts stats via `session_updated` — activity state and current tool are not extracted from events and pushed to browsers.

## Goals / Non-Goals

**Goals:**
- Show session activity state (streaming, idle/waiting, executing tool, ended) in the session list without clicking into a session
- Display current tool name when a tool is running
- Show token counts and cost on each card
- Show source badge and relative time
- All data pushed server-side so all browser clients see it (not just event subscribers)

**Non-Goals:**
- Changing the event forwarding pipeline or event storage
- Adding new events or protocol messages (reuse existing `session_updated`)
- Modifying the chat view or event reducer
- Adding session filtering or sorting

## Decisions

### Decision 1: Server-side event parsing for status updates

The server's `piGateway.onEvent` handler will inspect `event_forward` messages and extract session state changes. When it sees `agent_start`, `agent_end`, `tool_execution_start`, or `tool_execution_end`, it will update the session via `sessionManager.update()` and broadcast `session_updated` to all browsers.

**Why not client-side?** Client-side would only work for sessions the browser is subscribed to. The session list shows ALL sessions, so the server must push status for all of them.

**Alternatives considered:**
- Dedicated protocol message for status changes — unnecessary, `session_updated` already carries partial updates
- Extension sends explicit status messages — adds complexity to the extension; the events already contain the information

### Decision 2: Add "idle" to SessionStatus

Current `SessionStatus = "active" | "streaming" | "ended"`. We add `"idle"` to represent "connected, waiting for user input." The lifecycle becomes:

```
register → active → streaming (agent_start) → idle (agent_end) → streaming → ... → ended (unregister)
```

`"active"` means connected but no agent turn has started yet (brief initial state).

### Decision 3: Minimal card layout

Enrich the existing `SessionList` component rather than creating a new component. The card layout:

```
● project-name                    tui · 3m
  claude-sonnet-4
  ⚡ Reading files              12k↑ 3k↓ $0.08
```

- Line 1: Status dot + name + source badge + relative time
- Line 2: Model
- Line 3: Activity indicator (tool name or state) + token/cost stats

## Risks / Trade-offs

- **[Risk] Event parsing in server adds coupling** → Mitigation: Only inspect `eventType` field, don't parse event payloads deeply. Just look at top-level fields (`toolName`, `toolCallId`).
- **[Risk] Rapid tool_execution_start/end could cause many session_updated broadcasts** → Acceptable for now; these are lightweight JSON messages. Could debounce later if needed.
- **[Trade-off] "idle" status added to types** → Minor breaking change for any code that exhaustively matches on `SessionStatus`. Mitigated by updating all match sites in this change.
