## ADDED Requirements

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

### Requirement: Bundled web client
The web client SHALL be built with Vite and the production output SHALL be bundled into the npm package as static files. The dashboard server SHALL serve these files without requiring a separate build step.

#### Scenario: Serve bundled client
- **WHEN** the dashboard server starts from an installed package (non-dev mode)
- **THEN** it SHALL serve the pre-built web client from `dist/client/` using `@fastify/static`

#### Scenario: SPA fallback
- **WHEN** a GET request is made to a path that does not match a static file, `/api/*`, or `/ws`
- **THEN** the server SHALL return `index.html` to support client-side routing

### Requirement: Configuration file
The dashboard server SHALL support a configuration file at `~/.pi/dashboard/config.json` for persistent settings. See the `shared-config` spec for the full schema.

#### Scenario: Config file created on first run
- **WHEN** the server starts and no config file exists
- **THEN** it SHALL create `~/.pi/dashboard/config.json` with default values

#### Scenario: CLI overrides config file
- **WHEN** the config file sets `port: 3000` and the CLI passes `--port 4000`
- **THEN** the server SHALL use port 4000 (CLI wins)

### Requirement: Peer dependencies
The package SHALL declare `@mariozechner/pi-coding-agent` as a peer dependency so that the bridge extension resolves core packages from the host runtime's installation.

#### Scenario: Installed under pi
- **WHEN** the package is installed as a pi package via `pi install`
- **THEN** `@mariozechner/pi-coding-agent` satisfies the peer dependency

### Requirement: Architecture documentation
The project SHALL maintain a `docs/architecture.md` file that describes the system architecture, data flow, protocol, and component interactions. This file SHALL be updated with every significant change per the project's code instructions.

#### Scenario: Architecture doc exists
- **WHEN** the project is initialized
- **THEN** a `docs/architecture.md` file SHALL exist describing the three-component architecture (extension, server, client), the protocol, and the data model
