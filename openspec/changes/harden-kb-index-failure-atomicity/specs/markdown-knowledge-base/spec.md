## ADDED Requirements

### Requirement: kb index is atomic on failure

A `kb index` run SHALL NOT leave a committed database file at `dbPath` when the run fails
before completing successfully. A file present at `dbPath` after `kb index` SHALL mean a
successful index ran.

The store is opened with `CREATE TABLE IF NOT EXISTS`, so merely opening it writes an empty
schema to disk. To preserve the "file exists ⟺ successfully indexed" invariant, a run that
had to create the database SHALL either (a) build into a temporary path and `rename()` onto
`dbPath` only after the index resolves, or (b) `close()` and unlink the freshly-created file
(and any `-wal` / `-shm` sidecars) on a failure exit.

A run over an already-valid database SHALL leave that database intact on failure — only a
run that itself created the file is responsible for removing it.

#### Scenario: Failed index leaves no artifact

- **WHEN** `kb index` is run and the index step throws before completion (missing source,
  interrupt, or error) on a checkout with no prior `dbPath`
- **THEN** the process SHALL exit non-zero
- **AND** there SHALL be no file at `dbPath` (no empty-schema husk)

#### Scenario: Failed incremental run preserves a valid prior index

- **WHEN** a valid populated index exists at `dbPath` and a subsequent `kb index` run fails
- **THEN** the prior valid index at `dbPath` SHALL remain intact and queryable

#### Scenario: Successful index commits the file

- **WHEN** `kb index` completes successfully over at least one non-empty source
- **THEN** a single SQLite file SHALL be present at `dbPath` with a non-zero chunk count

### Requirement: Missing source directory degrades, not aborts

`kb index` SHALL treat a configured source whose directory does not exist as a skip with a
warning, not a fatal error. A partial source set SHALL still produce a valid index over the
sources that do exist.

#### Scenario: One missing source among several

- **WHEN** `kb index` runs with three configured sources and one source directory is absent
- **THEN** the two present sources SHALL be indexed
- **AND** a warning naming the missing source SHALL be emitted
- **AND** the process SHALL exit `0` with a non-zero chunk count

#### Scenario: All sources missing yields no husk

- **WHEN** every configured source directory is absent
- **THEN** the process SHALL exit non-zero
- **AND** there SHALL be no file left at `dbPath` (per the atomicity requirement)
