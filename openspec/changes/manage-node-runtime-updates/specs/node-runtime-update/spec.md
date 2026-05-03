## ADDED Requirements

### Requirement: Source classification of Node runtime

The dashboard SHALL classify the currently-running Node runtime as exactly one of `"managed"`, `"system"`, or `"bundled-electron"` via a pure helper `classifyNodeSource(nodePath)` that compares `realpathSync(nodePath)` against the managed and Electron-bundled directories.

#### Scenario: Managed runtime classified

- **WHEN** `classifyNodeSource(nodePath)` is called with a path that resolves under `<managedDir>/node/`
- **THEN** the function SHALL return `"managed"`

#### Scenario: Bundled-Electron runtime classified

- **WHEN** `classifyNodeSource(nodePath)` is called with a path that resolves under `process.resourcesPath/node/`
- **AND** `process.resourcesPath` is defined
- **THEN** the function SHALL return `"bundled-electron"`

#### Scenario: System runtime classified

- **WHEN** `classifyNodeSource(nodePath)` is called with a path that resolves outside both managed and Electron-bundled directories
- **THEN** the function SHALL return `"system"`

#### Scenario: Unknown / unresolvable path treated as system

- **WHEN** `classifyNodeSource(nodePath)` is called with a path that cannot be `realpathSync`-resolved
- **THEN** the function SHALL return `"system"` (the safe-don't-touch default)

### Requirement: Latest-LTS probe with caching

The dashboard SHALL probe `https://nodejs.org/dist/index.json` at most once per 24 hours, filter to entries with `lts !== false`, and report the newest LTS version whose major matches the currently-installed runtime's major.

#### Scenario: Within-major LTS reported

- **WHEN** the currently-installed runtime is v22.10.0
- **AND** nodejs.org/dist/index.json lists v22.12.0 as the newest v22 LTS
- **THEN** `node-runtime-checker.getStatus()` SHALL report `latestVersion: "v22.12.0"`
- **AND** `updateAvailable: true`

#### Scenario: Up-to-date within major

- **WHEN** the currently-installed runtime matches the newest LTS in its major
- **THEN** `node-runtime-checker.getStatus()` SHALL report `updateAvailable: false`

#### Scenario: Cache served within 24h window

- **WHEN** `node-runtime-checker.getStatus()` is called and a cached probe is less than 24 hours old
- **THEN** the function SHALL NOT make a network request
- **AND** SHALL return the cached `latestVersion`

#### Scenario: Force refresh bypasses cache

- **WHEN** `node-runtime-checker.getStatus({ refresh: true })` is called
- **THEN** the function SHALL ignore any cached probe
- **AND** SHALL re-fetch nodejs.org/dist/index.json

#### Scenario: Probe failure does not crash status

- **WHEN** the nodejs.org probe fails (network error, HTTP non-2xx, parse error)
- **THEN** `node-runtime-checker.getStatus()` SHALL return `latestVersion: null` and `updateAvailable: false`
- **AND** SHALL log the failure without throwing

### Requirement: Source-aware update routing

`node-runtime-updater.update()` SHALL accept the request only when the runtime source is `"managed"` and SHALL refuse with a typed error otherwise.

#### Scenario: Managed source proceeds

- **WHEN** `node-runtime-updater.update()` is invoked and `classifyNodeSource(currentNodePath)` returns `"managed"`
- **THEN** the updater SHALL begin downloading the new Node release into `<managedDir>/node-pending/`

#### Scenario: System source refused

- **WHEN** `node-runtime-updater.update()` is invoked and the source is `"system"`
- **THEN** the updater SHALL reject with a typed error `NodeRuntimeUpdateNotApplicable("system")`
- **AND** SHALL NOT initiate any download

#### Scenario: Bundled-Electron source refused

- **WHEN** `node-runtime-updater.update()` is invoked and the source is `"bundled-electron"`
- **THEN** the updater SHALL reject with a typed error `NodeRuntimeUpdateNotApplicable("bundled-electron")`
- **AND** SHALL NOT initiate any download

### Requirement: Major-version policy

By default, `node-runtime-updater.update()` SHALL update only within the currently-installed major version. Cross-major updates SHALL require an explicit `{ allowMajor: true }` flag.

#### Scenario: Within-major default

- **WHEN** `node-runtime-updater.update()` is invoked without `allowMajor`
- **AND** the latest LTS in the current major differs from the installed version
- **THEN** the updater SHALL proceed to download that within-major version

#### Scenario: Cross-major refused without flag

- **WHEN** `node-runtime-updater.update()` is invoked without `allowMajor`
- **AND** the latest LTS overall is in a higher major than the installed version
- **THEN** the updater SHALL reject with a typed error `NodeRuntimeMajorVersionGate(currentMajor, latestMajor)`

#### Scenario: Cross-major allowed with flag

- **WHEN** `node-runtime-updater.update({ allowMajor: true })` is invoked
- **AND** the latest LTS overall is in a higher major than the installed version
- **THEN** the updater SHALL proceed to download the higher-major version

### Requirement: Stage-and-swap lifecycle

The updater SHALL download into `<managedDir>/node-pending/`, write a `<managedDir>/.node-swap-pending` marker file with the staged version, verify the staged Node, and apply the swap on the next dashboard / Electron start before the HTTP server binds.

#### Scenario: Staged download writes marker

- **WHEN** `node-runtime-updater.update()` completes a successful download
- **THEN** `<managedDir>/node-pending/` SHALL contain a fully-extracted Node tree
- **AND** `<managedDir>/.node-swap-pending` SHALL exist containing the staged version string

#### Scenario: Staged Node verified before marker write

- **WHEN** the download into `<managedDir>/node-pending/` completes
- **THEN** the updater SHALL invoke `<managedDir>/node-pending/{node.exe|bin/node} --version` and parse the output
- **AND** SHALL only write the swap-pending marker if the version output matches the staged version
- **AND** SHALL delete `<managedDir>/node-pending/` and reject with a typed error if verification fails

#### Scenario: Swap applied on next start

- **WHEN** the dashboard starts and `<managedDir>/.node-swap-pending` exists
- **THEN** the swap helper SHALL run before any HTTP server binds
- **AND** SHALL rename `<managedDir>/node/` → `<managedDir>/node-old/`
- **AND** SHALL rename `<managedDir>/node-pending/` → `<managedDir>/node/`
- **AND** SHALL delete the `<managedDir>/.node-swap-pending` marker

#### Scenario: Lazy node-old cleanup

- **WHEN** the dashboard starts and `<managedDir>/node-old/` exists
- **AND** no `<managedDir>/.node-swap-pending` marker exists (i.e. previous swap completed at least one start ago)
- **THEN** the swap helper SHALL delete `<managedDir>/node-old/`

#### Scenario: SHA-256 verification before extraction

- **WHEN** the updater downloads a Node release tarball / zip from nodejs.org
- **THEN** it SHALL also fetch the matching `SHASUMS256.txt` from the same release directory
- **AND** SHALL compute the SHA-256 of the downloaded archive
- **AND** SHALL only extract into `node-pending/` if the computed digest matches the entry in `SHASUMS256.txt`
- **AND** SHALL delete the downloaded archive and reject with a typed error otherwise

### Requirement: Reuse pi_core_update_progress channel

Progress and completion events for the Node runtime update SHALL flow through the existing `pi_core_update_progress` and `pi_core_update_complete` WebSocket channels, identified by `name: "node"`.

#### Scenario: Progress events use shared channel

- **WHEN** `node-runtime-updater.update()` emits progress
- **THEN** the WS event SHALL be `pi_core_update_progress`
- **AND** the payload SHALL include `name: "node"` and a `phase` field

#### Scenario: Runtime-specific phases

- **WHEN** the updater emits progress during the download or staging steps
- **THEN** the `phase` field SHALL include the values `"download"` (during HTTP download) and `"staged"` (after successful verification and marker write) in addition to the existing `"start" | "output" | "complete" | "error"` set

#### Scenario: Completion event uses shared channel

- **WHEN** `node-runtime-updater.update()` resolves successfully
- **THEN** the WS event SHALL be `pi_core_update_complete`
- **AND** the payload SHALL include `name: "node"` and `swapPending: true`

### Requirement: REST route for Node runtime update

`POST /api/pi-core/update-node` SHALL accept an optional `{ allowMajor?: boolean }` body, share the `runExclusive` busy-lock with `POST /api/pi-core/update`, and return one of: 202 Accepted with `{ ticketId }` on successful enqueue, 409 Conflict on lock contention, or 400 Bad Request when the runtime source is not `"managed"`.

#### Scenario: Accepted update enqueues with ticket

- **WHEN** `POST /api/pi-core/update-node` is invoked with the runtime source `"managed"` and the busy-lock free
- **THEN** the route SHALL respond `202 Accepted` with body `{ ticketId: string }`

#### Scenario: Lock contention returns 409

- **WHEN** `POST /api/pi-core/update-node` is invoked while a pi-package update is in flight
- **THEN** the route SHALL respond `409 Conflict`

#### Scenario: Non-managed source returns 400

- **WHEN** `POST /api/pi-core/update-node` is invoked while the runtime source is `"system"` or `"bundled-electron"`
- **THEN** the route SHALL respond `400 Bad Request` with an error body naming the actual source
