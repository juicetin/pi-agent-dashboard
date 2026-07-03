## ADDED Requirements

### Requirement: Ungated per-tick main-thread work does not block the event loop

The server SHALL NOT allow work that runs on every periodic poll tick regardless
of the change-detection gate — specifically the folder-head git-HEAD poll
(`tickFolderHeads`), the mtime/TOCTOU gate `stat` stamping, and the broadcast
fan-out — to block the main event loop for a duration that stalls WebSocket frame
delivery to connected clients. Such work SHALL either run off the main thread, be gated so it
performs no synchronous filesystem or child-process work when its inputs are
unchanged, or yield to the event loop (e.g. bounded-concurrency async I/O or
chunking) so no single tick produces one uninterrupted synchronous burst.

The folder-head poll SHALL avoid re-reading a directory's git HEAD on a tick when
that directory's git ref state has not advanced since the last read.

#### Scenario: A no-op tick produces no main-thread stall
- **GIVEN** no pinned or active-session directory has changed git HEAD, openspec artifacts, or membership since the previous tick
- **WHEN** a periodic poll tick runs
- **THEN** the tick SHALL NOT produce an event-loop-delay observation above the configured synchronous-stall threshold

#### Scenario: Branch switch still reflects on the next tick
- **WHEN** a directory's git HEAD advances between ticks
- **THEN** the folder-head poll SHALL re-read that directory's HEAD and surface the updated head on the next tick

### Requirement: Slow-tick warning keys on synchronous main-thread time

The slow-tick warning SHALL fire on the summed synchronous main-thread time of a
tick's segments, NOT on the tick's wall-clock `durationMs`. Because the wall
duration is dominated by the intentional per-directory jitter stagger
(`jitterSeconds`), keying the warning on wall duration produces false alarms on
benign ticks and hides genuine sub-second stalls. The synchronous-stall threshold
SHALL be configurable.

#### Scenario: Jitter-only tick does not warn
- **GIVEN** a tick whose wall `durationMs` is near `jitterSeconds` but whose synchronous segment time is small
- **WHEN** the tick completes
- **THEN** the server SHALL NOT emit a slow-tick warning

#### Scenario: A sub-second synchronous stall warns
- **WHEN** a tick's summed synchronous segment time exceeds the configured threshold
- **THEN** the server SHALL emit a slow-tick warning identifying the dominant segment
