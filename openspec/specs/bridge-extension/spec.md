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

### Requirement: Retry port probe after failed server launch
When `launchServer` returns a failure result during the auto-start flow in `session_start`, the bridge extension SHALL re-probe the port using `isPortOpen(config.piPort)` before deciding whether to show a warning notification. If the re-probe returns `true` (port is now open), the bridge SHALL suppress the failure warning — another agent started the server concurrently. If the re-probe returns `false` (port is still closed), the bridge SHALL show the warning notification with the failure message.

#### Scenario: Concurrent launch — another agent started the server
- **WHEN** `launchServer` fails and the subsequent `isPortOpen` re-probe returns `true`
- **THEN** no warning notification SHALL be shown

#### Scenario: Genuine server failure
- **WHEN** `launchServer` fails and the subsequent `isPortOpen` re-probe returns `false`
- **THEN** the bridge SHALL show a warning notification with the failure message

#### Scenario: Single agent — successful launch
- **WHEN** `launchServer` succeeds on the first attempt
- **THEN** the bridge SHALL show the success notification as before (no behavioral change)
