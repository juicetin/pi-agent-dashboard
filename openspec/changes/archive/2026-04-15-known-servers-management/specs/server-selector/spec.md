## MODIFIED Requirements

### Requirement: Server selector in dashboard header
The dashboard header SHALL include a server selector dropdown showing known servers (persisted) plus localhost, instead of mDNS-discovered servers.

#### Scenario: Single localhost server (default)
- **WHEN** no known servers are configured
- **THEN** the selector SHALL show localhost with a green connected indicator

#### Scenario: Known servers displayed
- **WHEN** the config contains known servers
- **THEN** the dropdown SHALL list localhost first, then known servers with their label, host:port, and a "Local" or "Remote" badge

#### Scenario: Manage servers shortcut
- **WHEN** the dropdown is open
- **THEN** a "Manage servers…" button SHALL appear at the top
- **AND** clicking it SHALL navigate to the Servers tab in Settings (`/settings?tab=servers`)

#### Scenario: Availability probing
- **WHEN** the dropdown is opened
- **THEN** each non-current server SHALL be probed via health check
- **AND** show "Available" or "Unreachable" status

### Requirement: Server switching
Selecting a different server in the dropdown SHALL re-establish the WebSocket connection and reload session data from the new server.

#### Scenario: Switch to remote server
- **WHEN** the user selects a remote server from the dropdown
- **THEN** the dashboard SHALL close the current WebSocket connection
- **AND** open a new WebSocket to the selected server's address
- **AND** re-subscribe to sessions from the new server

#### Scenario: Switch back to localhost
- **WHEN** the user selects the localhost server after being connected to a remote server
- **THEN** the dashboard SHALL reconnect to localhost and reload session data

#### Scenario: Selected server becomes unreachable
- **WHEN** the currently connected server becomes unreachable
- **THEN** the selector SHALL show a disconnected indicator
- **AND** the dashboard SHALL attempt reconnection with existing backoff logic

### Requirement: Persist last-used server
The last-used server address SHALL be persisted so the dashboard reconnects to it on next launch.

#### Scenario: Client persists in localStorage
- **WHEN** the user switches to a server
- **THEN** the server address SHALL be saved in `localStorage` under `pi-dashboard-last-server`

#### Scenario: Client reconnects to last-used server
- **WHEN** the dashboard loads and `localStorage` has a saved server address
- **THEN** the dashboard SHALL attempt to connect to the saved server first
- **AND** fall back to localhost discovery if the saved server is unreachable

### Requirement: Server discovery via WebSocket message
The server SHALL broadcast discovered peer servers to connected browsers for the network discovery UI in Settings, not for the header dropdown.

#### Scenario: Server sends peer list
- **WHEN** a browser connects to the dashboard server
- **THEN** the server SHALL send a `servers_discovered` message with mDNS-discovered peers

#### Scenario: Server sends peer update
- **WHEN** a new peer server appears or disappears on the network
- **THEN** the server SHALL broadcast a `servers_updated` message to all connected browsers
