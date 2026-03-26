## MODIFIED Requirements

### Requirement: Pi package format
The project SHALL be distributed as a pi package installable via `pi install` under the `@blackbelt-technology/pi-dashboard` npm scope. The `package.json` SHALL declare the bridge extension under the `pi.extensions` key so it auto-loads in all pi sessions after installation.

#### Scenario: Install via pi
- **WHEN** a user runs `pi install npm:@blackbelt-technology/pi-dashboard`
- **THEN** the bridge extension SHALL be registered globally and load in all subsequent pi sessions

#### Scenario: Extension auto-loads
- **WHEN** pi starts after the package is installed
- **THEN** the bridge extension SHALL load automatically and attempt to connect to the dashboard server

#### Scenario: Uninstall via pi
- **WHEN** a user runs `pi remove npm:@blackbelt-technology/pi-dashboard`
- **THEN** the bridge extension SHALL no longer load in pi sessions

### Requirement: Dashboard server CLI
The package SHALL provide a `pi-dashboard` CLI command (via `bin` in package.json) for starting the dashboard server. The CLI SHALL accept subcommands (`start`, `stop`, `restart`, `status`) and flags (`--port`, `--pi-port`, `--dev`, `--no-tunnel`). Precedence: CLI flags → environment variables (`PI_DASHBOARD_PORT`, `PI_DASHBOARD_PI_PORT`) → config file defaults.

#### Scenario: Start server
- **WHEN** a user runs `pi-dashboard`
- **THEN** the server SHALL start in the foreground on default ports (8000 for HTTP, 9999 for Pi Gateway) and print the URL

#### Scenario: Custom ports
- **WHEN** a user runs `pi-dashboard --port 3000 --pi-port 3001`
- **THEN** the server SHALL start on the specified ports

#### Scenario: Development mode
- **WHEN** a developer runs `pi-dashboard --dev`
- **THEN** the server SHALL skip serving static files (expects Vite dev server running separately)

#### Scenario: Disable tunnel
- **WHEN** a user runs `pi-dashboard --no-tunnel`
- **THEN** the server SHALL not create a zrok tunnel even if `tunnel.enabled` is `true` in config

### Requirement: Runtime dependency on tsx
The package SHALL declare `tsx` as a production dependency so the TypeScript server CLI and extension code can execute without a build step when installed via npm.

#### Scenario: Server CLI works after npm install
- **WHEN** the package is installed via `npm install @blackbelt-technology/pi-dashboard`
- **THEN** the `pi-dashboard` binary SHALL execute successfully using the tsx loader
