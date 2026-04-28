## ADDED Requirements

### Requirement: Server moves packages between scopes via hybrid execution
The server SHALL expose `POST /api/packages/move` accepting:

```
{
  entry:     string | { source: string, ...filters },
  fromScope: "global" | "local",
  fromCwd?:  string,    // required if fromScope === "local"
  toScope:   "global" | "local",
  toCwd?:    string     // required if toScope === "local"
}
```

The endpoint SHALL execute the move using a hybrid strategy keyed on `parseSourceKind(entry.source)`:

- For source kinds `npm:`, `git:`, and `https://`, the server SHALL:
  1. Install the package at `toScope` (and `toCwd` if local) using pi's `installAndPersist` via the existing `package-manager-wrapper`, with session reload suppressed.
  2. On install success, remove the package from `fromScope` (and `fromCwd` if local) using `removeAndPersist`.
  3. Trigger session reload exactly once after the remove phase.
- For source kinds `abs-path` and `rel-path`, the server SHALL:
  1. Read both `settings.json` files via pi's settings APIs.
  2. Compute a destination-appropriate source string (absolute when `toScope === "global"`; relative-to-toCwd when `toScope === "local"` and the relative form does not escape the cwd subtree by more than 2 levels).
  3. Splice the (rewritten) entry into the destination `packages[]` and remove from origin `packages[]`.
  4. Atomically write both `settings.json` files.
  5. Trigger session reload once.

The endpoint SHALL preserve the entire original entry verbatim (including filter object form with `extensions`/`skills`/`prompts`/`themes` keys) across the move, replacing only the `source` field when path-rewriting.

The endpoint SHALL return `202 { moveId, phases }` on success, where `phases` is `["install","remove"]` for the npm/git/https arm and `["settings-edit"]` for the path arm.

#### Scenario: Move npm package from global to local
- **WHEN** client sends `POST /api/packages/move` with `{ entry: "npm:pi-flows", fromScope: "global", toScope: "local", toCwd: "/abs/cwd" }`
- **THEN** the server installs `npm:pi-flows` at `/abs/cwd/.pi/settings.json`
- **AND** removes `npm:pi-flows` from `~/.pi/agent/settings.json`
- **AND** returns `202` with `phases: ["install","remove"]`
- **AND** triggers exactly one session reload

#### Scenario: Move git package preserving pinned ref
- **WHEN** client sends `POST /api/packages/move` with `entry: "git:github.com/x/y@v1.2.3"`
- **THEN** both phases use the verbatim source string `git:github.com/x/y@v1.2.3`
- **AND** the destination `packages[]` entry retains the `@v1.2.3` pin

#### Scenario: Move filtered package preserves filters
- **WHEN** client sends `POST /api/packages/move` with `entry: { source: "npm:my-pkg", extensions: ["a.ts"], skills: [] }`
- **THEN** the destination `packages[]` entry is identical to the input entry except for any path-rewriting of `source`
- **AND** the `extensions` and `skills` filter arrays are preserved verbatim

#### Scenario: Move relative-path package to global resolves absolute
- **WHEN** client sends `POST /api/packages/move` with `entry: { source: ".." }, fromScope: "local", fromCwd: "/abs/project", toScope: "global"`
- **THEN** the server computes the destination source as the absolute path `/abs` (resolving `..` against `/abs/project/.pi/settings.json` location)
- **AND** writes only to settings; no file copy occurs

#### Scenario: Move absolute-path package to local with relative form
- **WHEN** client sends `POST /api/packages/move` with `entry: { source: "/abs/project/vendor/x" }, toScope: "local", toCwd: "/abs/project"`
- **THEN** the server computes the destination source as `./vendor/x` (relative to `/abs/project/.pi/settings.json`)
- **AND** writes only to settings; no file copy occurs

#### Scenario: Move absolute-path package to local across volumes keeps absolute
- **WHEN** the relative form would require `../../...` escaping the cwd tree by more than 2 levels
- **THEN** the destination source remains absolute

### Requirement: Move endpoint rejects already-at-destination via identity preflight
The server SHALL compute package identity using pi's dedup rules:

- `npm:<spec>` identity = bare package name (with scope, without `@version`).
- `git:<url>` / `https://<url>` identity = repository URL with `@<ref>` stripped.
- Path source identity = resolved absolute path.

Before invoking install or settings-edit, the server SHALL check whether any entry in `toScope`'s `packages[]` has the same identity. If so, the server SHALL return `409 already_at_destination` with no side effects.

#### Scenario: Already at destination returns 409
- **GIVEN** `~/.pi/agent/settings.json` already contains `npm:pi-flows`
- **WHEN** client sends a move from local to global for `npm:pi-flows`
- **THEN** the server returns `409 already_at_destination` and performs no install or remove

### Requirement: Move endpoint surfaces partial success
When the npm/git/https execution arm successfully installs at the destination but fails to remove from the origin, the server SHALL return `207 partial_success` with the response body:

```
{
  moveId,
  installed: true,
  removed: false,
  removeError: <message>,
  recoveryAction: {
    endpoint: "POST /api/packages/remove",
    body: { source: <entry.source>, scope: <fromScope>, cwd: <fromCwd> }
  }
}
```

The recovery action SHALL be idempotent — re-running it on an already-removed entry SHALL succeed as a no-op.

#### Scenario: Install succeeds, remove fails
- **WHEN** install at destination completes, but `removeAndPersist` throws
- **THEN** the server returns `207` with `installed: true, removed: false`
- **AND** the response includes a `recoveryAction` body that the client can POST to retry the remove

### Requirement: Move endpoint emits composite progress events
For an `npm:`/`git:`/`https://` move, the server SHALL emit `package_operation_*` WebSocket events for both the install phase and the remove phase, each tagged with the same optional `moveId: string` field. For a path-source move, the server SHALL emit a single `settings-edit` progress event tagged with `moveId`.

Existing consumers that ignore the `moveId` field SHALL continue to render install + remove as two separate progress operations without breakage.

#### Scenario: Composite events share moveId
- **WHEN** a successful npm-source move completes
- **THEN** at least one `package_operation_*` event for the install phase contains `moveId: <id>`
- **AND** at least one event for the remove phase contains the same `moveId: <id>`

### Requirement: Move endpoint validates scope and cwd inputs
The server SHALL return `400 invalid_request` when:

- `fromScope === toScope`
- `fromScope === "local"` and `fromCwd` is missing or not a string
- `toScope === "local"` and `toCwd` is missing or not a string
- `entry` is missing or not a string/object with a `source` string

The server SHALL return `400 unsupported_source_for_destination` when a relative-path source cannot be resolved (e.g., `fromCwd` not provided for a relative-path move).

#### Scenario: Same-scope move rejected
- **WHEN** client sends `fromScope: "global", toScope: "global"`
- **THEN** server returns `400 invalid_request`

#### Scenario: Local move missing cwd rejected
- **WHEN** client sends `toScope: "local"` without `toCwd`
- **THEN** server returns `400 invalid_request`
