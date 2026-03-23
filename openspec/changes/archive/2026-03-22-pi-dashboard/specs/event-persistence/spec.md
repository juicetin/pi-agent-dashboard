## ADDED Requirements

### Requirement: SQLite event store
The dashboard server SHALL persist all events in a SQLite database at the configured path (default `~/.pi/dashboard/dashboard.db`). The database SHALL be created automatically on first run with the required schema.

Each event record SHALL contain: id (autoincrement), sessionId, seq (per-session sequence number), eventType, payload (JSON string), createdAt (unix timestamp ms).

#### Scenario: Event storage
- **WHEN** an event arrives from a bridge extension
- **THEN** the server SHALL assign the next sequence number for that session, serialize the payload to JSON, and insert into SQLite

#### Scenario: Database creation on first run
- **WHEN** the dashboard server starts and no database file exists
- **THEN** it SHALL create the database file and run all migrations to create the schema

#### Scenario: Database in custom location
- **WHEN** the server is configured with a custom `dbPath`
- **THEN** the database SHALL be created at that path, including any parent directories

### Requirement: Per-session sequence numbers
Each event SHALL receive a monotonically increasing sequence number scoped to its session. Sequence numbers SHALL start at 0 for each session and increment by 1.

#### Scenario: Sequence number assignment
- **WHEN** three events arrive for session "abc"
- **THEN** they SHALL be assigned seq 0, 1, 2 respectively

#### Scenario: Independent sequences per session
- **WHEN** events arrive for sessions "abc" and "def"
- **THEN** each session SHALL maintain its own independent sequence counter

### Requirement: Event replay for reconnection
The server SHALL support replaying events from a given sequence number for browser catch-up after reconnection.

#### Scenario: Full replay
- **WHEN** a browser subscribes with `lastSeq: -1` (or omitted)
- **THEN** the server SHALL replay ALL events for that session from seq 0

#### Scenario: Partial replay
- **WHEN** a browser subscribes with `lastSeq: 100`
- **THEN** the server SHALL replay only events with seq > 100

#### Scenario: Large replay batching
- **WHEN** a replay involves more than 200 events
- **THEN** the server SHALL send them in batches of 200 via `event_replay` messages to avoid blocking the WebSocket

### Requirement: Content split for lazy loading
The event store SHALL support fetching the full payload of a specific event by sessionId and sequence number. This enables the chat view to lazy-load tool call content.

#### Scenario: Fetch event content
- **WHEN** a browser requests `GET /api/events/:sessionId/:seq`
- **THEN** the server SHALL return the full event payload from SQLite

#### Scenario: Fetch non-existent event
- **WHEN** a browser requests an event that doesn't exist
- **THEN** the server SHALL return a 404 error

### Requirement: 30-day retention policy
The event store SHALL automatically delete events older than 30 days (configurable via `retentionDays`). Cleanup SHALL run once per day (on server start and every 24 hours thereafter).

Session records with status `ended` whose last event is older than the retention period SHALL also be deleted.

#### Scenario: Daily cleanup
- **WHEN** the cleanup job runs
- **THEN** it SHALL delete all events with `createdAt` older than 30 days and ended sessions with no remaining events

#### Scenario: Custom retention period
- **WHEN** the server is configured with `retentionDays: 7`
- **THEN** the cleanup SHALL delete events older than 7 days

#### Scenario: Active session events not deleted
- **WHEN** an active session has events older than 30 days (long-running session)
- **THEN** those events SHALL still be deleted (retention is absolute, not session-relative) but the session record SHALL be preserved

### Requirement: Session persistence
Session metadata (workspace assignment, status, stats, model info) SHALL be persisted in SQLite across server restarts.

#### Scenario: Server restart preserves sessions
- **WHEN** the server restarts
- **THEN** it SHALL load all session records from SQLite and display ended sessions in the sidebar

#### Scenario: Active sessions after restart
- **WHEN** the server restarts and pi sessions reconnect
- **THEN** their session records SHALL be updated (not duplicated) based on piSessionId matching

### Requirement: Workspace persistence
Workspace records SHALL be persisted in SQLite across server restarts.

#### Scenario: Workspaces survive restart
- **WHEN** the server restarts
- **THEN** all workspace records SHALL be loaded from SQLite and displayed in the workspace bar

### Requirement: Database migrations
The database schema SHALL use versioned migrations. Each migration SHALL be idempotent. The server SHALL check the current schema version on startup and apply any pending migrations.

#### Scenario: Migration on upgrade
- **WHEN** the server starts with a database from an older version
- **THEN** it SHALL apply pending migrations to update the schema without data loss
