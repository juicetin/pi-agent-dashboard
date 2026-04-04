## MODIFIED Requirements

### Requirement: Bridge uses mDNS discovery for server connection
The bridge extension SHALL use mDNS browsing as the primary mechanism to discover the dashboard server, falling back to config-based port probe when mDNS is unavailable.

#### Scenario: Server found via mDNS
- **WHEN** the bridge extension starts and a `_pi-dashboard._tcp` service is advertised on localhost
- **THEN** the bridge SHALL connect to the discovered server's piPort

#### Scenario: mDNS times out — fallback to config
- **WHEN** mDNS browse returns no results within 2 seconds
- **THEN** the bridge SHALL fall back to probing `localhost:<config.piPort>` with `isDashboardRunning()`

#### Scenario: Auto-start with mDNS
- **WHEN** no server is found via mDNS or fallback and `autoStart` is `true`
- **THEN** the bridge SHALL launch the server as a detached process
- **AND** wait for the server's mDNS advertisement (up to 10 seconds) before connecting

### Requirement: Bridge augments PATH for managed installs
When the bridge extension spawns or connects to processes, it SHALL ensure `~/.pi-dashboard/node_modules/.bin` is on the PATH so managed-install tools are available.

#### Scenario: Managed openspec accessible
- **WHEN** openspec is installed in `~/.pi-dashboard/node_modules/` and the bridge calls `openspec` CLI
- **THEN** the call SHALL succeed because the managed bin directory is on PATH
