## ADDED Requirements

### Requirement: Bridge registers ask_user tool
The bridge extension SHALL register an `ask_user` tool via `pi.registerTool()` during `initBridge()`. The tool SHALL have the same parameters, description, promptSnippet, and promptGuidelines as the current `.pi/extensions/ask-user.ts`. The tool's `execute` method SHALL call `ctx.ui.confirm`, `ctx.ui.select`, `ctx.ui.input`, or `ctx.ui.multiselect` based on the `method` parameter — which are already proxied by the UI proxy to the dashboard.

#### Scenario: ask_user tool registered on init
- **WHEN** `initBridge(pi)` runs
- **THEN** `pi.registerTool()` SHALL be called with `name: "ask_user"`

#### Scenario: ask_user confirm call
- **WHEN** the LLM calls `ask_user` with `method: "confirm"` and `title: "Proceed?"`
- **THEN** the tool SHALL call `ctx.ui.confirm("Proceed?", message)` and return the result

#### Scenario: ask_user select call
- **WHEN** the LLM calls `ask_user` with `method: "select"`, `title: "Pick one"`, and `options: ["A", "B"]`
- **THEN** the tool SHALL call `ctx.ui.select("Pick one", ["A", "B"])` and return the result

### Requirement: Dashboard-spawned sessions override existing ask_user
When `PI_DASHBOARD_SPAWNED` environment variable is set to `"1"`, the bridge SHALL always register the `ask_user` tool, overriding any existing tool with the same name. The dashboard is the primary UI for these sessions and must control the ask_user flow.

#### Scenario: Dashboard-spawned overrides existing tool
- **WHEN** `PI_DASHBOARD_SPAWNED=1` and another extension already registered `ask_user`
- **THEN** the bridge SHALL register `ask_user` anyway, overriding the existing registration

#### Scenario: Dashboard-spawned with no existing tool
- **WHEN** `PI_DASHBOARD_SPAWNED=1` and no `ask_user` tool exists
- **THEN** the bridge SHALL register `ask_user` normally

### Requirement: User-launched sessions respect existing ask_user
When `PI_DASHBOARD_SPAWNED` is not set, the bridge SHALL check `pi.getAllTools()` for an existing `ask_user` tool before registering. If one already exists, the bridge SHALL skip registration to respect the user's custom implementation.

#### Scenario: User-launched with existing custom ask_user
- **WHEN** `PI_DASHBOARD_SPAWNED` is not set and `pi.getAllTools()` contains a tool named `ask_user`
- **THEN** the bridge SHALL NOT register `ask_user`

#### Scenario: User-launched with no existing tool
- **WHEN** `PI_DASHBOARD_SPAWNED` is not set and no `ask_user` tool exists in `pi.getAllTools()`
- **THEN** the bridge SHALL register `ask_user`

### Requirement: Standalone ask_user extension removed
The standalone `.pi/extensions/ask-user.ts` file SHALL be removed from the project. The `ask_user` tool is now provided by the bridge extension.

#### Scenario: File removed
- **WHEN** the project is built
- **THEN** `.pi/extensions/ask-user.ts` SHALL NOT exist
