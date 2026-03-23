## ADDED Requirements

### Requirement: Responsive layout breakpoints
The web client SHALL adapt its layout based on viewport width:
- **Desktop** (≥ 1024px): workspace bar (top) + session sidebar (left, 280px) + chat view (remaining)
- **Tablet** (768px–1023px): workspace dropdown (top) + session sidebar (left, 240px) + chat view
- **Mobile** (< 768px): workspace dropdown (top) + session drawer (hidden, swipe/hamburger) + chat view (full width)

#### Scenario: Desktop layout
- **WHEN** the viewport is 1200px wide
- **THEN** the workspace bar, sidebar, and chat view SHALL all be visible simultaneously

#### Scenario: Mobile layout
- **WHEN** the viewport is 375px wide
- **THEN** only the workspace dropdown and chat view SHALL be visible; sidebar accessible via hamburger menu

### Requirement: Workspace dropdown on mobile
On tablet and mobile viewports, the workspace bar SHALL collapse into a dropdown selector instead of tabs.

#### Scenario: Workspace selection on mobile
- **WHEN** a user taps the workspace dropdown on mobile
- **THEN** a dropdown menu SHALL appear listing all workspaces with active session counts

### Requirement: Tool calls collapsed on mobile
On mobile viewports, all tool call steps SHALL be collapsed by default with no exception. Tapping SHALL expand them (with lazy-loaded content).

#### Scenario: Tool call on mobile
- **WHEN** a tool call is rendered on a mobile viewport
- **THEN** it SHALL show only the one-line summary with a tap-to-expand affordance

### Requirement: Code block horizontal scroll
Code blocks SHALL use horizontal scrolling instead of line wrapping, with a visible scrollbar on touch devices.

#### Scenario: Wide code on mobile
- **WHEN** a code block contains lines wider than the viewport
- **THEN** the code SHALL scroll horizontally with a visible scrollbar

### Requirement: WebSocket auto-reconnect
The browser client SHALL automatically reconnect to the dashboard server with exponential backoff when the WebSocket connection drops. Backoff schedule: 1s, 2s, 4s, 8s, 16s, max 30s. Reset to 1s on successful connection.

#### Scenario: Connection lost
- **WHEN** the WebSocket connection drops
- **THEN** the client SHALL show a "Reconnecting..." indicator and attempt reconnection with backoff

#### Scenario: Successful reconnect
- **WHEN** the client reconnects to the server
- **THEN** it SHALL re-subscribe to all previously subscribed sessions with their last known sequence numbers, and the server SHALL replay missed events

#### Scenario: Max backoff
- **WHEN** reconnection has failed 5+ times
- **THEN** the backoff SHALL cap at 30 seconds and the client SHALL show "Connection lost. Retrying every 30s..."

### Requirement: Connection status indicator
The web client SHALL display a connection status indicator visible at all times:
- 🟢 "Connected" (normal state, subtle/hidden)
- 🟡 "Reconnecting..." (during backoff, with countdown)
- 🔴 "Disconnected" (after extended failure, with manual retry button)

#### Scenario: Show reconnecting state
- **WHEN** the WebSocket disconnects
- **THEN** the indicator SHALL show "🟡 Reconnecting..." within 1 second

#### Scenario: Manual retry
- **WHEN** the indicator shows "Disconnected" and the user clicks retry
- **THEN** the client SHALL immediately attempt reconnection (reset backoff)

### Requirement: Offline outgoing message queue
When the WebSocket is disconnected, the browser SHALL queue outgoing messages (prompts, commands) and deliver them when the connection is restored.

#### Scenario: Send while disconnected
- **WHEN** a user sends a message while the WebSocket is disconnected
- **THEN** the message SHALL be queued locally and a "Will send when connected" indicator SHALL appear

#### Scenario: Queue delivery on reconnect
- **WHEN** the WebSocket reconnects and there are queued messages
- **THEN** the queued messages SHALL be sent in order immediately after the connection is established

#### Scenario: Queue limit
- **WHEN** more than 10 messages are queued while disconnected
- **THEN** the input SHALL disable and show "Too many queued messages. Please wait for connection."

### Requirement: Touch-friendly interactions
All interactive elements SHALL meet minimum touch target sizes (44×44px) on mobile viewports. This includes: session list items, tool call expand/collapse buttons, autocomplete dropdown items, send button, workspace selector items.

#### Scenario: Session list item touch target
- **WHEN** a session list item is rendered on mobile
- **THEN** it SHALL have a minimum height of 44px and be tappable across its full width
