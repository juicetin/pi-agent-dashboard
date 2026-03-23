## ADDED Requirements

### Requirement: Pi package format
The project SHALL be distributed as a pi package installable via `pi install`. The `package.json` SHALL declare the bridge extension under the `pi.extensions` key so it auto-loads in all pi sessions after installation.

#### Scenario: Install via pi
- **WHEN** a user runs `pi install npm:@user/pi-dashboard`
- **THEN** the bridge extension SHALL be registered globally and load in all subsequent pi sessions

#### Scenario: Extension auto-loads
- **WHEN** pi starts after the package is installed
- **THEN** the bridge extension SHALL load automatically and attempt to connect to the dashboard server

#### Scenario: Uninstall via pi
- **WHEN** a user runs `pi remove npm:@user/pi-dashboard`
- **THEN** the bridge extension SHALL no longer load in pi sessions

### Requirement: Dashboard server CLI
The package SHALL provide a `pi-dashboard` CLI command (via `bin` in package.json) for starting the dashboard server.

#### Scenario: Start server
- **WHEN** a user runs `pi-dashboard`
- **THEN** the server SHALL start on default ports (8000 for HTTP, 9999 for Pi Gateway) and print the URL

#### Scenario: Custom ports
- **WHEN** a user runs `pi-dashboard --port 3000 --pi-port 3001`
- **THEN** the server SHALL start on the specified ports

#### Scenario: Help output
- **WHEN** a user runs `pi-dashboard --help`
- **THEN** the CLI SHALL display available options with descriptions

### Requirement: Bundled web client
The web client SHALL be built with Vite and the production output SHALL be bundled into the npm package as static files. The dashboard server SHALL serve these files without requiring a separate build step.

#### Scenario: Serve bundled client
- **WHEN** the dashboard server starts from an installed package
- **THEN** it SHALL serve the pre-built web client from the bundled static files directory

#### Scenario: Development mode
- **WHEN** a developer runs the server with `--dev`
- **THEN** it SHALL proxy requests to a Vite dev server (default `localhost:5173`) for hot module replacement

### Requirement: Configuration file
The dashboard server SHALL support a configuration file at `~/.pi/dashboard/config.json` for persistent settings.

Configurable options:
- `httpPort`: HTTP and browser WebSocket port (default: 8000)
- `piGatewayPort`: Pi extension WebSocket port (default: 9999)
- `dbPath`: SQLite database path (default: `~/.pi/dashboard/dashboard.db`)
- `retentionDays`: Event retention period in days (default: 30)

#### Scenario: Config file created on first run
- **WHEN** the server starts and no config file exists
- **THEN** it SHALL create `~/.pi/dashboard/config.json` with default values

#### Scenario: CLI overrides config file
- **WHEN** the config file sets `httpPort: 3000` and the CLI passes `--port 4000`
- **THEN** the server SHALL use port 4000 (CLI wins)

### Requirement: Peer dependencies for dual runtime compatibility
The package SHALL declare peer dependencies for both `@mariozechner/*` and `@oh-my-pi/*` package scopes with `"*"` range. All peer dependencies SHALL be optional via `peerDependenciesMeta` so that only one runtime needs to be present.

Peer dependencies: `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`, `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-tui`, `@sinclair/typebox`.

Runtime dependencies (React, sql.js, ws, etc.) SHALL be in `dependencies`.

#### Scenario: Installed under pi (@mariozechner)
- **WHEN** the package is installed as a pi package via `pi install`
- **THEN** `@mariozechner/pi-coding-agent` satisfies the peer dependency and no warnings are shown for missing `@oh-my-pi/*` packages

#### Scenario: Installed under Oh My Pi (@oh-my-pi)
- **WHEN** the package is installed as an Oh My Pi package
- **THEN** `@oh-my-pi/pi-coding-agent` satisfies the peer dependency and no warnings are shown for missing `@mariozechner/*` packages

#### Scenario: Peer dependency resolution
- **WHEN** the package is installed via pi or Oh My Pi
- **THEN** core packages SHALL be resolved from the host runtime's installation, not bundled

### Requirement: Service templates
The package SHALL include optional service templates for running the dashboard server as a background daemon:
- `systemd/pi-dashboard.service` for Linux
- `launchd/ai.pi.dashboard.plist` for macOS

#### Scenario: Linux systemd setup
- **WHEN** a user runs `pi-dashboard --install-service`
- **THEN** the CLI SHALL copy the systemd unit file to `~/.config/systemd/user/` and print instructions to enable it

#### Scenario: macOS launchd setup
- **WHEN** a user runs `pi-dashboard --install-service` on macOS
- **THEN** the CLI SHALL copy the plist file to `~/Library/LaunchAgents/` and print instructions to load it

### Requirement: Architecture documentation
The project SHALL maintain a `docs/architecture.md` file that describes the system architecture, data flow, protocol, and component interactions. This file SHALL be updated with every significant change per the project's code instructions.

#### Scenario: Architecture doc exists
- **WHEN** the project is initialized
- **THEN** a `docs/architecture.md` file SHALL exist describing the three-component architecture (extension, server, client), the protocol, and the data model
