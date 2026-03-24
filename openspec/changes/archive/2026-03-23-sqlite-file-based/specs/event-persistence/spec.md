## MODIFIED Requirements

### Requirement: SQLite event store
The dashboard server SHALL persist all events in a SQLite database at the configured path (default `~/.pi/dashboard/dashboard.db`) using `better-sqlite3` (native file-based SQLite binding). The database SHALL be created automatically on first run with the required schema. WAL journal mode SHALL be enabled on database open.

Each event record SHALL contain: id (autoincrement), sessionId, seq (per-session sequence number), eventType, payload (JSON string), createdAt (unix timestamp ms).

#### Scenario: Event storage
- **WHEN** an event arrives from a bridge extension
- **THEN** the server SHALL assign the next sequence number for that session, serialize the payload to JSON, and insert into SQLite. The write SHALL be persisted to disk immediately (no periodic flush needed).

#### Scenario: Database creation on first run
- **WHEN** the dashboard server starts and no database file exists
- **THEN** it SHALL create the database file and run all migrations to create the schema

#### Scenario: Database in custom location
- **WHEN** the server is configured with a custom `dbPath`
- **THEN** the database SHALL be created at that path, including any parent directories

#### Scenario: WAL mode enabled
- **WHEN** the database is opened
- **THEN** the server SHALL enable WAL journal mode via `PRAGMA journal_mode=WAL`

## REMOVED Requirements

### Requirement: Periodic database flush to disk
**Reason**: Replaced by native file-based SQLite (`better-sqlite3`) which persists writes immediately. No in-memory buffer or periodic flush is needed.
**Migration**: Remove the `save()` method from the `Database` interface, remove the flush `setInterval` from the server, and remove the `DB_SAVE_INTERVAL_MS` constant.
