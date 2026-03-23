## MODIFIED Requirements

### Requirement: Stats aggregation
The dashboard server SHALL accumulate token usage and cost per session when `stats_update` messages arrive from extensions. It SHALL add the per-turn values to the session's running totals in both memory (session manager) and SQLite, then broadcast the accumulated totals via `session_updated` to subscribed browsers.

#### Scenario: Stats update from extension
- **WHEN** a `stats_update` message arrives with `tokensIn: 1500`, `tokensOut: 300`, `cost: 0.004` for a session that already has `tokensIn: 3000`, `tokensOut: 600`, `cost: 0.008`
- **THEN** the server SHALL update the session to `tokensIn: 4500`, `tokensOut: 900`, `cost: 0.012` in the session manager, and broadcast `session_updated` with those accumulated totals

#### Scenario: First stats update for a session
- **WHEN** a `stats_update` message arrives for a session with `tokensIn: 0`, `tokensOut: 0`, `cost: 0`
- **THEN** the server SHALL set the session totals to the received values and broadcast them

#### Scenario: Stats persisted in event store
- **WHEN** a `stats_update` message arrives
- **THEN** the server SHALL store the per-turn values (not accumulated totals) as a `stats_update` event in the event store, so the client-side reducer can independently accumulate them during replay
