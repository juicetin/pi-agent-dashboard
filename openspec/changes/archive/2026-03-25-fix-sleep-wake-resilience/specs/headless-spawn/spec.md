## ADDED Requirements

### Requirement: Headless PID persistence to disk
The server SHALL persist headless process entries to `~/.pi/dashboard/headless-pids.json` using atomic writes. The file SHALL contain an array of entries with fields `pid` (number), `cwd` (string), and `spawnedAt` (ISO timestamp). Entries SHALL be written on register and removed on process exit or kill.

#### Scenario: Headless process spawned
- **WHEN** a headless pi session is spawned with PID 12345 in `/projects/app`
- **THEN** the server SHALL write an entry `{ pid: 12345, cwd: "/projects/app", spawnedAt: "..." }` to the PID file

#### Scenario: Headless process exits
- **WHEN** a tracked headless process exits
- **THEN** the server SHALL remove its entry from the PID file

#### Scenario: PID file is empty
- **WHEN** no headless processes are tracked
- **THEN** the PID file SHALL contain `{ "entries": [] }`

### Requirement: Orphan cleanup on server startup
On startup, the server SHALL read the headless PID file and check each entry. If the PID is still alive (`process.kill(pid, 0)` succeeds), the server SHALL reclaim it into the registry. If the PID is dead, the server SHALL remove the stale entry. If the PID is alive but was spawned more than 7 days ago, the server SHALL kill it and remove the entry.

#### Scenario: Orphan process still alive
- **WHEN** the server starts and finds PID 12345 in the PID file and the process is still alive
- **THEN** the server SHALL add it to the headless registry for tracking

#### Scenario: Stale PID (process dead)
- **WHEN** the server starts and finds PID 12345 in the PID file but the process is not alive
- **THEN** the server SHALL remove the entry from the PID file

#### Scenario: Very old orphan killed
- **WHEN** the server starts and finds a PID spawned more than 7 days ago that is still alive
- **THEN** the server SHALL send SIGTERM to the process and remove the entry
