## ADDED Requirements

### Requirement: Persistent Node runtime under managed directory

The dashboard SHALL maintain a persistent Node.js runtime at `<managedDir>/node/` (where `<managedDir>` is `~/.pi-dashboard/`) that survives Electron app upgrades and standalone CLI reinstalls.

#### Scenario: Managed Node directory layout on Windows

- **WHEN** `installManagedNode(managedDir)` completes successfully on Windows
- **THEN** `<managedDir>/node/node.exe` SHALL exist
- **AND** `<managedDir>/node/npm.cmd` SHALL exist
- **AND** `<managedDir>/node/npx.cmd` SHALL exist
- **AND** `<managedDir>/node/node_modules/npm/bin/npm-cli.js` SHALL exist

#### Scenario: Managed Node directory layout on Unix

- **WHEN** `installManagedNode(managedDir)` completes successfully on macOS or Linux
- **THEN** `<managedDir>/node/bin/node` SHALL exist
- **AND** `<managedDir>/node/bin/npm` SHALL exist
- **AND** `<managedDir>/node/lib/node_modules/npm/bin/npm-cli.js` SHALL exist

#### Scenario: Managed Node persists across Electron upgrade

- **WHEN** the Electron app is upgraded to a new version that ships a different bundled Node
- **THEN** the existing `<managedDir>/node/` SHALL remain on disk untouched until the next explicit install or repair invocation

### Requirement: Idempotent installation from bundled source

`installManagedNode(managedDir)` SHALL copy the bundled Node runtime resolved via `getBundledNodePath()` (and its sibling `getBundledNpmPath()`) into `<managedDir>/node/`, and SHALL skip the copy when an existing managed Node already matches the bundled source's version.

#### Scenario: First-run copy

- **WHEN** `installManagedNode(managedDir)` is called and `<managedDir>/node/` does not exist
- **THEN** the entire bundled Node directory tree SHALL be copied to `<managedDir>/node/`
- **AND** a `<managedDir>/node/.version` marker file SHALL be written containing the bundled Node version string (e.g. `v22.12.0`)

#### Scenario: Re-run with matching version

- **WHEN** `installManagedNode(managedDir)` is called and `<managedDir>/node/.version` matches the bundled Node version
- **THEN** no copy SHALL be performed
- **AND** the function SHALL return without error

#### Scenario: Re-run with mismatched version

- **WHEN** `installManagedNode(managedDir)` is called and `<managedDir>/node/.version` does not match the bundled Node version (or the marker is missing while the directory exists)
- **THEN** the existing `<managedDir>/node/` SHALL be replaced with a fresh copy of the bundled Node tree
- **AND** the `.version` marker SHALL be rewritten to the bundled Node version

#### Scenario: No bundled source available

- **WHEN** `installManagedNode(managedDir)` is called and `getBundledNodePath()` returns `null` (standalone CLI install with no Electron resources)
- **THEN** the function SHALL return without error and without writing any files

#### Scenario: Failed copy leaves no version marker

- **WHEN** `installManagedNode(managedDir)` fails partway through the copy (e.g. disk-full, permission denied)
- **THEN** the `.version` marker SHALL NOT be written
- **AND** the next invocation SHALL treat the managed Node as missing and retry the copy

### Requirement: ToolRegistry resolves managed runtime first

`ToolRegistry.resolve("node")` and `ToolRegistry.resolve("npm")` SHALL prefer the managed runtime under `<managedDir>/node/` when present, while still allowing `tool-overrides.json` to take precedence.

#### Scenario: Managed Node preferred over PATH

- **WHEN** `<managedDir>/node/node.exe` (Windows) or `<managedDir>/node/bin/node` (Unix) exists
- **AND** no override exists for `node` in `tool-overrides.json`
- **THEN** `ToolRegistry.resolve("node")` SHALL return the managed-runtime path
- **AND** the resolution SHALL NOT fall through to `where`/PATH lookup

#### Scenario: Override still wins over managed runtime

- **WHEN** `tool-overrides.json` declares `{ "node": "/custom/path/node" }`
- **AND** `<managedDir>/node/bin/node` also exists
- **THEN** `ToolRegistry.resolve("node")` SHALL return `/custom/path/node`

#### Scenario: Standalone fallback when managed is absent

- **WHEN** `<managedDir>/node/` does not exist
- **AND** no override exists for `node`
- **THEN** `ToolRegistry.resolve("node")` SHALL fall through to the existing `where`/PATH-based strategy chain

### Requirement: Spawned children inherit managed Node on PATH

The shared helper `prependManagedNodeToPath(env)` SHALL return a shallow-cloned environment object with the managed Node directory prepended to the `PATH` variable, and the dashboard SHALL apply it to every child process spawn it controls.

#### Scenario: Pi session spawn inherits managed Node

- **WHEN** the dashboard spawns a new pi session via `process-manager.ts`
- **AND** `<managedDir>/node/` exists on Windows
- **THEN** the spawned process's `PATH` SHALL contain `<managedDir>/node` as its first entry
- **AND** invoking `npm --version` inside that process SHALL resolve to `<managedDir>/node/npm.cmd`

#### Scenario: Pi session spawn on Unix

- **WHEN** the dashboard spawns a new pi session via `process-manager.ts`
- **AND** `<managedDir>/node/bin/` exists on macOS or Linux
- **THEN** the spawned process's `PATH` SHALL contain `<managedDir>/node/bin` as its first entry

#### Scenario: pi-core-updater inherits managed Node

- **WHEN** `pi-core-updater.ts` spawns `npm update <pkg>` for a managed-source package
- **AND** `<managedDir>/node/` exists
- **THEN** the spawned `npm` process's `PATH` SHALL contain the managed Node directory as its first entry

#### Scenario: PATH injection is a no-op without managed runtime

- **WHEN** `prependManagedNodeToPath(env)` is called and `<managedDir>/node/` does not exist
- **THEN** the returned environment SHALL be a shallow clone of `env` with `PATH` unchanged

#### Scenario: Process environment is not globally mutated

- **WHEN** `prependManagedNodeToPath(env)` is called
- **THEN** the function SHALL NOT mutate `process.env` of the dashboard server itself
- **AND** the returned object SHALL be a distinct env object suitable for passing to `spawn(..., { env })`

### Requirement: Doctor re-runs managed Node installation

The Doctor diagnostic and `pi-dashboard repair` SHALL invoke `installManagedNode(managedDir)` as part of their checks so that a missing or version-mismatched managed Node is restored.

#### Scenario: Doctor restores missing managed Node

- **WHEN** the user runs Doctor and `<managedDir>/node/` is missing on a system with bundled resources
- **THEN** Doctor SHALL invoke `installManagedNode(managedDir)`
- **AND** `<managedDir>/node/` SHALL exist with a valid `.version` marker after Doctor completes

#### Scenario: Doctor re-copies on version mismatch

- **WHEN** the user runs Doctor and `<managedDir>/node/.version` does not match the bundled Node version
- **THEN** Doctor SHALL re-copy the bundled Node tree into `<managedDir>/node/`
- **AND** the `.version` marker SHALL be updated to the bundled Node version

#### Scenario: Doctor is a no-op when managed Node matches bundled

- **WHEN** the user runs Doctor and `<managedDir>/node/.version` already matches the bundled Node version
- **THEN** Doctor SHALL NOT re-copy any files
- **AND** the existing managed Node directory SHALL remain unchanged
