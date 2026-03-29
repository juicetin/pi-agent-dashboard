## ADDED Requirements

### Requirement: Subprocess tunnel management
The tunnel module SHALL manage the `zrok share public` process lifecycle including spawning, monitoring, and termination. The subprocess SHALL be spawned with `--headless` flag and target `localhost:{port}`.

#### Scenario: Spawn tunnel subprocess
- **WHEN** `createTunnel(port)` is called and zrok is enrolled and binary is available
- **THEN** the module SHALL spawn `zrok share public --headless localhost:{port}` and parse the public URL from stdout

#### Scenario: URL parsing from stdout
- **WHEN** the zrok subprocess outputs its share URL to stdout
- **THEN** the module SHALL extract the URL and resolve the createTunnel promise with it

#### Scenario: Subprocess exits unexpectedly
- **WHEN** the zrok subprocess exits after successfully starting
- **THEN** the module SHALL set tunnel status to inactive and log the exit code

#### Scenario: Subprocess spawn timeout
- **WHEN** the zrok subprocess does not output a URL within a reasonable timeout (30 seconds)
- **THEN** the module SHALL kill the process, log a warning, and return null

### Requirement: PID file management
The tunnel module SHALL persist the zrok subprocess PID to `~/.pi/dashboard/zrok.pid` for stale process detection across server restarts.

#### Scenario: PID file written on tunnel creation
- **WHEN** the zrok subprocess starts successfully
- **THEN** the module SHALL write the process PID to `~/.pi/dashboard/zrok.pid`

#### Scenario: PID file removed on clean shutdown
- **WHEN** the tunnel is destroyed via `deleteTunnel()`
- **THEN** the module SHALL remove the PID file

#### Scenario: PID file removed on subprocess crash
- **WHEN** the zrok subprocess exits unexpectedly
- **THEN** the module SHALL remove the PID file
