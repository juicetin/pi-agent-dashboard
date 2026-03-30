## MODIFIED Requirements

### Requirement: Confirm renderer
The `ConfirmRenderer` SHALL display the title and message as rendered markdown when pending. The title SHALL use inline markdown (no block elements) in both pending and resolved states. The message SHALL use full markdown rendering. When resolved, it SHALL collapse to a single line showing the title (inline markdown) and result (✅ Allowed or ❌ Denied).

#### Scenario: Pending confirm display
- **WHEN** a confirm request is pending with title `"Allow **dangerous** operation?"` and message `"This will:\n- Delete files\n- Reset config"`
- **THEN** the renderer SHALL render the title with bold formatting and the message as a markdown list

#### Scenario: Clicking Allow
- **WHEN** the user clicks [Allow]
- **THEN** the renderer SHALL call `onRespond({ confirmed: true })`

#### Scenario: Resolved confirm display
- **WHEN** a confirm request is resolved with `confirmed: true` and title `"Allow **dangerous** operation?"`
- **THEN** the renderer SHALL show a compact card with the title rendered as inline markdown and "✅ Allowed"

### Requirement: Select renderer
The `SelectRenderer` SHALL display the title as rendered markdown when pending and as inline markdown when resolved. When resolved, it SHALL show the selected value.

#### Scenario: Pending select display
- **WHEN** a select request is pending with title `"Choose a `format`"` and `options: ["JSON", "YAML"]`
- **THEN** the renderer SHALL render the title with code formatting and show a button for each option

#### Scenario: Clicking an option
- **WHEN** the user clicks option "JSON"
- **THEN** the renderer SHALL call `onRespond({ value: "JSON" })`

#### Scenario: Resolved select display
- **WHEN** a select request is resolved with `value: "JSON"` and title containing markdown
- **THEN** the renderer SHALL show a compact card with the title rendered as inline markdown and the selected value

### Requirement: Input renderer
The `InputRenderer` SHALL display the title as rendered markdown when pending and as inline markdown when resolved. When resolved, it SHALL show the entered value.

#### Scenario: Pending input display
- **WHEN** an input request is pending with title `"Enter the **project name**"`
- **THEN** the renderer SHALL render the title with bold formatting and show a text input with submit button

#### Scenario: Submitting input
- **WHEN** the user types "hello" and clicks [Submit]
- **THEN** the renderer SHALL call `onRespond({ value: "hello" })`

#### Scenario: Resolved input display
- **WHEN** an input request is resolved with `value: "hello"` and title containing markdown
- **THEN** the renderer SHALL show a compact card with the title rendered as inline markdown and the entered value

### Requirement: Multiselect renderer
The `MultiselectRenderer` SHALL display the title as rendered markdown when pending and as inline markdown when resolved.

#### Scenario: Pending multiselect display
- **WHEN** a multiselect request is pending with title containing markdown
- **THEN** the renderer SHALL render the title with markdown formatting and show checkboxes for each option

#### Scenario: Resolved multiselect display
- **WHEN** a multiselect request is resolved with selected values and title containing markdown
- **THEN** the renderer SHALL show a compact card with the title rendered as inline markdown and the selected values

## ADDED Requirements

### Requirement: Inline markdown component for interactive renderers
The interactive renderers SHALL use a shared `InlineMarkdown` component for rendering titles in compact/resolved states. This component SHALL render markdown restricted to inline elements only (`strong`, `em`, `code`, `a`) using `ReactMarkdown` with `allowedElements` and `unwrapDisallowed` to prevent block elements from breaking the single-line layout.

#### Scenario: Inline markdown renders bold and code
- **WHEN** `InlineMarkdown` receives content `"Allow **dangerous** \`rm -rf\` command?"`
- **THEN** it SHALL render `dangerous` as bold and `rm -rf` as inline code, without wrapping in `<p>` or other block elements

#### Scenario: Inline markdown strips block elements
- **WHEN** `InlineMarkdown` receives content containing a markdown list or heading
- **THEN** it SHALL strip the block elements and render only the text content inline
