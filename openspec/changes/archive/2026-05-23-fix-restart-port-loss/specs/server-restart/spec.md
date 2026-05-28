## ADDED Requirements

### Requirement: Restart orchestrator preserves the bound port

The detached orchestrator built by `restart-helper.ts:buildOrchestratorScript` SHALL serialize the parent process's actually-bound HTTP port (received as `params.port`) into the new child's CLI args as `--port <n>`. The injection SHALL apply to BOTH argv-construction branches of `spawnArgs`:

- The `--import` loader branch (`buildNodeImportArgvParts`).
- The bare-entry branch (no loader).

The `--port` flag SHALL be placed AFTER `"start"` and BEFORE any `...params.extraArgs` so that callers passing their own `--port` in `extraArgs` can override the structural value (left-to-right argv semantics in `cli.ts:parseArgs`).

The orchestrator's `PORT` constant (used by `portFree` and `healthOk` polling) SHALL remain `params.port` so the port polled for health is identical to the port the new child is told to bind.

#### Scenario: Loader branch — `--port` injected after `start` and before extraArgs

- **WHEN** `buildOrchestratorScript({ cliPath, loader: "file:///loader.mjs", port: 8001, extraArgs: ["--dev"] })` is called
- **THEN** the embedded spawn args SHALL include `"start"`, `"--port"`, `"8001"`, `"--dev"` in that relative order
- **AND** the embedded `PORT` constant SHALL equal `8001`

#### Scenario: Bare-entry branch — `--port` injected after `start` and before extraArgs

- **WHEN** `buildOrchestratorScript({ cliPath, loader: "", port: 8001, extraArgs: ["--dev"] })` is called
- **THEN** the embedded spawn args SHALL include `"start"`, `"--port"`, `"8001"`, `"--dev"` in that relative order

#### Scenario: Caller-supplied --port in extraArgs overrides the structural port

- **WHEN** `buildOrchestratorScript({ cliPath, loader: "", port: 8001, extraArgs: ["--port", "9000"] })` is called
- **THEN** the embedded spawn args SHALL include `"--port"`, `"8001"`, `"--port"`, `"9000"` in that relative order
- **AND** `cli.ts:parseArgs` left-to-right semantics SHALL cause the child to bind on `9000` (the last value wins)

#### Scenario: Restarted server preserves non-default bind port end-to-end

- **GIVEN** a dashboard server was started with `--port 8001` (`config.port === 8001`)
- **AND** `~/.pi/dashboard/config.json` contains the default `port: 8000`
- **WHEN** `POST :8001/api/restart` is invoked
- **THEN** the replacement child SHALL bind on `8001` (not `8000`)
- **AND** `/api/health` SHALL respond on `8001` after the orchestrator's health-polling window
