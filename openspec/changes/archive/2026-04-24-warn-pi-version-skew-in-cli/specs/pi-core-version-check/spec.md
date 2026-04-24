## ADDED Requirements

### Requirement: CLI surfaces pi version-skew warnings at startup

The `pi-dashboard` CLI SHALL emit a stderr warning at server startup whenever `updateBootstrapCompatibility` produces a below-minimum or below-recommended result. The warning SHALL be emitted once per server start, after the compatibility check has populated `bootstrapState`.

The warning format SHALL distinguish two severities:

- **Below minimum** (blocking): MUST include the current version, the minimum version, an explanation that pi-dependent features return 503, and the exact remediation command `pi-dashboard upgrade-pi`. Emitted via `console.error` so it appears on stderr and propagates into `~/.pi/dashboard/server.log` when spawned by Electron.
- **Below recommended** (advisory, but ≥ minimum): MUST be a single line including the current and recommended versions. Emitted via `console.warn`.

When the current version is in range (at-or-above `recommended`, at-or-below `maximum` when set), NO warning SHALL be emitted.

#### Scenario: Below-minimum warning on startup
- **WHEN** `pi-dashboard start` runs and `updateBootstrapCompatibility` returns a result where `isBelow(current, minimum)` is true
- **THEN** the CLI SHALL emit a `console.error` warning that names the current and minimum versions
- **AND** the warning SHALL include the literal command `pi-dashboard upgrade-pi`
- **AND** the warning SHALL explain that pi-dependent features return 503
- **AND** the server process SHALL continue starting (no early exit)

#### Scenario: Below-recommended warning on startup
- **WHEN** `pi-dashboard start` runs and the result has `upgradeRecommended: true` but no blocking `error`
- **THEN** the CLI SHALL emit a single-line `console.warn` that names the current and recommended versions
- **AND** the warning SHALL NOT include the "return 503" language
- **AND** the server process SHALL continue starting

#### Scenario: No warning when in range
- **WHEN** `pi-dashboard start` runs and the result has neither `error` nor `upgradeRecommended`
- **THEN** no compatibility warning SHALL be emitted

#### Scenario: Warning re-emits on restart
- **WHEN** `POST /api/restart` spawns a fresh server process
- **AND** the currently-resolved pi version is below `minimum`
- **THEN** the new process SHALL emit the below-minimum warning during its startup
- **AND** this warning SHALL appear in `~/.pi/dashboard/server.log`

#### Scenario: Warning uses existing bootstrapState result
- **WHEN** the CLI logs the compatibility warning
- **THEN** it SHALL read the result from `bootstrapState` (populated by the already-invoked `updateBootstrapCompatibility`)
- **AND** it SHALL NOT re-read `package.json` or re-invoke `readCurrentPiVersion`

### Requirement: readCurrentPiVersion resolves symlinked bin launchers

When `registry.resolve("pi")` succeeds, `readCurrentPiVersion` SHALL apply `fs.realpathSync` to the resolved path before computing the parent-directory `package.json` location, so symlinked npm bin launchers (e.g. `~/.nvm/.../bin/pi` → `../lib/node_modules/@mariozechner/pi-coding-agent/dist/cli.js`) resolve to the real pi `package.json`.

#### Scenario: npm-global install produces a symlinked bin launcher
- **WHEN** `registry.resolve("pi")` returns a path that is a symlink (e.g. `/home/user/.nvm/versions/node/v22/bin/pi`)
- **THEN** `readCurrentPiVersion` SHALL realpath the symlink before taking `dirname(dirname(...))`
- **AND** the resulting `package.json` path SHALL point at the real pi module's `package.json`
- **AND** `readCurrentPiVersion` SHALL return the actual version string

#### Scenario: Direct module path is a no-op under realpath
- **WHEN** `res.path` is already a real (non-symlinked) file
- **THEN** `fs.realpathSync` SHALL return the same path unchanged
- **AND** existing resolution behavior SHALL be preserved

#### Scenario: realpathSync failure falls through gracefully
- **WHEN** `fs.realpathSync` throws (e.g. dangling symlink, permission denied)
- **THEN** `readCurrentPiVersion` SHALL catch the error and return `undefined`
- **AND** it SHALL NOT crash the server startup
