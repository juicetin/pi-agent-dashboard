## ADDED Requirements

### Requirement: Optional history prop renders a git history row under the tab bar
The `MarkdownPreviewView` component SHALL accept an optional `history?: FileHistory | FileHistory[]` prop. When provided AND the resolved render-state is non-suppressed, the component SHALL render a `SpecHistoryRow` directly below the tab bar (or directly below the title row when there is no tab bar). The row SHALL be visually distinct from both the title row and the content area, and SHALL have a fixed height so that the content area's scroll position is not affected by toggling the prop.

#### Scenario: Single FileHistory with kind ok
- **WHEN** `history={ kind: "ok", created, modified, localChanges: false, commitUrlBase: "https://github.com/acme/repo/commit" }` is passed
- **THEN** the row SHALL render `⊕ <created.shortSha> · <relative date> · <author>` and `✎ <modified.shortSha> · <relative date> · <author>` as two pills

#### Scenario: Created and modified are the same commit
- **WHEN** `history.created.sha === history.modified.sha`
- **THEN** the row SHALL collapse to a single pill `⊕✎ <shortSha> · <date> · <author>` instead of repeating the same SHA twice

#### Scenario: Local changes pill
- **WHEN** `history.localChanges === true`
- **THEN** an additional `● modified locally` pill SHALL be appended after the created/modified pills

#### Scenario: SHA copy interaction
- **WHEN** the user clicks a SHA pill AND `commitUrlBase` is `null`
- **THEN** the short SHA SHALL be copied to the clipboard AND a transient "copied" tooltip SHALL appear for ~1 second

#### Scenario: SHA link interaction
- **WHEN** the user clicks a SHA pill AND `commitUrlBase` is a non-empty string
- **THEN** the pill SHALL be an `<a target="_blank" rel="noopener noreferrer">` whose `href` is `<commitUrlBase>/<sha>` and SHALL open the commit page in a new browser tab

#### Scenario: kind uncommitted
- **WHEN** `history={ kind: "uncommitted" }`
- **THEN** the row SHALL render a single `● modified locally` pill (no SHA pills)

#### Scenario: kind noHistory
- **WHEN** `history={ kind: "noHistory" }`
- **THEN** the row SHALL render a muted `no git history` stub

#### Scenario: kind notARepo
- **WHEN** `history={ kind: "notARepo" }`
- **THEN** the row SHALL be suppressed (not rendered at all)

#### Scenario: Array of FileHistory aggregates oldest and newest
- **WHEN** `history` is an array of `FileHistory` of length ≥ 2 containing at least one `kind: "ok"` entry
- **THEN** the row SHALL render an aggregate row whose `created` is the oldest `created.authorDate` across the array and whose `modified` is the newest `modified.authorDate` across the array, with `localChanges` set to `true` if any entry has it set

#### Scenario: Array with all entries notARepo or noHistory
- **WHEN** the array contains no `kind: "ok"` entries
- **THEN** the row SHALL be suppressed

#### Scenario: Prop omitted or undefined
- **WHEN** the `history` prop is omitted or `undefined`
- **THEN** the layout SHALL be identical to the prior behaviour (no row, no extra spacing)

### Requirement: SpecHistoryRow is a standalone component reusable outside MarkdownPreviewView
The dashboard SHALL provide a standalone `SpecHistoryRow` React component accepting a single `history: FileHistory` prop, rendering the same pill row described above. It SHALL be importable independently of `MarkdownPreviewView` so that callers (notably the main `SpecsBrowserView` capability) can render a per-section history above each spec heading without depending on the preview component.

#### Scenario: Component exported from client package
- **WHEN** a consumer imports `SpecHistoryRow` from `@blackbelt-technology/pi-dashboard-web/components/SpecHistoryRow.js`
- **THEN** the import SHALL resolve to a React functional component

#### Scenario: Component does not depend on preview wrapper
- **WHEN** `SpecHistoryRow` is rendered outside any `MarkdownPreviewView` (e.g. inline within `SpecsBrowserView`'s rendered markdown)
- **THEN** the row SHALL render correctly without requiring any context provider beyond the existing `ApiContext`
