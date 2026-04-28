## MODIFIED Requirements

### Requirement: Install confirmation dialog supports scope selection
The `PackageInstallConfirmDialog` SHALL accept the following props in addition to its existing props:

- `scope: "global" | "local"` — currently selected scope (controlled by caller).
- `onScopeChange?: (scope: "global" | "local") => void` — change handler; required when `lockScope` is undefined.
- `lockScope?: "global" | "local"` — when set, the dialog SHALL hide the scope radio and use the locked scope unconditionally.

When `lockScope` is undefined, the dialog SHALL render a `Local | Global` radio group above the confirm button. Both options SHALL be selectable; the dialog SHALL NOT preflight whether the source is installable in either scope.

When `lockScope` is set, the dialog SHALL NOT render the radio. The dialog SHALL pass the locked scope to the install action verbatim.

The default value for `scope` SHALL be `props.scope ?? lockScope ?? "global"`.

#### Scenario: Settings caller locks scope to global
- **GIVEN** the dialog is opened from `SettingsPanel` with `lockScope="global"`
- **THEN** the scope radio SHALL NOT be visible
- **AND** confirming SHALL pass `scope: "global"` to the install action

#### Scenario: Pi Resources caller offers radio
- **GIVEN** the dialog is opened from `PiResourcesView` without `lockScope`
- **THEN** the scope radio SHALL be visible with both options
- **AND** the default selection SHALL be `local` (matching the surface's primary scope)
- **AND** the user SHALL be able to switch the selection before confirming

#### Scenario: Confirming with selected scope
- **WHEN** the user picks `Global` and confirms
- **THEN** the install action SHALL receive `scope: "global"` and `cwd: undefined`

- **WHEN** the user picks `Local` and confirms
- **THEN** the install action SHALL receive `scope: "local"` and `cwd: <current cwd>`
