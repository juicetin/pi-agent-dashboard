### Requirement: Known servers persisted in config
The system SHALL persist a list of known remote servers in the `knownServers` array in `config.json`. Each entry SHALL have `host` (string), `port` (number), `label` (optional string), and `addedAt` (ISO timestamp). Localhost SHALL always be implicitly available and not stored in the list.

#### Scenario: Empty known servers by default
- **WHEN** no `knownServers` field exists in config
- **THEN** the system SHALL treat it as an empty array
- **AND** localhost SHALL still be available as a server

#### Scenario: Known servers loaded at startup
- **WHEN** the config contains `knownServers` entries
- **THEN** the system SHALL include them in the server list alongside localhost

### Requirement: REST API to list known servers
The server SHALL expose `GET /api/known-servers` returning the current known servers list from config. Localhost is handled implicitly by the client.

#### Scenario: List with no known servers
- **WHEN** `GET /api/known-servers` is called and config has no `knownServers`
- **THEN** the response SHALL return `{ success: true, data: [] }`

#### Scenario: List with known servers
- **WHEN** `GET /api/known-servers` is called and config has entries
- **THEN** the response SHALL return `{ success: true, data: [...entries] }` with all fields

### Requirement: REST API to add a known server
The server SHALL expose `POST /api/known-servers` accepting `{ host, port, label? }` to add a server to the persisted list.

#### Scenario: Add a new server
- **WHEN** `POST /api/known-servers` is called with `{ host: "office-mac", port: 8000, label: "Office" }`
- **THEN** the server SHALL append the entry to `knownServers` in config with an `addedAt` timestamp
- **AND** return `{ success: true }`

#### Scenario: Add duplicate server
- **WHEN** `POST /api/known-servers` is called with a host:port that already exists in the list
- **THEN** the server SHALL update the label and return `{ success: true }`
- **AND** SHALL NOT create a duplicate entry

#### Scenario: Add with empty label
- **WHEN** `POST /api/known-servers` is called without a label
- **THEN** the server SHALL store the entry without a label field

### Requirement: REST API to remove a known server
The server SHALL expose `DELETE /api/known-servers` accepting `{ host, port }` to remove a server from the persisted list.

#### Scenario: Remove an existing server
- **WHEN** `DELETE /api/known-servers` is called with a matching host:port
- **THEN** the server SHALL remove the entry from config and return `{ success: true }`

#### Scenario: Remove non-existent server
- **WHEN** `DELETE /api/known-servers` is called with a host:port not in the list
- **THEN** the server SHALL return `{ success: true }` (idempotent)

### Requirement: REST API for on-demand mDNS scan
The server SHALL expose `POST /api/discover-servers` that returns currently discovered mDNS peers.

#### Scenario: Scan with peers available
- **WHEN** `POST /api/discover-servers` is called and mDNS has discovered peers
- **THEN** the response SHALL return `{ success: true, data: [...peers] }` with host, port, version, isLocal, pid fields

#### Scenario: Scan with no peers
- **WHEN** `POST /api/discover-servers` is called and no peers are discovered
- **THEN** the response SHALL return `{ success: true, data: [] }`

### Requirement: Settings panel known servers section
The Settings panel SHALL include a "Servers" section displaying all known servers with their label, host:port, and a remove button.

#### Scenario: Display known servers
- **WHEN** the user opens Settings
- **THEN** the Servers section SHALL show each known server with its label (or hostname if no label), host:port, and a remove (✕) button

#### Scenario: Remove a known server from UI
- **WHEN** the user clicks the remove button on a known server
- **THEN** the system SHALL call `DELETE /api/known-servers` and remove the entry from the displayed list

#### Scenario: Add server manually
- **WHEN** the user clicks "Add server" in the known servers section
- **THEN** an inline form SHALL appear with host, port, and label fields
- **AND** submitting SHALL call `POST /api/known-servers` and add the entry to the displayed list

### Requirement: Settings panel network discovery section
The Settings panel SHALL include a "Network Discovery" sub-section with a scan button and discovered server results.

#### Scenario: Trigger network scan
- **WHEN** the user clicks "Scan network"
- **THEN** the system SHALL call `POST /api/discover-servers` and display results

#### Scenario: Add discovered server with label
- **WHEN** the user clicks "Add" on a discovered server
- **THEN** a label input SHALL appear (pre-filled with the server's hostname)
- **AND** confirming SHALL call `POST /api/known-servers` with the host, port, and user-entered label

#### Scenario: Discovered server already known
- **WHEN** a discovered server's host:port matches an entry in known servers
- **THEN** it SHALL show as "Already added" instead of an "Add" button
