## ADDED Requirements

### Requirement: Failed ask_user tool calls do not auto-expand

The `ToolCallStep` component SHALL NOT default to the expanded state for `ask_user` tool calls whose `status === "error"`. Pending and completed `ask_user` calls SHALL continue to auto-expand (so the dialog or answer is visible). The collapsed failure row SHALL still show the error status icon and the `getSummary(toolName, args)` label, and the user SHALL be able to click to expand and inspect the raw error.

#### Scenario: Errored ask_user renders collapsed

- **WHEN** a tool call arrives with `toolName === "ask_user"` and `status === "error"`
- **THEN** `ToolCallStep` SHALL render with `expanded = false` by default

#### Scenario: Pending ask_user still auto-expands

- **WHEN** a tool call arrives with `toolName === "ask_user"` and `status === "running"` (pending dialog)
- **THEN** `ToolCallStep` SHALL render with `expanded = true` by default

#### Scenario: Completed ask_user still auto-expands

- **WHEN** a tool call arrives with `toolName === "ask_user"` and `status === "complete"`
- **THEN** `ToolCallStep` SHALL render with `expanded = true` by default (showing the user's answer)

#### Scenario: Errored ask_user remains click-expandable

- **WHEN** the user clicks the collapsed header of an errored `ask_user` row
- **THEN** the step SHALL expand and display the full error payload via the tool renderer
