## ADDED Requirements

### Requirement: Directory browse API
The server SHALL expose `GET /api/browse?path=<dir>` (localhost-only) that returns directory entries for the given path. The response SHALL include `{ success: true, data: { entries: Array<{ name, path, isGit, isPi }>, parent: string | null, current: string } }`. Only directories SHALL be listed (no files). Hidden directories (names starting with `.`) SHALL be excluded. Entries SHALL be sorted alphabetically. If `path` is omitted, it SHALL default to the user's home directory. The entry limit SHALL be 200.

#### Scenario: Browse valid directory
- **WHEN** a GET request is made to `/api/browse?path=/home/user/projects`
- **THEN** the server SHALL return a list of subdirectories with `isGit` and `isPi` flags indicating presence of `.git` and `.pi` directories

#### Scenario: Browse home directory (default)
- **WHEN** a GET request is made to `/api/browse` without a path parameter
- **THEN** the server SHALL return entries for the user's home directory (`os.homedir()`)

#### Scenario: Browse non-existent directory
- **WHEN** a GET request is made with a path that does not exist
- **THEN** the server SHALL return `{ success: false, error: "directory not found" }`

#### Scenario: Parent path included
- **WHEN** a directory listing is returned for `/home/user/projects`
- **THEN** the `parent` field SHALL be `/home/user`

#### Scenario: Root directory has no parent
- **WHEN** a directory listing is returned for `/`
- **THEN** the `parent` field SHALL be `null`

#### Scenario: Remote access blocked
- **WHEN** a GET request originates from a non-loopback address
- **THEN** the server SHALL return `{ success: false, error: "localhost only" }`

#### Scenario: Hidden directories excluded
- **WHEN** a directory contains subdirectories like `.config`, `.cache`, `projects`
- **THEN** only `projects` SHALL appear in the entries (hidden dirs excluded)

#### Scenario: Entry limit
- **WHEN** a directory contains more than 200 subdirectories
- **THEN** only the first 200 (alphabetically sorted) SHALL be returned

### Requirement: Filesystem browser component
The web client SHALL provide a `FilesystemBrowser` modal component for visually navigating the host filesystem to select a directory.

The component SHALL display:
- Breadcrumb path bar with clickable segments for quick navigation
- Scrollable list of subdirectories with folder icons
- Visual indicators for git repos (`.git` present) and pi projects (`.pi` present)
- ".." entry at the top for parent directory navigation
- "Select" button to confirm the current directory
- "Cancel" button to close without selecting

#### Scenario: Open browser
- **WHEN** the filesystem browser is opened
- **THEN** it SHALL start at the user's home directory and display its subdirectories

#### Scenario: Navigate into subdirectory
- **WHEN** a user clicks a subdirectory entry
- **THEN** the browser SHALL navigate into that directory and display its contents

#### Scenario: Navigate to parent
- **WHEN** a user clicks the ".." entry
- **THEN** the browser SHALL navigate to the parent directory

#### Scenario: Breadcrumb navigation
- **WHEN** the current path is `/home/user/projects/my-app` and the user clicks "projects" in the breadcrumb
- **THEN** the browser SHALL navigate to `/home/user/projects`

#### Scenario: Select directory
- **WHEN** a user clicks the "Select" button
- **THEN** the browser SHALL close and return the current directory path to the caller

#### Scenario: Cancel browsing
- **WHEN** a user clicks "Cancel"
- **THEN** the browser SHALL close without selecting any directory

#### Scenario: Git repo indicator
- **WHEN** a directory entry has `isGit: true`
- **THEN** it SHALL show a visual indicator (e.g., branch icon or colored dot)

#### Scenario: Loading state
- **WHEN** the browser is fetching directory contents
- **THEN** a loading indicator SHALL be shown
