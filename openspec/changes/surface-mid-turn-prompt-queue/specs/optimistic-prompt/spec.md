## MODIFIED Requirements

### Requirement: Input disabled during pending
The command input SHALL be disabled while `pendingPrompt` exists **and the agent is not streaming**, preventing duplicate sends. While the agent is streaming, the input SHALL remain enabled so the user can compose further messages that will join the mid-turn queue (per `mid-turn-prompt-queue`).

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

### Requirement: Optimistic user card rendering
When `pendingPrompt` exists **and its text is not present in `Session.queue.steering` or `Session.queue.followUp`**, the chat view SHALL render an optimistic user message card at the bottom of the message list, styled identically to a normal user card but with an animated spinner icon. Once a `pendingPrompt`'s text appears in the queue, the optimistic card SHALL be suppressed in favour of the queue chip rendered by the queue panel (per `mid-turn-prompt-queue`).

#### Scenario: Optimistic card appears immediately when not yet queued
- **WHEN** a prompt is sent and `pendingPrompt` is set
- **AND** the prompt text is not yet present in `Session.queue.steering` or `Session.queue.followUp`
- **THEN** an optimistic user card SHALL appear at the bottom of the chat with the prompt text and an `animate-spin` spinner icon

#### Scenario: Optimistic card shows images
- **WHEN** `pendingPrompt` includes images and is not yet observed in the queue
- **THEN** the optimistic card SHALL render image attachments the same as a normal user card

#### Scenario: Optimistic card replaced by server card
- **WHEN** the server's `message_start` (role: "user") event arrives
- **THEN** the optimistic card SHALL disappear and the server-sourced user card SHALL take its place

#### Scenario: Optimistic card replaced by queue chip
- **WHEN** `pendingPrompt.text` becomes present in `Session.queue.steering` or `Session.queue.followUp`
- **THEN** the optimistic card SHALL be hidden
- **AND** the queue panel SHALL render a chip for the queued message (per `mid-turn-prompt-queue`)
- **AND** when the message later begins running (its text leaves the queue and `message_start(user)` fires), the chip SHALL disappear via the queue update and the server-sourced user card SHALL render in the chat list

## ADDED Requirements

### Requirement: Multiple in-flight pending prompts permitted while streaming
While the agent is streaming, the chat view MAY hold multiple `pendingPrompt`-like entries simultaneously, one per send that has not yet been observed in the queue or in the chat list. Only the most recent unobserved pending SHALL render as an optimistic card; earlier ones SHALL either be present in the queue (and rendered as chips) or, if neither in the queue nor in the chat list yet, MAY be temporarily invisible until either (a) the queue update places them as a chip, (b) the chat receives `message_start(user)`, or (c) the safety timeout fires.

#### Scenario: Two rapid sends while streaming show one card and one chip
- **WHEN** the agent is streaming
- **AND** the user sends "first" and then immediately sends "second" before any `queue_state` update has arrived
- **THEN** at most one optimistic card SHALL be visible (the most recent send) and any prior pending whose text already appears in `queue.steering`/`followUp` SHALL render only as a queue chip
