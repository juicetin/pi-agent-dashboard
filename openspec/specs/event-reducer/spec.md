## Purpose

Client-side state machine that converts a stream of `DashboardEvent` objects into `SessionState` for rendering the chat view. Pure function: `(state, event) → newState`.

## ADDED Requirements

### Requirement: Session state structure
The `SessionState` SHALL contain: `messages` (array of `ChatMessage`), `toolCalls` (Map of in-flight tool states), `streamingText` and `streamingThinking` (current assistant output), `isStreaming` (boolean), `model`, `thinkingLevel`, token counters (`tokensIn`, `tokensOut`, `cacheRead`, `cacheWrite`, `cost`), `currentTool`, `status`, `turnStats` (per-turn token breakdown array, max 50), `contextUsage`, and `pendingPrompt`.

### Requirement: User message rendering
A `message_start` event with role `"user"` SHALL create a new `ChatMessage` with `role: "user"`. Text content parts SHALL be concatenated. Image content parts SHALL be extracted into the `images` array.

#### Scenario: User sends text message
- **WHEN** a `message_start` event with `role: "user"` and text content arrives
- **THEN** a new user ChatMessage SHALL be added to `messages`

#### Scenario: User sends message with images
- **WHEN** a `message_start` event with image content parts arrives
- **THEN** the ChatMessage SHALL include the images in its `images` array

#### Scenario: Pending prompt cleared
- **WHEN** a `message_start` with `role: "user"` or `agent_start` arrives
- **THEN** `pendingPrompt` SHALL be cleared to `undefined`

### Requirement: Assistant message streaming
A `message_update` event SHALL accumulate assistant text into `streamingText` and thinking content into `streamingThinking`. A `message_end` event SHALL finalize the message, moving streaming content into a permanent `ChatMessage` and clearing streaming state.

#### Scenario: Streaming text accumulates
- **WHEN** successive `message_update` events arrive with text content
- **THEN** `streamingText` SHALL contain the full accumulated text

#### Scenario: Thinking content tracked separately
- **WHEN** a `message_update` contains a `thinking` content part
- **THEN** `streamingThinking` SHALL accumulate the thinking text

#### Scenario: Message finalized
- **WHEN** a `message_end` event arrives
- **THEN** a permanent assistant ChatMessage SHALL be added to `messages` and streaming state SHALL be cleared

### Requirement: Tool call state machine
A `tool_execution_start` event SHALL create a `ToolCallState` entry with `status: "running"`. A `tool_execution_end` event SHALL update the entry to `status: "complete"` (or `"error"` if `isError` is true) and store the result text.

#### Scenario: Tool starts running
- **WHEN** a `tool_execution_start` event arrives
- **THEN** a new ToolCallState SHALL be created with `status: "running"`, `toolName`, and `args`

#### Scenario: Tool completes successfully
- **WHEN** a `tool_execution_end` event arrives with `isError: false`
- **THEN** the ToolCallState SHALL update to `status: "complete"` with the result

#### Scenario: Tool completes with error
- **WHEN** a `tool_execution_end` event arrives with `isError: true`
- **THEN** the ToolCallState SHALL update to `status: "error"` with the error result

### Requirement: Stats accumulation
A `stats_update` event SHALL add per-turn token usage to the running totals and append a `TurnStat` entry (capped at 50 entries). If `contextUsage` is present, it SHALL update the session's context usage.

#### Scenario: Turn stats recorded
- **WHEN** a `stats_update` event with `turnUsage` arrives
- **THEN** a TurnStat SHALL be appended to `turnStats` and totals SHALL be incremented

#### Scenario: Turn stats capped
- **WHEN** `turnStats` exceeds 50 entries
- **THEN** the oldest entry SHALL be removed

### Requirement: Session compact handling
A `session_compact` event SHALL clear all messages and tool call state, resetting the chat view. This occurs when pi compacts the session history to reclaim context window space.

#### Scenario: Session compacted
- **WHEN** a `session_compact` event arrives
- **THEN** `messages` SHALL be cleared, `toolCalls` SHALL be cleared, and streaming state SHALL be reset

### Requirement: Full replay state reset
When an `event_replay` message is received whose first event has `seq === 1`, the reducer SHALL reset session state to `createInitialState()` before applying the replayed events. This prevents duplicate messages when re-subscribing to a previously-loaded session (e.g. switching back to a session card or reconnecting after a WebSocket drop).

#### Scenario: Full replay resets state
- **WHEN** an `event_replay` arrives with events starting at `seq: 1`
- **THEN** the session state SHALL be reset to `createInitialState()` before reducing the replayed events

#### Scenario: Incremental replay preserves state
- **WHEN** an `event_replay` arrives with events starting at a `seq > 1`
- **THEN** the existing session state SHALL be preserved and the new events SHALL be reduced on top of it

#### Scenario: Empty replay preserves state
- **WHEN** an `event_replay` arrives with an empty events array
- **THEN** the existing session state SHALL be preserved (no reset)

### Requirement: Model select handling
A `model_select` event SHALL update `model` and `thinkingLevel` on the session state.

#### Scenario: Model changed
- **WHEN** a `model_select` event arrives with `model: { provider: "anthropic", id: "claude-4" }`
- **THEN** `model` SHALL be set to `"anthropic/claude-4"`
## ADDED Requirements

### Requirement: Flow state tracked in SessionState
The `SessionState` SHALL include a `flowState` field of type `FlowState | null`. `FlowState` SHALL contain: `flowName`, `task`, `status` (running/success/error/aborted), `autonomousMode`, `agents` (ordered map of agent name → `FlowAgentState`), and `flowResult` (set on completion).

#### Scenario: Initial state has no flow
- **WHEN** `createInitialState()` is called
- **THEN** `flowState` SHALL be `null`

### Requirement: Reducer processes flow_started event
When a `flow_started` event is received, the reducer SHALL create a new `FlowState` with the flow name, task, status `"running"`, and pre-populated agent entries (from the `steps` array) in pending status with their `blockedBy` dependencies.

#### Scenario: Flow started creates flow state
- **WHEN** a `flow_started` event with `{ flowName: "research", task: "Find bugs", steps: [{id: "r", agent: "researcher", blockedBy: []}, {id: "d", agent: "developer", blockedBy: ["r"]}] }` is processed
- **THEN** `flowState` SHALL be set with `flowName: "research"`, two agents in pending status, and `developer` SHALL have `blockedBy: ["r"]`

### Requirement: Reducer processes flow_agent_started event
When a `flow_agent_started` event is received, the reducer SHALL update the agent's status to `"running"` and store the config metadata (label, model, card role).

#### Scenario: Agent starts running
- **WHEN** a `flow_agent_started` event with `{ agentName: "researcher", config: { model: "@research", card: { label: "Research" } } }` is processed
- **THEN** the agent's status SHALL be `"running"` and label SHALL be `"Research"`

### Requirement: Reducer processes flow_agent_complete event
When a `flow_agent_complete` event is received, the reducer SHALL update the agent's status to `"complete"` or `"error"` based on the result, and store tokens, duration, summary, and files.

#### Scenario: Agent completes successfully
- **WHEN** a `flow_agent_complete` event with `{ agentName: "researcher", result: { success: true, status: "complete", tokens: { input: 3000, output: 1000 }, duration: 12000 } }` is processed
- **THEN** the agent's status SHALL be `"complete"` with the token and duration values

### Requirement: Reducer processes flow tool call events
When `flow_tool_call` and `flow_tool_result` events are received, the reducer SHALL append them to the agent's `toolHistory` array and update the `recentTools` list (last 3 tool calls).

#### Scenario: Tool call recorded
- **WHEN** a `flow_tool_call` event with `{ agentName: "researcher", toolName: "read", input: { path: "src/foo.ts" } }` is processed
- **THEN** the agent's `toolHistory` SHALL include the entry and `recentTools` SHALL show "read · src/foo.ts"

### Requirement: Reducer processes flow_assistant_text and flow_thinking_text
When `flow_assistant_text` or `flow_thinking_text` events are received, the reducer SHALL append them to the agent's `detailHistory` array for display in the agent detail view.

#### Scenario: Assistant text recorded
- **WHEN** a `flow_assistant_text` event with `{ agentName: "researcher", text: "I found..." }` is processed
- **THEN** the agent's `detailHistory` SHALL include a text entry

### Requirement: Reducer processes flow_loop_iteration event
When a `flow_loop_iteration` event is received, the reducer SHALL update the target agent's `loopIteration` and `loopMax` values.

#### Scenario: Loop iteration tracked
- **WHEN** a `flow_loop_iteration` event with `{ loopTarget: "developer", iteration: 2, maxIterations: 3 }` is processed
- **THEN** the `developer` agent SHALL have `loopIteration: 2` and `loopMax: 3`

### Requirement: Reducer processes flow_complete event
When a `flow_complete` event is received, the reducer SHALL update `flowState.status` to the result status and store the `FlowResult` data for the summary view.

#### Scenario: Flow completes
- **WHEN** a `flow_complete` event with `{ status: "success", flowName: "research", results: {...} }` is processed
- **THEN** `flowState.status` SHALL be `"success"` and `flowState.flowResult` SHALL contain the results

### Requirement: message_end extracts content from message object during replay
When a `message_end` event fires and `streamingText` is empty (as happens during event replay for forked or resumed sessions), the reducer SHALL extract text content from `data.message.content` and create an assistant message. The reducer SHALL NOT fall through to the `turnSeparator` path when the message contains text content.

#### Scenario: Forked session replays last assistant message
- **WHEN** a forked session replays events including a `message_end` with assistant text content
- **AND** no prior `message_update` events populated `streamingText`
- **THEN** the assistant message text is extracted from `data.message.content`
- **AND** an assistant message bubble is rendered in the chat view

#### Scenario: Tool-only turn still shows separator
- **WHEN** a `message_end` fires with no `streamingText`
- **AND** `data.message.content` contains no text (tool-use-only turn)
- **AND** the last message was a `toolResult`
- **THEN** a `turnSeparator` is added (existing behavior preserved)

#### Scenario: Live streaming continues to use streamingText
- **WHEN** a `message_end` fires during live streaming
- **AND** `streamingText` has accumulated text from `message_update` events
- **THEN** the assistant message uses `streamingText` content (existing behavior unchanged)

### Requirement: Assistant content-array order preserved in chat
On every `message_end` event for an assistant message whose `message.content` array contains at least one block of type `toolCall`, the reducer SHALL ensure the rows in `messages[]` corresponding to this message's content blocks appear in the same order as the content array.

The matching rules are:
- A `text` block matches the `role:"assistant"` row pushed by the same `message_end` (the assistant text bubble).
- A `toolCall` block matches the `role:"toolResult"` row whose `toolCallId` equals the block's `id` (pushed by the corresponding `tool_execution_start`, which may have arrived before this `message_end`).
- A `thinking` block matches the `role:"thinking"` row pushed by the corresponding `thinking_end` for this message.
- A content block whose corresponding row is not present in `messages[]` at the time `message_end` fires is skipped — no synthetic row is created and no other row is moved on its behalf.

The reorder SHALL operate only on the suffix of `messages[]` containing rows for **this** assistant message; rows from prior or later messages SHALL NOT be touched. Any row in the affected suffix that is not matched by any content block SHALL **retain its original index** within the suffix (so that prior-message rows that happen to fall inside the K-sized window because the current message's content array is wider than the rows actually pushed do not migrate). Claimed rows fill the remaining suffix positions in content-array order.

The reorder SHALL be a no-op when `message.content` contains no `toolCall` blocks (text-only or tool-only messages skip the work).

#### Scenario: text-then-toolCall produces text bubble before tool card
- **GIVEN** an assistant message with `content: [{type:"text", text:"Now mark X:"}, {type:"toolCall", id:"t1", name:"edit"}]`
- **AND** the live event sequence emits `message_start`, `message_update` (text deltas), `tool_execution_start` (id=t1), `message_end`
- **WHEN** the reducer processes `message_end`
- **THEN** the trailing slice of `messages[]` for this message SHALL be `[assistant("Now mark X:"), toolResult(t1, running)]` — assistant text bubble first, tool card second

#### Scenario: multiple toolCalls preserve content-array order
- **GIVEN** an assistant message with `content: [{type:"text"}, {type:"toolCall", id:"t1"}, {type:"toolCall", id:"t2"}, {type:"toolCall", id:"t3"}]`
- **AND** `tool_execution_start` events for t1, t2, t3 arrive in any order (e.g. t3, t1, t2) before `message_end`
- **WHEN** `message_end` fires
- **THEN** the trailing slice SHALL be `[assistant, toolResult(t1), toolResult(t2), toolResult(t3)]`, matching content-array order regardless of `tool_execution_start` arrival order

#### Scenario: toolCall-then-text faithfully renders tool card before text
- **GIVEN** an assistant message with `content: [{type:"toolCall", id:"t1"}, {type:"text", text:"That's why I called it"}]` (rare; faithful to model output)
- **WHEN** `message_end` fires after `tool_execution_start` and the text deltas
- **THEN** the trailing slice SHALL be `[toolResult(t1, running), assistant("That's why I called it")]` — the reducer SHALL NOT hardcode text-first; it SHALL inherit the model's content-array order

#### Scenario: thinking block included in reorder
- **GIVEN** an assistant message with `content: [{type:"thinking"}, {type:"text"}, {type:"toolCall", id:"t1"}]`
- **AND** `thinking_end` has already pushed the thinking bubble before `message_end`
- **WHEN** `message_end` fires
- **THEN** the trailing slice SHALL be `[thinking, assistant, toolResult(t1)]`

#### Scenario: tool-only message is a no-op
- **GIVEN** an assistant message with `content: [{type:"toolCall", id:"t1"}]` and no text block
- **WHEN** `message_end` fires
- **THEN** the trailing slice SHALL be `[toolResult(t1, running)]` exactly as before this requirement was added — the reducer SHALL NOT push a phantom assistant bubble, SHALL NOT alter existing rows, and the reorder helper SHALL exit on the fast path

#### Scenario: text-only message is a no-op
- **GIVEN** an assistant message with `content: [{type:"text"}]` and no toolCall blocks
- **WHEN** `message_end` fires
- **THEN** the trailing slice SHALL be `[assistant("text")]` and the reorder helper SHALL NOT run (fast path skip when no toolCall blocks present)

#### Scenario: tool cards from prior messages are untouched
- **GIVEN** assistant message A with `[text, toolCall(t1)]` has fully landed in `messages[]` in correct order `[assistant_A, toolResult(t1)]`
- **AND** later, assistant message B with `[text, toolCall(t2)]` arrives
- **WHEN** B's `message_end` fires and triggers a reorder
- **THEN** rows for A (`assistant_A`, `toolResult(t1)`) SHALL remain at their original indices; only B's suffix is reordered

#### Scenario: tool_execution_start arriving after message_end
- **GIVEN** an assistant message whose `message_end` fires **before** any `tool_execution_start` (e.g. a synthetic replay path that emits message_end first)
- **WHEN** `message_end` fires
- **THEN** the reorder helper finds no `toolResult` row to relocate and is a no-op for the toolCall block; any prior-message rows that fall inside the K-sized suffix window SHALL retain their original indices (the unclaimed-row guard keeps a prior `user` / `assistant` / `toolResult` row at its original position rather than appending it at the tail)
- **AND WHEN** the subsequent `tool_execution_start` fires
- **THEN** the new tool card is pushed after the already-placed assistant bubble, preserving content-array order naturally

#### Scenario: empty streamingText with non-empty content text (fork/replay fallback)
- **GIVEN** an assistant message_end where `streamingText` is empty but `message.content[0]` is `{type:"text", text:"..."}` (the existing replay-text fallback at the assistant `message_end` arm)
- **AND** content also contains `{type:"toolCall", id:"t1"}`
- **WHEN** `message_end` fires and the fallback push lands the assistant bubble in `messages[]`
- **THEN** the reorder helper SHALL still run and produce `[..., assistant(replayText), toolResult(t1)]`

### Requirement: Live spinner immediacy preserved
The `tool_execution_start` reducer arm SHALL continue to push the `toolResult` row onto `messages[]` immediately, before the parent assistant `message_end` fires. The reorder at `message_end` SHALL relocate the row but SHALL NOT change its identity (`id` field) so React keyed reconciliation preserves the DOM node and avoids remount-flicker.

#### Scenario: Tool spinner visible during streaming
- **WHEN** `tool_execution_start` fires for a tool whose parent assistant message is still streaming text
- **THEN** the `toolResult` row appears in `messages[]` immediately with `toolStatus:"running"` so ChatView renders the spinner without waiting for `message_end`

#### Scenario: DOM node preserved across reorder
- **WHEN** the reorder at `message_end` relocates a `toolResult` row from index N to index N+1 (or later)
- **THEN** the row's `id` field remains `tool-${toolCallId}` so React's keyed reconciliation reuses the existing DOM node — the user sees the assistant text bubble appear **above** the running tool card without the tool card remounting or losing its spinner state
