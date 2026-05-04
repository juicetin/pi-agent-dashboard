## ADDED Requirements

### Requirement: Artifact reader fetches and passes git history to the preview
When the markdown preview is open for an OpenSpec change artifact, the artifact reader (`useOpenSpecReader`) SHALL fetch the git history of the active artifact's file path via `GET /api/file-history` and pass the result to `MarkdownPreviewView` via its `history` prop. The fetch SHALL run in parallel with the artifact content fetch (`Promise.all`), and a fetch failure SHALL NOT block content rendering.

#### Scenario: Single-file artifact (proposal/design/tasks)
- **WHEN** the user clicks the `P` letter on an active change `my-change` and the resolved file path is `openspec/changes/my-change/proposal.md`
- **THEN** the reader SHALL initiate `GET /api/file-history?cwd=<cwd>&path=openspec/changes/my-change/proposal.md` in parallel with `GET /api/file?cwd=<cwd>&path=openspec/changes/my-change/proposal.md`
- **AND** the resolved `FileHistory` SHALL be passed to `MarkdownPreviewView` as the `history` prop

#### Scenario: Multi-file Specs tab
- **WHEN** the user clicks the `S` letter on a change with multiple specs `["auth", "data-export"]`
- **THEN** the reader SHALL initiate one `GET /api/file-history` request per `openspec/changes/<change>/specs/<cap>/spec.md` file in parallel with the existing per-spec content fetches
- **AND** an array of `FileHistory` (one per spec, in the same order as the specs) SHALL be passed to `MarkdownPreviewView` as the `history` prop so the preview renders the aggregate row described in the markdown-preview-view capability

#### Scenario: Archived change artifacts
- **WHEN** the artifact belongs to an archived change `openspec/changes/archive/<changeName>/...`
- **THEN** the history fetch SHALL use the same archived path, and the resolved history SHALL be passed identically to active-change behaviour

#### Scenario: History fetch failure does not block content
- **WHEN** the `/api/file-history` request fails (network error, 5xx, malformed response)
- **THEN** the artifact content SHALL still render normally AND `history` SHALL be `undefined` so the preview suppresses the row gracefully

#### Scenario: Tab change refetches history
- **WHEN** the user switches from the `P` tab to the `D` tab in an open preview
- **THEN** the reader SHALL initiate a fresh `/api/file-history` request for the design artifact's path (the previous proposal-tab history SHALL NOT be reused)

### Requirement: Tasks artifact also receives history
The `tasks.md` artifact tab SHALL receive the same `history` prop wiring as `proposal.md` and `design.md`. Toggling task checkboxes (which writes to disk without committing) SHALL be expected to flip `localChanges` to `true` on the next render.

#### Scenario: Tasks tab shows history row
- **WHEN** the user opens the `T` (tasks) tab on a change `my-change`
- **THEN** the preview SHALL render the history row for `openspec/changes/my-change/tasks.md` if any commit history exists

#### Scenario: Local task toggle reflected after refresh
- **WHEN** the user toggles a task checkbox via the existing toggle endpoint AND subsequently refreshes the artifact
- **THEN** the next history fetch SHALL return `localChanges: true` for `tasks.md`
