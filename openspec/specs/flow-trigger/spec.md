# flow-trigger Specification

## Purpose

Provides UI for discovering and launching pi-flows from the dashboard: in-card flow launcher when a session reports available flows, task-input dialog, and a session-content-header trigger.

## Requirements

### Requirement: Flow launcher in session card
When a session has available flows, the session card SHALL display a flow launcher section allowing the user to select and start a flow.

#### Scenario: Flows detected from flows_list
- **WHEN** the session's `flows` array (from `flows_list` message) contains one or more entries
- **THEN** the session card SHALL show a flow launcher section

#### Scenario: No flows available
- **WHEN** the session's `flows` array is empty or absent
- **THEN** no flow launcher section SHALL be displayed

### Requirement: Task input dialog before launch
Selecting a flow to run SHALL open a dialog with a text input for the task/context. The dialog SHALL show the flow name and description. Submitting the dialog SHALL dispatch `send_prompt` with `/<flow-name> <task>`.

#### Scenario: Launch flow with task
- **WHEN** the user selects a flow and enters a task in the dialog
- **THEN** a `send_prompt` message SHALL be sent with text `/<flowName> <task>`

#### Scenario: Launch flow without task
- **WHEN** the user selects a flow and submits with empty task
- **THEN** a `send_prompt` message SHALL be sent with text `/<flowName>` (pi-flows will prompt for task if `task_required` is set)

#### Scenario: Cancel flow launch
- **WHEN** the user cancels the task input dialog
- **THEN** no message SHALL be sent

### Requirement: Flow launcher also available in content area header
The flow launcher SHALL also be accessible from the session content area header via a "▶ Flow" button. Clicking it SHALL open the same `SearchableSelectDialog` followed by the `FlowLaunchDialog`.

#### Scenario: Launch from content header
- **WHEN** the user clicks the "▶ Flow" button in the session header
- **AND** the session's `flows` array contains one or more entries
- **THEN** a searchable flow picker dialog SHALL appear, followed by a task input dialog on selection

#### Scenario: Flow button hidden when no flows
- **WHEN** the session's `flows` array is empty or absent
- **THEN** the "▶ Flow" button SHALL NOT be displayed

### Requirement: Dashboard does not register flow slash commands

The dashboard plugin manifest for `@blackbelt-technology/pi-dashboard-flows-plugin` SHALL NOT claim the `command-route` slot for any of `/flows`, `/flows:new`, `/flows:edit`, `/flows:delete`. All flow operations in the dashboard SHALL be driven by button UI (`SessionFlowActions` subcard for list/new, `FlowDashboard` Abort button, edit/delete buttons inside the launch dialog).

This SHALL NOT affect `pi-flows`'s own registration of these commands at the pi-extension level — slash commands MUST remain available in the TUI and any standalone pi-flows host. The dashboard simply chooses not to surface them.

Rationale: dashboard interaction is button-first; slash commands duplicate functionality that is already exposed as buttons and create discoverability noise in autocomplete.

#### Scenario: Manifest contains no flow command-route claims

- **WHEN** the dashboard plugin loader discovers `@blackbelt-technology/pi-dashboard-flows-plugin`
- **THEN** the loaded manifest's `claims[]` SHALL NOT contain any entry with `slot: "command-route"` and `command` starting with `/flows`

#### Scenario: TUI still has slash commands

- **WHEN** a user runs pi-flows standalone in TUI mode
- **THEN** typing `/flows:new` SHALL invoke the pi-flows-registered command exactly as before (pi-flows code path unchanged)

#### Scenario: Dashboard new-flow flows through button

- **WHEN** the user wants to start a new flow in the dashboard
- **THEN** the user SHALL click the "New flow" button rendered by `SessionFlowActions`, which opens `FlowLaunchDialog`, which submits the prompt over the existing prompt channel

#### Scenario: Dashboard abort flows through button

- **WHEN** a flow is running in the dashboard and the user wants to abort
- **THEN** the user SHALL click the Abort button rendered by `FlowDashboard`, which dispatches `flow_control { action: "abort" }` over the existing WebSocket
