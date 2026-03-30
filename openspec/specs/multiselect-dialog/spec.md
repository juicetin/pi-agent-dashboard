## ADDED Requirements

### Requirement: ask_user tool supports multiselect method
The `ask_user` tool SHALL accept `multiselect` as a valid `method` value. When `method` is `multiselect`, the tool SHALL require `title` (string) and `options` (string array) parameters. The tool SHALL return the user's selected items as an array of strings.

#### Scenario: LLM calls ask_user with multiselect
- **WHEN** the LLM calls `ask_user` with `method: "multiselect"`, `title: "Pick files"`, and `options: ["a.ts", "b.ts", "c.ts"]`
- **THEN** the tool SHALL present the options to the user and return `User responded: ["a.ts", "c.ts"]` (the items the user selected)

#### Scenario: User selects no options
- **WHEN** the user submits the multiselect dialog without selecting any options
- **THEN** the tool SHALL return `User responded: []` (empty array)

### Requirement: MultiselectRenderer component
The dashboard SHALL include a `MultiselectRenderer` component registered for the `multiselect` method. The renderer SHALL display each option as a toggleable checkbox row. A "Submit" button SHALL confirm the selection.

#### Scenario: Pending multiselect displays checkboxes
- **WHEN** a multiselect dialog is pending
- **THEN** the renderer SHALL display the title, one checkbox per option, and Submit/Cancel buttons

#### Scenario: User toggles and submits
- **WHEN** the user checks "a.ts" and "c.ts" then clicks Submit
- **THEN** the renderer SHALL call `onRespond` with `{ values: ["a.ts", "c.ts"] }`

#### Scenario: User cancels multiselect
- **WHEN** the user clicks Cancel on a pending multiselect
- **THEN** the renderer SHALL call `onCancel`

#### Scenario: Resolved multiselect shows summary
- **WHEN** the multiselect dialog is resolved
- **THEN** the renderer SHALL display a compact summary showing the title and the selected values

#### Scenario: Cancelled multiselect shows cancelled state
- **WHEN** the multiselect dialog was cancelled
- **THEN** the renderer SHALL display the title with "Cancelled" label

### Requirement: UI proxy multiselect forwarding
The UI proxy SHALL forward `multiselect` requests to the dashboard server. For TUI sessions (`hasUI: true`), the proxy SHALL race a TUI input fallback against the dashboard response. For headless sessions, only the dashboard response is awaited.

#### Scenario: TUI fallback presents numbered options
- **WHEN** a multiselect request is made in a TUI session
- **THEN** the proxy SHALL call `ctx.ui.input` with a prompt listing numbered options (e.g., "1. a.ts\n2. b.ts") and instructions to enter comma-separated numbers
- **THEN** the proxy SHALL parse the input and resolve with the corresponding option strings

#### Scenario: Headless session uses dashboard only
- **WHEN** a multiselect request is made in a headless session
- **THEN** the proxy SHALL only await the dashboard response (no TUI fallback)

### Requirement: UI proxy extracts multiselect result
The UI proxy `extractResult` function SHALL handle the `multiselect` method. For resolved responses, it SHALL return the `values` array from the result. For cancelled responses, it SHALL return an empty array.

#### Scenario: Resolved multiselect result extraction
- **WHEN** an `extension_ui_response` arrives for a `multiselect` request with `result: { values: ["a.ts"] }`
- **THEN** `extractResult` SHALL return `["a.ts"]`

#### Scenario: Cancelled multiselect result extraction
- **WHEN** an `extension_ui_response` arrives for a `multiselect` request with `cancelled: true`
- **THEN** `extractResult` SHALL return `[]`
