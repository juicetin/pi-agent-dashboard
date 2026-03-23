## ADDED Requirements

### Requirement: @ trigger detection
When the user types `@` after a delimiter (space, tab, or start of input) in the chat input, the system SHALL initiate file autocomplete by sending a `list_files` request to the bridge via the server.

#### Scenario: @ at start of input
- **WHEN** the user types `@` as the first character in the input
- **THEN** the system SHALL send a `list_files` request with an empty query

#### Scenario: @ after space
- **WHEN** the user types `check @` (@ after a space)
- **THEN** the system SHALL send a `list_files` request with an empty query

#### Scenario: @ in middle of word
- **WHEN** the user types `email@` (@ not after a delimiter)
- **THEN** the system SHALL NOT trigger file autocomplete

### Requirement: Debounced file search requests
The system SHALL debounce `list_files` requests at 150ms to avoid flooding the server while the user types a query after `@`.

#### Scenario: Rapid typing after @
- **WHEN** the user types `@src/ser` rapidly (each character within 150ms)
- **THEN** the system SHALL send only one `list_files` request with query `src/ser`

#### Scenario: Pause during typing
- **WHEN** the user types `@src`, pauses 200ms, then types `/db`
- **THEN** the system SHALL send two `list_files` requests: one with `src` and one with `src/db`

### Requirement: File autocomplete dropdown
When `files_list` results arrive, the system SHALL display a dropdown above the input showing matching file paths. Each entry SHALL show the filename as label and the relative path as description. Directories SHALL be shown with a trailing `/`.

#### Scenario: Results received
- **WHEN** a `files_list` response arrives with file entries
- **THEN** the dropdown SHALL display up to 20 entries with filename and path

#### Scenario: No results
- **WHEN** a `files_list` response arrives with an empty file list
- **THEN** the dropdown SHALL NOT be shown

#### Scenario: Directory entry display
- **WHEN** a result entry has `isDirectory: true`
- **THEN** the entry label SHALL include a trailing `/` (e.g., `src/`)

### Requirement: File autocomplete selection
When the user selects a file from the dropdown, the system SHALL insert `@path/to/file` into the input text, replacing the `@query` prefix. A space SHALL be appended after file selections. No space SHALL be appended after directory selections.

#### Scenario: Select a file
- **WHEN** the user selects `src/server/db.ts` from the dropdown while input contains `@src/ser`
- **THEN** the input SHALL contain `@src/server/db.ts ` (with trailing space)

#### Scenario: Select a directory
- **WHEN** the user selects `src/server/` from the dropdown
- **THEN** the input SHALL contain `@src/server/` (no trailing space, allowing continued completion)

### Requirement: File dropdown keyboard navigation
The file autocomplete dropdown SHALL support keyboard navigation identical to the slash command dropdown.

#### Scenario: Arrow key navigation
- **WHEN** the file dropdown is open and the user presses ArrowDown/ArrowUp
- **THEN** the highlight SHALL move to the next/previous file entry

#### Scenario: Enter or Tab to select
- **WHEN** a file is highlighted and the user presses Enter or Tab
- **THEN** that file SHALL be selected and inserted into the input

#### Scenario: Escape to dismiss
- **WHEN** the file dropdown is open and the user presses Escape
- **THEN** the dropdown SHALL close and the input SHALL retain its current text

### Requirement: Stale results handling
When a new `files_list` response arrives, it SHALL replace any previous results. The response SHALL include the original query so the client can discard results for outdated queries.

#### Scenario: Out-of-order responses
- **WHEN** the user types `@src` then quickly `@server`, and the response for `src` arrives after `server`
- **THEN** the system SHALL discard the `src` response and only show results for `server`
