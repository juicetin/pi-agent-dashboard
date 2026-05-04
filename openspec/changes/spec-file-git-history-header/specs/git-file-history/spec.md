## ADDED Requirements

### Requirement: GET /api/file-history endpoint returns first and last commit metadata
The dashboard server SHALL expose a `GET /api/file-history` route that accepts `cwd` and `path` query parameters and returns a `FileHistory` discriminated union representing the file's git provenance inside `cwd`'s git work tree. The route SHALL be auth-gated by the same `networkGuard` used by `/api/file*` routes.

#### Scenario: File with full history
- **WHEN** `GET /api/file-history?cwd=/repo&path=openspec/specs/auth/spec.md` is called against a git work tree where the file was first added in commit `a3f21c0` by `Alice <alice@example.com>` on 2026-04-01 and last modified in commit `8b9d041` by `Bob <bob@example.com>` on 2026-04-25
- **THEN** the response body SHALL be `{ success: true, data: { kind: "ok", created: { sha: "a3f21c0…", shortSha: "a3f21c0", author: "Alice", authorEmail: "alice@example.com", authorDate: "2026-04-01T…Z", subject: "<commit subject>" }, modified: { sha: "8b9d041…", shortSha: "8b9d041", author: "Bob", authorEmail: "bob@example.com", authorDate: "2026-04-25T…Z", subject: "<commit subject>" }, localChanges: false, commitUrlBase: <string|null> } }`

#### Scenario: File with uncommitted local edits
- **WHEN** the requested path has been committed previously AND `git status --porcelain -- <path>` returns non-empty output
- **THEN** the response SHALL set `data.localChanges` to `true` while still returning the last committed `created` and `modified` info

#### Scenario: File never committed
- **WHEN** the requested path exists on disk but `git log -- <path>` returns no commits (e.g. brand-new untracked file)
- **THEN** the response SHALL be `{ success: true, data: { kind: "uncommitted" } }`

#### Scenario: Path with no history (deleted/missing)
- **WHEN** the requested path does not exist on disk AND has no commit history
- **THEN** the response SHALL be `{ success: true, data: { kind: "noHistory" } }`

#### Scenario: cwd is not a git work tree
- **WHEN** `cwd` is a directory outside any git work tree
- **THEN** the response SHALL be `{ success: true, data: { kind: "notARepo" } }` and SHALL NOT return an HTTP error

#### Scenario: Missing query parameters
- **WHEN** `cwd` or `path` is missing from the query string
- **THEN** the response SHALL be HTTP 400 with `{ success: false, error: "Missing cwd" }` or `{ success: false, error: "Missing path" }`

#### Scenario: Path traversal attempt
- **WHEN** the resolved `<cwd>/<path>` is outside `cwd` (e.g. `path=../../etc/passwd`)
- **THEN** the response SHALL be HTTP 400 with `{ success: false, error: "Path traversal not allowed" }`

#### Scenario: Network guard rejects untrusted host
- **WHEN** the request originates from a host not allowed by the network guard
- **THEN** the request SHALL be rejected with HTTP 403 by the existing guard, identical to other `/api/*` routes

### Requirement: Git recipes for file creation and last-modification commits
The shared `platform/git.ts` module SHALL register two new recipes — `GIT_LOG_FILE_CREATED` and `GIT_LOG_FILE_LATEST` — alongside matching public functions `fileCreated(input)` and `fileLatest(input)` whose return shape is `Result<CommitInfo | undefined>`. Both recipes SHALL execute via the existing `run(recipe, input)` runner and SHALL NOT introduce shell-string interpolation, `child_process` imports, or `process.platform` branches.

#### Scenario: Recipe argv shape for created
- **WHEN** `GIT_LOG_FILE_CREATED` is invoked with `{ cwd, path: "specs/auth/spec.md" }`
- **THEN** its `argv` function SHALL return `["git", "log", "--diff-filter=A", "--follow", "--reverse", "--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s", "--", "specs/auth/spec.md"]`

#### Scenario: Recipe argv shape for latest
- **WHEN** `GIT_LOG_FILE_LATEST` is invoked with `{ cwd, path: "specs/auth/spec.md" }`
- **THEN** its `argv` function SHALL return `["git", "log", "-1", "--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s", "--", "specs/auth/spec.md"]`

#### Scenario: Parser handles null-byte-delimited record
- **WHEN** the recipe receives stdout `"a3f21c0deadbeef\0a3f21c0\0Alice\0alice@example.com\02026-04-01T12:34:56Z\0Initial spec for auth\n"`
- **THEN** the parser SHALL return `{ sha: "a3f21c0deadbeef", shortSha: "a3f21c0", author: "Alice", authorEmail: "alice@example.com", authorDate: "2026-04-01T12:34:56Z", subject: "Initial spec for auth" }`

#### Scenario: Parser tolerates CRLF line endings
- **WHEN** the recipe receives the same record terminated with `\r\n` instead of `\n`
- **THEN** the parser SHALL return the same `CommitInfo` object (the trailing `\r` is stripped before splitting fields)

#### Scenario: Parser returns undefined on empty output
- **WHEN** the recipe receives empty stdout (e.g. file has no commit history)
- **THEN** the parser SHALL return `undefined`

#### Scenario: Recipe takes only the first record on multi-line output
- **WHEN** `GIT_LOG_FILE_CREATED` receives multi-record output from `--reverse` (the chronologically-first record on line 1, followed by additional records the parser must ignore)
- **THEN** the parser SHALL split on `\n` and parse only the first non-empty line

#### Scenario: Tolerated exit code 128
- **WHEN** `git log` exits with code 128 (e.g. `cwd` is not a git work tree, ambiguous argument)
- **THEN** the recipe SHALL tolerate the exit code and the wrapping caller in the route SHALL return `{ kind: "notARepo" }` or `{ kind: "noHistory" }` accordingly

### Requirement: FileHistory type is shared between server and client
The `FileHistory` discriminated union and its `CommitInfo` member type SHALL live in a shared file (`packages/shared/src/file-history-types.ts`) and SHALL be imported by both the server route handler and the client fetch helper. No equivalent type SHALL be redefined in the client.

#### Scenario: Type is exported from shared package
- **WHEN** a consumer imports `FileHistory` from `@blackbelt-technology/pi-dashboard-shared/file-history-types.js`
- **THEN** the import SHALL resolve to a discriminated union of `{ kind: "ok"; … } | { kind: "uncommitted" } | { kind: "noHistory" } | { kind: "notARepo" }`

#### Scenario: Server response payload matches the shared type
- **WHEN** the server route returns a `FileHistory`
- **THEN** the JSON-serialised payload SHALL match the TypeScript type exactly with no additional or renamed fields

### Requirement: Local-changes detection scopes to the requested path
When determining `localChanges` for a `kind: "ok"` response, the server SHALL invoke `git status --porcelain -- <path>` (path-scoped, never bare). Any non-empty output for the path SHALL set `localChanges: true`.

#### Scenario: Path-scoped status invocation
- **WHEN** computing `localChanges` for `path = "openspec/specs/auth/spec.md"`
- **THEN** the server SHALL invoke `git status --porcelain -- openspec/specs/auth/spec.md` and SHALL NOT invoke a bare `git status`

#### Scenario: Untracked file maps to uncommitted
- **WHEN** `git status --porcelain -- <path>` outputs `?? <path>` AND `git log -- <path>` is empty
- **THEN** the response SHALL be `{ kind: "uncommitted" }`, not `{ kind: "ok", localChanges: true }`

#### Scenario: Modified-but-tracked file
- **WHEN** `git status --porcelain -- <path>` outputs ` M <path>` AND the file has commit history
- **THEN** the response SHALL be `{ kind: "ok", …, localChanges: true }`

### Requirement: Commit URL base is included for recognised remote hosts
When the request resolves to `kind: "ok"`, the response SHALL include `commitUrlBase: string | null`. The base URL SHALL be derived by parsing the cwd's `origin` remote via the existing `git-link-builder.ts::parseRemoteUrl`, and the path SHALL match the host's commit-URL convention (`/<user>/<repo>/commit` for github / sourcehut / gitea / codeberg, `/<user>/<repo>/-/commit` for gitlab, `/<user>/<repo>/commits` for bitbucket). The client SHALL construct the full URL by appending the commit's `sha`.

#### Scenario: GitHub remote
- **WHEN** the cwd's origin remote is `https://github.com/acme/repo.git`
- **THEN** `commitUrlBase` SHALL be `"https://github.com/acme/repo/commit"` and the client SHALL render the SHA as a link to `https://github.com/acme/repo/commit/<sha>`

#### Scenario: GitLab remote
- **WHEN** the cwd's origin remote is `git@gitlab.com:acme/repo.git`
- **THEN** `commitUrlBase` SHALL be `"https://gitlab.com/acme/repo/-/commit"`

#### Scenario: Unknown remote host
- **WHEN** the cwd's origin remote is `git@internal.example:acme/repo.git` and the host is not in the recognised platform set
- **THEN** `commitUrlBase` SHALL be `null` and the client SHALL render the SHA as a copy-only button (no anchor)

#### Scenario: No origin remote
- **WHEN** `git remote get-url origin` exits non-zero or returns empty
- **THEN** `commitUrlBase` SHALL be `null`
