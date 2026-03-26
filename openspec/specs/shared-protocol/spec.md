## ADDED Requirements

### Requirement: Load session events protocol messages
The shared protocol SHALL define new message types for on-demand session loading between server and bridge extension.

Server → Extension:
- `load_session_events`: request to load a session file and replay its events. Fields: `sessionId` (string), `sessionFile` (string).

Extension → Server:
- `load_session_events_result`: contains all loaded events for the requested session. Fields: `sessionId` (string), `events` (array of `{ eventType, timestamp, data }`).
- `load_session_events_error`: signals that loading failed. Fields: `sessionId` (string), `error` (string).

#### Scenario: Message type definitions
- **WHEN** the protocol types are compiled
- **THEN** `LoadSessionEventsMessage`, `LoadSessionEventsResultMessage`, and `LoadSessionEventsErrorMessage` SHALL be valid TypeScript interfaces with the specified fields

#### Scenario: Union type inclusion for server-to-extension
- **WHEN** `ServerToExtensionMessage` union is checked
- **THEN** it SHALL include `LoadSessionEventsMessage`

#### Scenario: Union type inclusion for extension-to-server
- **WHEN** `ExtensionToServerMessage` union is checked
- **THEN** it SHALL include `LoadSessionEventsResultMessage` and `LoadSessionEventsErrorMessage`

### Requirement: Session heartbeat protocol
The bridge extension SHALL send `session_heartbeat` messages at a fixed interval (15 seconds) to keep the session alive on the server. The server SHALL maintain a heartbeat timeout (45 seconds) per connected session. If no heartbeat is received within the timeout, the server SHALL unregister the session.

The server SHALL implement sleep-aware heartbeat detection: if the elapsed wall-clock time since the timer was set exceeds 2× the expected timeout (indicating system sleep/wake), the server SHALL grant one grace period (reset the timer) instead of immediately unregistering.

Extension → Server:
- `session_heartbeat`: keepalive signal. Fields: `sessionId` (string).

#### Scenario: Normal heartbeat
- **WHEN** the bridge sends heartbeats every 15 seconds
- **THEN** the server SHALL keep the session registered

#### Scenario: Heartbeat timeout
- **WHEN** no heartbeat is received for 45 seconds (and no sleep detected)
- **THEN** the server SHALL unregister the session

#### Scenario: Sleep-wake grace period
- **WHEN** the heartbeat timer fires after system wake (elapsed time > 2× timeout)
- **THEN** the server SHALL reset the timer once, giving the bridge time to reconnect

#### Scenario: Grace period exhausted
- **WHEN** the timer fires again after the grace period and still no heartbeat
- **THEN** the server SHALL unregister the session

### Requirement: Session data unavailability flag
The `DashboardSession` type SHALL include an optional `dataUnavailable` boolean field. When a browser subscribes to a session whose events cannot be loaded (no bridge available or load timeout), the server SHALL send a `session_updated` with `{ dataUnavailable: true }`.

#### Scenario: Data unavailable broadcast
- **WHEN** a browser subscribes to an evicted session and no bridge is available
- **THEN** the server SHALL send `session_updated` with `{ dataUnavailable: true }` so the browser can show an appropriate indicator

#### Scenario: Data unavailable on load timeout
- **WHEN** an on-demand load request times out after 10 seconds
- **THEN** the server SHALL send `session_updated` with `{ dataUnavailable: true }` to all waiting browsers

#### Scenario: Data becomes available
- **WHEN** a bridge connects and replays events for a previously unavailable session
- **THEN** the server SHALL send `session_updated` with `{ dataUnavailable: false }`

### Requirement: Attach proposal browser message
The browser→server protocol SHALL include an `attach_proposal` message type with fields `sessionId: string` and `changeName: string`.

#### Scenario: Attach proposal message sent
- **WHEN** the browser sends `{ type: "attach_proposal", sessionId: "s1", changeName: "add-auth" }`
- **THEN** the server SHALL process the attachment and broadcast a `session_updated` with `attachedProposal: "add-auth"`

### Requirement: Detach proposal browser message
The browser→server protocol SHALL include a `detach_proposal` message type with field `sessionId: string`.

#### Scenario: Detach proposal message sent
- **WHEN** the browser sends `{ type: "detach_proposal", sessionId: "s1" }`
- **THEN** the server SHALL process the detachment and broadcast a `session_updated` with `attachedProposal: null`

### Requirement: Bash output and command feedback event types
The `DashboardEvent` type SHALL accept `bash_output` and `command_feedback` as valid `eventType` values. These events flow through the existing `event_forward` (extension→server) and `event` (server→browser) message pipeline with no new message types required.

`bash_output` event data shape:
- `command`: string
- `output`: string
- `exitCode`: number
- `excludeFromContext`: boolean

`command_feedback` event data shape:
- `command`: string
- `status`: `"started"` | `"completed"` | `"error"`
- `message?`: string

#### Scenario: Bash output event flows through pipeline
- **WHEN** the extension sends an `event_forward` with a `bash_output` event
- **THEN** the server SHALL store it in the event buffer and forward it to subscribed browsers as an `event` message

#### Scenario: Command feedback event flows through pipeline
- **WHEN** the extension sends an `event_forward` with a `command_feedback` event
- **THEN** the server SHALL store it in the event buffer and forward it to subscribed browsers as an `event` message

### Requirement: Terminal session source type
The `SessionSource` type SHALL include `"terminal"` as a valid union member alongside existing values (`"interactive"`, `"headless"`, `"sdk"`).

#### Scenario: Terminal source type compiles
- **WHEN** the shared types are compiled
- **THEN** `SessionSource` SHALL accept `"terminal"` as a valid value
