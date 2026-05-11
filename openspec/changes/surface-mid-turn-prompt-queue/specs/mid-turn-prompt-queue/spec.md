## ADDED Requirements

### Requirement: Bridge forwards pi runtime queue updates as `queue_state` events

The bridge extension SHALL subscribe to pi-mono's `queue_update` event and forward each update to the server as an `event_forward` message with `eventType: "queue_state"` and `data: { steering: string[], followUp: string[] }`. The forwarded payload SHALL be a structural copy of pi's `queue_update` payload (string arrays in pi's reported order) and SHALL NOT include any other fields.

#### Scenario: Bridge forwards queue update on first add
- **WHEN** pi's `AgentSession` emits `queue_update` with `{ steering: ["fix the bug"], followUp: [] }` for the active session
- **THEN** the bridge SHALL emit `event_forward { type: "event_forward", sessionId, event: { eventType: "queue_state", timestamp, data: { steering: ["fix the bug"], followUp: [] } } }` to the server

#### Scenario: Bridge forwards empty queue on clear
- **WHEN** pi's `AgentSession` emits `queue_update` with `{ steering: [], followUp: [] }` after `clearQueue()` runs
- **THEN** the bridge SHALL emit a `queue_state` event with `data: { steering: [], followUp: [] }`

#### Scenario: No queue events for sessions other than the bridge's session
- **WHEN** pi's `AgentSession` emits `queue_update` for a session whose `sessionId` does not match the bridge's current session
- **THEN** the bridge SHALL NOT forward the update

### Requirement: Server caches per-session queue state from `queue_state` events

The dashboard server SHALL maintain a `Session.queue` field of shape `{ steering: string[], followUp: string[] }`. The default value for any new or re-registered session SHALL be `{ steering: [], followUp: [] }`. On receiving a `queue_state` event from a bridge, the server SHALL replace the session's `queue` field wholesale with the event's `data` payload (no merging) and SHALL broadcast a `session_updated` (or equivalent UI cache update) message to all subscribed browsers carrying the new `queue` value.

#### Scenario: Initial registration starts with empty queue
- **WHEN** a bridge registers a session for the first time
- **THEN** the server's `Session.queue` for that session SHALL be `{ steering: [], followUp: [] }`

#### Scenario: Wholesale replace on update
- **WHEN** the server receives `queue_state { data: { steering: ["a", "b"], followUp: ["c"] } }` for a session
- **AND** the prior `Session.queue` was `{ steering: ["x"], followUp: [] }`
- **THEN** the server's `Session.queue` SHALL become `{ steering: ["a", "b"], followUp: ["c"] }` (no merge with prior state)

#### Scenario: Broadcast to subscribed browsers
- **WHEN** the server updates a session's `queue` from a `queue_state` event
- **THEN** every browser subscribed to that session SHALL receive a session-updated broadcast carrying the new `queue` value within the same broadcast batch as other UI cache updates

#### Scenario: Replay on subscribe
- **WHEN** a browser subscribes to a session whose `Session.queue` is non-empty
- **THEN** the initial subscription replay SHALL include the current `queue` value

#### Scenario: Queue reset on session re-registration
- **WHEN** a bridge re-registers (e.g. after reconnect) for a session whose `Session.queue` was non-empty
- **THEN** the server SHALL reset `Session.queue` to `{ steering: [], followUp: [] }` and wait for a fresh `queue_state` event from the bridge before showing any queue contents

### Requirement: `send_prompt` accepts an optional `deliverAs` field

The browser-to-server `send_prompt` message SHALL accept an optional `deliverAs?: "steer" | "followUp" | "nextTurn"` field. The server SHALL forward this field unchanged to the bridge in its `send_prompt` message. The bridge, when delivering the message via `pi.sendUserMessage()`, SHALL pass the `deliverAs` value through as the `deliverAs` option. When `deliverAs` is omitted, the bridge SHALL use `"steer"` as the default.

#### Scenario: Explicit deliverAs from client passes through end-to-end
- **WHEN** a browser sends `send_prompt { text: "x", deliverAs: "followUp" }`
- **THEN** the bridge's `pi.sendUserMessage` call for that prompt SHALL include `{ deliverAs: "followUp" }`

#### Scenario: Omitted deliverAs defaults to steer
- **WHEN** a browser sends `send_prompt { text: "x" }` with no `deliverAs` field
- **AND** the agent is currently streaming
- **THEN** the bridge's `pi.sendUserMessage` call SHALL include `{ deliverAs: "steer" }`

#### Scenario: deliverAs ignored when not streaming
- **WHEN** a browser sends `send_prompt { text: "x", deliverAs: "followUp" }` while the agent is idle
- **THEN** the message SHALL begin a normal new turn (pi's existing behavior); the `deliverAs` field has no effect

### Requirement: `clear_queue` browser-to-server message

The protocol SHALL define a new browser-to-server message `clear_queue { type: "clear_queue", sessionId: string }`. On receipt, the server SHALL forward an equivalent `clear_queue { sessionId }` message to the session's bridge. The bridge SHALL invoke pi's queue-clearing API (the runtime call that clears both `steering` and `followUp` queues). Successful clearing SHALL produce a follow-up `queue_update` from pi with empty arrays, which propagates through the existing `queue_state` pathway.

#### Scenario: Clear from browser empties the queue end-to-end
- **WHEN** a browser sends `clear_queue { sessionId: "S" }` to the server while `Session.queue` for S is `{ steering: ["a"], followUp: ["b"] }`
- **THEN** the server SHALL forward `clear_queue { sessionId: "S" }` to S's bridge
- **AND** the bridge SHALL call pi's clear-queue API
- **AND** within one event round-trip, every subscribed browser SHALL observe `Session.queue` for S as `{ steering: [], followUp: [] }`

#### Scenario: Clear is idempotent when queue already empty
- **WHEN** a browser sends `clear_queue` while `Session.queue` is already `{ steering: [], followUp: [] }`
- **THEN** the server SHALL forward the message
- **AND** the bridge SHALL call pi's clear-queue API
- **AND** no error SHALL be raised; observable state SHALL remain unchanged

#### Scenario: Clear for unknown session is dropped
- **WHEN** a browser sends `clear_queue { sessionId: "missing" }` for a session the server does not know
- **THEN** the server SHALL drop the message and SHALL NOT forward anything to a bridge

### Requirement: Queue panel renders above the chat input

When `Session.queue.steering.length + Session.queue.followUp.length > 0`, the chat view SHALL render a queue panel between the message list and the chat input. The panel SHALL list each queued message as a chip showing (a) a tier label (`steer` or `followUp`) and (b) the message text (truncated to one line with overflow ellipsis). Steering chips SHALL render before follow-up chips; within each tier, chips SHALL render in pi's reported order. The panel SHALL include a "Clear all" affordance that, when clicked, sends a `clear_queue` message for the active session.

#### Scenario: Empty queue hides the panel
- **WHEN** `Session.queue` is `{ steering: [], followUp: [] }`
- **THEN** the queue panel SHALL NOT be rendered

#### Scenario: Mixed queue shows steering first then followUp
- **WHEN** `Session.queue` is `{ steering: ["A", "B"], followUp: ["C"] }`
- **THEN** the queue panel SHALL render three chips in order: `[steer] A`, `[steer] B`, `[followUp] C`

#### Scenario: Long message text truncates
- **WHEN** a queue chip's message text exceeds the chip's render width
- **THEN** the chip SHALL display the text with an ellipsis and SHALL NOT wrap to multiple lines

#### Scenario: Clear all sends clear_queue
- **WHEN** the user clicks the queue panel's "Clear all" button while subscribed to session S
- **THEN** the client SHALL send `clear_queue { sessionId: "S" }` to the server

### Requirement: Tier picker defaults to `steer` and persists per-session

The chat input SHALL include a tier picker that defaults to `steer` and offers `steer`, `followUp`, and `nextTurn` as choices. The selected tier SHALL be persisted in `localStorage` keyed by session id. When the user sends a prompt while the agent is streaming, the picker's current value SHALL be passed as `deliverAs`. When the agent is not streaming, the picker SHALL be hidden or visually de-emphasised because `deliverAs` is ignored.

#### Scenario: Default value is steer
- **WHEN** a session has no persisted tier preference and the agent begins streaming
- **THEN** the tier picker SHALL show `steer`

#### Scenario: Picker selection persists per-session
- **WHEN** the user changes the picker to `followUp` for session A
- **AND** later returns to session A (e.g. after navigating away and back, or after a page reload)
- **THEN** the picker SHALL show `followUp` for session A

#### Scenario: Picker selection does not leak across sessions
- **WHEN** session A's picker is set to `followUp`
- **AND** the user switches to session B which has no persisted preference
- **THEN** session B's picker SHALL show `steer`

#### Scenario: Send while streaming includes deliverAs from picker
- **WHEN** the agent is streaming
- **AND** the picker is set to `nextTurn`
- **AND** the user submits "remember to commit"
- **THEN** the client SHALL send `send_prompt { text: "remember to commit", deliverAs: "nextTurn" }`

#### Scenario: Picker hidden when agent is idle
- **WHEN** `Session.status` is not `streaming`
- **THEN** the tier picker SHALL be hidden or rendered with reduced visual weight indicating it has no effect

### Requirement: Image attachments are not represented in queue chips

Pi's `queue_update` payload conveys only message text. The dashboard SHALL render queue chips with text only and SHALL NOT attempt to display image previews on chips. When the user sends an image-bearing prompt that lands in the queue, the optimistic-prompt card SHALL still render with images (per the existing `optimistic-prompt` capability) until that prompt is observed in the queue, at which point the card SHALL be replaced by a text-only chip and the image previews SHALL no longer be visible.

#### Scenario: Image-bearing send shows optimistic card with images, then text-only chip
- **WHEN** the user sends `{ text: "describe", images: [PNG] }` while the agent is streaming
- **THEN** initially an optimistic card SHALL render with the text and the PNG thumbnail
- **WHEN** the next `queue_state` event reports `steering: ["describe"]`
- **THEN** the optimistic card SHALL be replaced by a `[steer] describe` chip with no image thumbnail

### Requirement: Session card shows a count-only queue indicator

When a session's `queue.steering.length + queue.followUp.length > 0`, the session card in the session list SHALL display a small queue indicator showing the total count (e.g. a badge with the number). The indicator SHALL NOT show queue contents — it is an at-a-glance signal only. When the count is zero, no indicator SHALL be rendered.

#### Scenario: Indicator appears when queue non-empty
- **WHEN** `Session.queue` is `{ steering: ["a"], followUp: ["b", "c"] }` for a session
- **THEN** that session's card SHALL display a queue indicator with the count `3`

#### Scenario: Indicator hidden when queue empty
- **WHEN** `Session.queue` is `{ steering: [], followUp: [] }` for a session
- **THEN** no queue indicator SHALL be rendered on that session's card

### Requirement: Queue render cap with overflow indicator

The queue panel SHALL render at most 5 chips inline. If the total queue length exceeds 5, the panel SHALL render the first 5 chips and append a single "+N more" affordance where N is the remaining count. The "+N more" affordance is read-only in v1 (clicking it has no required action; expansion may be added later).

#### Scenario: Queue of 4 renders all 4 chips
- **WHEN** the total queue length is 4
- **THEN** the panel SHALL render 4 chips and SHALL NOT render a "+N more" affordance

#### Scenario: Queue of 8 renders 5 chips plus "+3 more"
- **WHEN** the total queue length is 8
- **THEN** the panel SHALL render the first 5 chips (in steering-then-followUp order) and a single "+3 more" affordance
