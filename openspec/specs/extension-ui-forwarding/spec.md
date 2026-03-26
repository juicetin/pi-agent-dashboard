## ADDED Requirements

### Requirement: Extension UI event protocol
The shared protocol SHALL define an `extension_ui_event` message type for forwarding extension UI interactions from the bridge to the dashboard. The message SHALL contain `sessionId` and a `uiEvent` object with `method`, `title`, and optional fields (`message`, `options`, `result`, `status`).

#### Scenario: Extension UI event forwarded
- **WHEN** the bridge sends an `extension_ui_event` to the server
- **THEN** the server SHALL relay it to all browser subscribers for that session

### Requirement: Dashboard rendering of extension UI events
The chat view SHALL render extension UI events inline in the conversation at the point they occurred. They SHALL be displayed as distinct UI elements using the `ExtensionUI` component:

- **confirm**: Shows title with result indicator (✅ Allowed / ❌ Denied / ⏳ Pending)

#### Scenario: Pending dialog display
- **WHEN** an extension UI event with `result === undefined` arrives
- **THEN** the chat view SHALL show it with a spinning loading indicator

#### Scenario: Resolved confirm dialog
- **WHEN** an extension UI event with `method: "confirm"` and `result: true` arrives
- **THEN** the chat view SHALL show "Allowed" with a green checkmark icon

#### Scenario: Denied confirm dialog
- **WHEN** an extension UI event with `method: "confirm"` and `result: false` arrives
- **THEN** the chat view SHALL show "Denied" with a red X icon

**Note**: The bridge does not currently subscribe to `tool_call` events or listen on a `pi.events` bus. Extension UI events reach the dashboard only if explicitly sent by the bridge or a future extension integration. The protocol and rendering are defined and functional; the active detection mechanism is deferred.
