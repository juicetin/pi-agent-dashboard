## ADDED Requirements

### Requirement: Pending prompt state
`SessionState` SHALL include a `pendingPrompt` field (`{ text: string; images?: ChatImage[] } | undefined`) that represents a prompt sent by the user but not yet confirmed by the server.

#### Scenario: Set pending prompt on send
- **WHEN** the user sends a prompt via the input
- **THEN** `pendingPrompt` SHALL be set with the sent text and any attached images

#### Scenario: Clear pending prompt on server confirmation
- **WHEN** a `message_start` event with role "user" is received by the reducer
- **THEN** `pendingPrompt` SHALL be cleared to `undefined`

#### Scenario: Clear pending prompt on agent start
- **WHEN** an `agent_start` event is received by the reducer
- **THEN** `pendingPrompt` SHALL be cleared to `undefined`

### Requirement: Optimistic user card rendering
When `pendingPrompt` exists **and its text is not present in `Session.queue.pending` (as `pending[i].text === pendingPrompt.text`)**, the chat view SHALL render an optimistic user message card at the bottom of the message list, styled identically to a normal user card but with an animated spinner icon. Once a `pendingPrompt`'s text appears in `Session.queue.pending`, the optimistic card SHALL be suppressed in favour of the queue chip rendered by the queue panel (per `mid-turn-prompt-queue`).

#### Scenario: Optimistic card appears immediately when not yet queued
- **WHEN** a prompt is sent and `pendingPrompt` is set
- **AND** the prompt text is not yet present in `Session.queue.pending`
- **THEN** an optimistic user card SHALL appear at the bottom of the chat with the prompt text and an `animate-spin` spinner icon

#### Scenario: Optimistic card shows images
- **WHEN** `pendingPrompt` includes images and is not yet observed in the queue
- **THEN** the optimistic card SHALL render image attachments the same as a normal user card

#### Scenario: Optimistic card replaced by server card
- **WHEN** the server's `message_start` (role: "user") event arrives
- **THEN** the optimistic card SHALL disappear and the server-sourced user card SHALL take its place

#### Scenario: Optimistic card replaced by queue chip
- **WHEN** `pendingPrompt.text` becomes present in `Session.queue.pending`
- **THEN** the optimistic card SHALL be hidden
- **AND** the queue panel SHALL render a chip for the queued message (per `mid-turn-prompt-queue`)
- **AND** when the bridge later drains the entry (its text leaves the queue and `message_start(user)` fires), the chip SHALL disappear via the next `queue_state` snapshot and the server-sourced user card SHALL render in the chat list

### Requirement: Input disabled during pending
The command input SHALL be disabled while `pendingPrompt` exists **and the agent is not streaming**, preventing duplicate sends. While the agent is streaming, the input SHALL remain enabled so the user can compose further messages that will join the bridge mid-turn queue (per `mid-turn-prompt-queue`).

#### Scenario: Input disabled after send when agent is idle
- **WHEN** the user sends a prompt while `Session.status` is not `streaming`
- **AND** `pendingPrompt` is set
- **THEN** the text input and send button SHALL be disabled

#### Scenario: Input remains enabled when agent is streaming
- **WHEN** the user sends a prompt while `Session.status` is `streaming`
- **AND** `pendingPrompt` is set
- **THEN** the text input and send button SHALL remain enabled
- **AND** the user SHALL be able to immediately type and submit additional prompts

#### Scenario: Input re-enabled after confirmation when previously disabled
- **WHEN** `pendingPrompt` was disabling the input (idle-send case)
- **AND** `pendingPrompt` is cleared (by server event or cancellation)
- **THEN** the text input and send button SHALL be re-enabled

### Requirement: Multiple in-flight pending prompts permitted while streaming
While the agent is streaming, the chat view MAY hold multiple `pendingPrompt`-like entries simultaneously, one per send that has not yet been observed in the queue or in the chat list. Only the most recent unobserved pending SHALL render as an optimistic card; earlier ones SHALL either be present in the queue (and rendered as chips) or, if neither in the queue nor in the chat list yet, MAY be temporarily invisible until either (a) the next `queue_state` update places them as a chip, (b) the chat receives `message_start(user)`, or (c) the safety timeout fires.

#### Scenario: Two rapid sends while streaming show one card and one chip
- **WHEN** the agent is streaming
- **AND** the user sends "first" and then immediately sends "second" before any `queue_state` update has arrived
- **THEN** at most one optimistic card SHALL be visible (the most recent send) and any prior pending whose text already appears in `Session.queue.pending` SHALL render only as a queue chip

### Requirement: Cancel pending prompt
The user SHALL be able to cancel a pending prompt, which removes the optimistic card, sends an abort to the bridge, and re-enables the input.

#### Scenario: Cancel via Stop button
- **WHEN** the user clicks the Stop button while `pendingPrompt` exists
- **THEN** `pendingPrompt` SHALL be cleared, the optimistic card SHALL be removed, an `abort` message SHALL be sent to the server, and the input SHALL be re-enabled

#### Scenario: Cancel via Escape key
- **WHEN** the user presses Escape while `pendingPrompt` exists and the input is focused
- **THEN** the same cancel behavior as the Stop button SHALL occur

### Requirement: Pending prompt survives client-side reset and replay
`pendingPrompt` SHALL NOT be cleared by `session_state_reset` or by the full-replay reset branch of `event_replay`. Only reducer event handlers (e.g. user `message_start`, `agent_start`), the safety timeout, and explicit user cancel SHALL clear `pendingPrompt`.

#### Scenario: session_state_reset preserves pendingPrompt
- **WHEN** the client receives `session_state_reset` for a session whose `SessionState.pendingPrompt` is set
- **THEN** the session's other state SHALL be reset to `createInitialState()`
- **AND** `pendingPrompt` SHALL be carried over unchanged into the new state

#### Scenario: event_replay full-reset preserves pendingPrompt
- **WHEN** the client receives `event_replay` with `shouldReset === true` for a session whose `SessionState.pendingPrompt` is set
- **THEN** the session's other state SHALL be reset to `createInitialState()` before applying the replayed events
- **AND** `pendingPrompt` SHALL be carried over unchanged into the new state, then the replayed events SHALL be reduced on top of it

#### Scenario: Auto-resume of ended session keeps the optimistic bubble visible
- **WHEN** the user sends a prompt to an ended session and the server triggers auto-resume (per `auto-resume-on-prompt`)
- **AND** the bridge re-registers, causing the server to broadcast `session_state_reset` and/or `event_replay`
- **THEN** the optimistic user-message bubble SHALL remain visible across the reset/replay
- **AND** the bubble SHALL only disappear when the bridge emits the corresponding user `message_start` event (or one of the existing clear paths fires)

#### Scenario: Reducer-driven clear paths still fire after replay
- **WHEN** `pendingPrompt` survives a reset/replay and the bridge subsequently emits the user `message_start` (or `agent_start`) event
- **THEN** the reducer SHALL clear `pendingPrompt` exactly as it does today

#### Scenario: Safety timeout still fires after replay
- **WHEN** `pendingPrompt` survives a reset/replay and 30 seconds elapse without confirmation
- **THEN** the existing `usePendingPromptTimeout` safety path SHALL clear `pendingPrompt` and surface the existing error
