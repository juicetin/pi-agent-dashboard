## ADDED Requirements

### Requirement: Reading the global OpenSpec config does not block the event loop

`GET /api/openspec/config` SHALL read the global OpenSpec config without blocking the Node event loop. The handler SHALL run `openspec config list` through the asynchronous spawn path (not `spawnSync`), so a cold-cache read (which invokes the `openspec` CLI and can take ~1s) does not stall other in-flight HTTP requests on the single-threaded server.

- The 30s `configCache` behavior SHALL be preserved: a warm read returns the cached value without spawning the CLI.
- A cold read SHALL still return a well-formed `OpenSpecConfig` (defensive defaults for missing fields), the same shape as today.
- `GET /api/openspec/update-status` and the `POST /api/openspec/update` signature-record step SHALL likewise read the global workflow-set signature through the async spawn path. Because the profile is machine-global, the signature is identical for every cwd, so the server SHALL compute it ONCE per request rather than spawning the CLI once per project.

#### Scenario: Cold read does not stall concurrent requests

- **WHEN** a cold-cache `GET /api/openspec/config` triggers an `openspec config list` invocation that takes ~1s
- **THEN** other HTTP requests handled by the server during that interval are not delayed by the CLI invocation
- **AND** the config read still returns the correct profile/workflows once the CLI completes

#### Scenario: Warm read serves from cache without spawning

- **WHEN** `GET /api/openspec/config` is requested within 30s of a prior read for the same resolved cwd
- **THEN** the server returns the cached config
- **AND** does not invoke the `openspec` CLI

#### Scenario: update-status computes the global signature once, not per cwd

- **WHEN** `GET /api/openspec/update-status` runs with N known OpenSpec projects
- **THEN** the server invokes the `openspec` CLI exactly once (async), not once per project
- **AND** the per-cwd staleness classification still uses that single global signature

### Requirement: Profile settings section loads the saved profile reliably

The Settings "OpenSpec Workflow Profile" section SHALL reflect the current global profile/workflows once loaded, and SHALL NOT present a concrete profile as selected before the real config has resolved. A transient load failure SHALL NOT silently strand the section on a hardcoded default.

- On mount, the section SHALL show a loading state (no profile radio pre-selected as authoritative) until the global config resolves.
- On a transient fetch failure, the section SHALL retry the load (at least once) before giving up.
- If the load ultimately fails, the section SHALL surface a visible error with a manual retry affordance rather than displaying an arbitrary default profile as if it were saved.
- Once the config resolves, the selected profile radio and workflow chips SHALL match the value returned by `GET /api/openspec/config`.

#### Scenario: Section reflects the saved profile after load

- **WHEN** the global config has `profile: "expanded"`
- **AND** the section mounts and the config load succeeds
- **THEN** the `expanded` radio is selected
- **AND** the workflow chips match the expanded workflow set

#### Scenario: Transient failure is retried, not swallowed

- **WHEN** the initial config load fails transiently (e.g. a network rejection)
- **THEN** the section retries the load
- **AND** if a retry succeeds, the section shows the correct saved profile
- **AND** the section never presents a hardcoded `core` selection as the saved profile after a failure

#### Scenario: Persistent failure surfaces an error

- **WHEN** the config load fails and all retries are exhausted
- **THEN** the section shows a visible error state with a manual retry affordance
- **AND** does not display an arbitrary default profile as the saved value
