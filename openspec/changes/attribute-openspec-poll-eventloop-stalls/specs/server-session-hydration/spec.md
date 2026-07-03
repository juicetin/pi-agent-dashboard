## ADDED Requirements

### Requirement: Event-loop stalls are retained and attributed independently of poll timing

The server SHALL retain recent worst-case event-loop-delay observations in a
bounded, process-local, in-memory ring buffer that is populated on a fixed
sampling cadence independent of any `/api/health` read, so a sub-threshold stall
(e.g. ~700ms) is recorded even when no client polls `/api/health` at the instant
it occurs. Each retained observation SHALL carry at least a timestamp and the
delay in milliseconds, and MAY carry an attributed source segment. Recording
SHALL be O(1) with no serialization of large payloads, and a failure in the
measurement path SHALL NOT propagate to request handling.

The server SHALL attribute the synchronous main-thread cost of the periodic
OpenSpec poll tick to named segments (at minimum: the folder-head git-HEAD poll,
the mtime/TOCTOU gate `stat` stamping, and the broadcast fan-out) using
monotonic timing, and SHALL associate the slowest segment of a tick with the
event-loop observation retained for that window.

#### Scenario: A stall is captured without an in-flight health poll
- **GIVEN** no client is calling `/api/health`
- **WHEN** the main thread blocks for longer than the retention sampling can miss
- **THEN** the server SHALL retain an event-loop observation for that block with its timestamp and duration

#### Scenario: The tick's slowest synchronous segment is attributed
- **WHEN** a periodic poll tick runs main-thread work across its segments
- **THEN** the server SHALL record which segment consumed the most synchronous time for that tick

#### Scenario: Retention buffer is bounded
- **WHEN** more observations are recorded than the buffer capacity
- **THEN** the oldest observations SHALL be evicted and the buffer SHALL NOT grow unbounded

#### Scenario: Health endpoint surfaces retained stalls
- **WHEN** a client GETs `/api/health`
- **THEN** the response SHALL include the retained event-loop stall observations additively, without removing existing `eventLoopDelay` or `hydration` fields
