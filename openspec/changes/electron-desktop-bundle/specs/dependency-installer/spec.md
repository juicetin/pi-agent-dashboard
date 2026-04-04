## ADDED Requirements

### Requirement: Detect installed CLI tools
The dependency installer SHALL detect whether `pi` and `openspec` CLIs are available, checking system PATH first, then the managed install location.

#### Scenario: pi found on system PATH
- **WHEN** `detectPi()` is called and `pi` exists on system PATH
- **THEN** it SHALL return `{ found: true, path: "<system-path>", source: "system" }`

#### Scenario: pi found in managed install
- **WHEN** `detectPi()` is called and `pi` is not on PATH but exists at `~/.pi-dashboard/node_modules/.bin/pi`
- **THEN** it SHALL return `{ found: true, path: "<managed-path>", source: "managed" }`

#### Scenario: pi not found anywhere
- **WHEN** `detectPi()` is called and `pi` is not on PATH and not in managed install
- **THEN** it SHALL return `{ found: false }`

#### Scenario: openspec detection follows same pattern
- **WHEN** `detectOpenSpec()` is called
- **THEN** it SHALL follow the same detection order as `detectPi()` (system PATH → managed install)

### Requirement: Install missing CLI tools via npm
When a CLI tool is not found, the installer SHALL install it using npm into the managed location `~/.pi-dashboard/node_modules/`.

#### Scenario: Install pi when missing
- **WHEN** `installPi()` is called
- **THEN** it SHALL run `npm install @mariozechner/pi-coding-agent` in `~/.pi-dashboard/`
- **AND** use system npm if available, otherwise bundled npm

#### Scenario: Install openspec when missing
- **WHEN** `installOpenSpec()` is called
- **THEN** it SHALL run `npm install @fission-ai/openspec` in `~/.pi-dashboard/`

#### Scenario: Install uses system Node when available
- **WHEN** system Node.js (≥20.6) is detected on PATH
- **THEN** the installer SHALL use system `npm` for installation

#### Scenario: Install falls back to bundled Node
- **WHEN** no system Node.js is detected on PATH
- **THEN** the installer SHALL use the bundled Node.js and npm from extraResources

### Requirement: Managed install location
The managed install directory SHALL be `~/.pi-dashboard/` with a `package.json` initialized automatically.

#### Scenario: First install initializes directory
- **WHEN** `~/.pi-dashboard/` does not exist
- **THEN** the installer SHALL create it and write a minimal `package.json` before running npm install

#### Scenario: PATH includes managed bin
- **WHEN** the server or pi is spawned by the Electron app or bridge
- **THEN** `~/.pi-dashboard/node_modules/.bin` SHALL be prepended to the spawned process's PATH
