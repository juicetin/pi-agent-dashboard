## ADDED Requirements

### Requirement: pi-flows mirrors TUI registrations as dashboard descriptors

Once Phase 1 (`add-extension-ui-modal`) and Phase 2 (`add-extension-ui-decorations`) of `extension-ui-system` ship, pi-flows (external repo) SHALL listen for the bridge's `ui:list-modules` probe and contribute one descriptor per existing TUI registration. pi-flows SHALL emit `ui:invalidate` on its existing internal change signals so the dashboard re-probes when registrations change. This requirement is satisfied by an external change in the pi-flows repo, tracked via this proposal's coordination checklist.

#### Scenario: Workflow registration becomes breadcrumb decorator

- **WHEN** an extension calls `flow:register-workflow` against pi-flows
- **THEN** pi-flows SHALL push a `breadcrumb` decorator descriptor into the `ui:list-modules` probe payload on the next probe cycle
- **AND** the dashboard SHALL render it via the `BreadcrumbSlot` component without per-extension dashboard code

#### Scenario: Gate registration becomes gate decorator

- **WHEN** an extension calls `flow:register-gate` against pi-flows
- **THEN** pi-flows SHALL push a `gate` decorator descriptor into the probe payload
- **AND** the dashboard SHALL render it via `GateSlot`

#### Scenario: Footer-segment registration becomes footer-segment decorator

- **WHEN** an extension calls `register-footer-segment` against pi-flows
- **THEN** pi-flows SHALL push a `footer-segment` decorator descriptor into the probe payload
- **AND** the dashboard SHALL render it via `FooterSegmentSlot`

#### Scenario: Internal change signal triggers reprobe

- **WHEN** pi-flows fires an internal change signal (`flow:rediscover`, agent state change, gate state change)
- **THEN** pi-flows SHALL emit `ui:invalidate` so the bridge re-runs the probe and the dashboard receives an updated `ui_modules_list`

#### Scenario: pi-judo consumer migration is two lines

- **WHEN** pi-judo continues to register workflows/gates/cards through pi-flows
- **THEN** no pi-judo dashboard code is required beyond an opt-in flag enabling descriptor mirroring
- **AND** pi-judo's existing TUI behavior SHALL remain unchanged
