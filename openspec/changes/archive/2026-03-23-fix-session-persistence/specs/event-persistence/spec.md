## ADDED Requirements

### Requirement: Periodic database flush to disk
The dashboard server SHALL flush the in-memory sql.js database to disk at a regular interval (default 30 seconds) during normal operation. The flush SHALL call `db.save()` which exports the database and writes it to the configured `dbPath`.

The flush timer SHALL be started when the server starts and cleared when the server stops.

#### Scenario: Periodic flush during operation
- **WHEN** the server has been running for 30 seconds with new events inserted
- **THEN** the database file on disk SHALL contain those events

#### Scenario: Ungraceful shutdown loses at most one interval of data
- **WHEN** the server process is killed without graceful shutdown
- **THEN** at most 30 seconds of data SHALL be lost (since the last periodic flush)

#### Scenario: Flush timer cleanup on shutdown
- **WHEN** the server stops gracefully
- **THEN** the periodic flush timer SHALL be cleared and `db.close()` SHALL still be called as before
