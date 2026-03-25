## ADDED Requirements

### Requirement: Dev build and server shutdown on reload cleanup
When `devBuildOnReload` is `true` in the loaded config, the bridge extension's cleanup function (called on `/reload`) SHALL perform the following before the normal cleanup:

1. Log `🔨 Dashboard: building client...` to the terminal
2. Run `execSync("npm run build", { cwd: <packageRoot>, stdio: "inherit" })` where packageRoot is resolved from `__dirname` (two levels up from `src/extension/`)
3. Log `✅ Dashboard: client built` on success, or log the error on failure
4. Log `🛑 Dashboard: stopping server...` to the terminal
5. Send `POST http://localhost:{port}/api/shutdown` (fire-and-forget)
6. Log `✅ Dashboard: server stopped`

Build or shutdown failures SHALL be caught and logged but SHALL NOT prevent the reload from completing.

#### Scenario: Cleanup with devBuildOnReload enabled
- **WHEN** `/reload` triggers the cleanup function and `config.devBuildOnReload` is `true`
- **THEN** the cleanup SHALL build the client and request server shutdown before disconnecting

#### Scenario: Cleanup with devBuildOnReload disabled
- **WHEN** `/reload` triggers the cleanup function and `config.devBuildOnReload` is `false`
- **THEN** the cleanup SHALL proceed normally without building or shutting down the server

#### Scenario: Build error is non-fatal
- **WHEN** `execSync("npm run build")` throws an error during cleanup
- **THEN** the error SHALL be logged and cleanup SHALL continue with the shutdown request
