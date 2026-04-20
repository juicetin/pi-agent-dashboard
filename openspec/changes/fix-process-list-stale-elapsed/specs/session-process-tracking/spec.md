## MODIFIED Requirements

### Requirement: Bridge polls process scanner and sends updates on change
The bridge extension SHALL start a periodic timer (10 second interval) that calls `scanChildProcesses(process.pid)`. It SHALL compare the result to the previous scan. If the list has changed (different PIDs), it SHALL send a `process_list` message to the server.

Each entry in the emitted `process_list.processes[]` SHALL include a `startedAt: number` field carrying the epoch-millisecond timestamp at which the process started, computed at emit time as `Date.now() - elapsedMs`. The legacy `elapsedMs` field SHALL continue to be included for backward compatibility with older clients.

#### Scenario: Process list changed
- **WHEN** the periodic scan detects a new child process not in the previous list
- **THEN** the bridge SHALL send a `process_list` message with the full current list
- **AND** each entry SHALL include a `startedAt` field equal to `Date.now() - elapsedMs` at emit time (±1 ms tolerance)

#### Scenario: Process list unchanged
- **WHEN** the periodic scan returns the same PIDs as the previous scan
- **THEN** the bridge SHALL NOT send a `process_list` message

#### Scenario: Process list becomes empty
- **WHEN** the periodic scan returns no processes and the previous scan had processes
- **THEN** the bridge SHALL send a `process_list` message with an empty array

#### Scenario: Timer cleanup on disconnect
- **WHEN** the bridge disconnects or the session ends
- **THEN** the process scan timer SHALL be cleared

#### Scenario: startedAt is stable across re-emits
- **WHEN** the PID set changes and the bridge re-emits a `process_list` containing a PID that was already in the previous emit
- **THEN** the `startedAt` value for that PID SHALL still be derived from the current scan's `elapsedMs` (i.e., the bridge does not cache `startedAt` across emits; re-derivation from `ps etime` is idempotent because process start time is fixed)

### Requirement: Session card shows active child processes
The dashboard session card SHALL display a process list section when the session has active child processes (non-empty process list). Each entry SHALL show a truncated command string (max 40 characters), elapsed time (human-readable), and a red ✕ button.

The elapsed time SHALL update live (ticking at least once per second) by subtracting `startedAt` from the current wall-clock time. When an entry's `startedAt` is absent (older bridge extension), the client SHALL fall back to rendering the static `elapsedMs` value without ticking.

#### Scenario: No active processes
- **WHEN** a session has no child processes
- **THEN** the process list section SHALL NOT be rendered

#### Scenario: Active processes displayed
- **WHEN** a session has two child processes
- **THEN** the card SHALL show two entries with command, elapsed time, and kill buttons

#### Scenario: Kill button sends kill request immediately
- **WHEN** the user clicks the ✕ button for a process
- **THEN** the browser SHALL send a `kill_process` message with the session ID and PGID immediately without confirmation

#### Scenario: Process disappears after kill
- **WHEN** a kill request succeeds and the next process scan excludes the killed process
- **THEN** the entry SHALL be removed from the session card

#### Scenario: Elapsed time ticks live
- **WHEN** a process entry has `startedAt` and remains in the list across re-renders without a new `process_list` message arriving
- **THEN** the displayed elapsed time SHALL increase over time (ticking at least once per second) rather than remaining frozen at the value from the last emit

#### Scenario: Fallback when startedAt missing
- **WHEN** a process entry has no `startedAt` field (older bridge version)
- **THEN** the card SHALL render the provided `elapsedMs` as a static (non-ticking) value and SHALL NOT throw
