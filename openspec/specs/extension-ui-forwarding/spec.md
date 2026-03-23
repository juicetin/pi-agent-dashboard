## ADDED Requirements

### Requirement: Detect extension UI interactions via tool_call hook
The bridge extension SHALL subscribe to `tool_call` events. When a tool call is blocked (handler returns `{ block: true, reason }`), the extension SHALL infer that an extension UI interaction occurred and forward the interaction info to the dashboard.

#### Scenario: Tool call blocked by permission gate
- **WHEN** a `tool_call` event returns `{ block: true, reason: "Blocked by user" }`
- **THEN** the bridge extension SHALL forward an `extension_ui_event` with method "confirm", title derived from the tool call context, and result "blocked"

#### Scenario: Tool call allowed after confirmation
- **WHEN** a `tool_call` event fires and is NOT blocked (handler returns undefined or continues)
- **THEN** the bridge extension SHALL NOT forward any extension UI event (normal tool calls are already captured via tool_execution events)

### Requirement: Extension UI events via pi.events bus
The bridge extension SHALL listen on the shared `pi.events` bus for events prefixed with `dashboard:ui`. Other extensions owned by the user MAY broadcast their UI interactions to this channel for dashboard visibility.

Event format: `pi.events.emit("dashboard:ui", { method, title, message?, options?, result?, status })`

#### Scenario: Extension broadcasts confirm dialog
- **WHEN** a user's extension emits `pi.events.emit("dashboard:ui", { method: "confirm", title: "Delete old files?", status: "pending" })`
- **THEN** the bridge extension SHALL forward this as an `extension_ui_event` to the dashboard server

#### Scenario: Extension broadcasts dialog result
- **WHEN** a user's extension emits `pi.events.emit("dashboard:ui", { method: "confirm", title: "Delete old files?", status: "resolved", result: true })`
- **THEN** the bridge extension SHALL forward the result, and the dashboard SHALL update the displayed dialog

### Requirement: Dashboard rendering of extension UI events
The chat view SHALL render extension UI events inline in the conversation at the point they occurred. They SHALL be displayed as distinct UI elements:

- **confirm**: "🔒 Confirm: {title}" with result shown (✅ Allowed / ❌ Blocked / ⏳ Pending)
- **select**: "📋 Select: {title}" with selected option shown
- **input**: "✏️ Input: {title}" with entered value shown
- **notify**: "ℹ️ {message}" with appropriate color for type (info/warning/error)

#### Scenario: Pending dialog display
- **WHEN** an extension UI event with status "pending" arrives
- **THEN** the chat view SHALL show it with a ⏳ pending indicator

#### Scenario: Resolved dialog display
- **WHEN** an extension UI event with status "resolved" arrives (or an update to a pending one)
- **THEN** the chat view SHALL show the result (e.g., "✅ Allowed" for a confirmed dialog)

#### Scenario: Notification display
- **WHEN** an extension UI event with method "notify" arrives
- **THEN** it SHALL be displayed as a small inline notification with appropriate styling (blue for info, yellow for warning, red for error)
