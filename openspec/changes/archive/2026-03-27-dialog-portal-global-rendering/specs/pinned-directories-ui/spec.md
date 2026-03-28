## MODIFIED Requirements

### Requirement: Manual pin dialog
Users SHALL be able to pin a directory path that is not currently visible in the sidebar. The dialog SHALL render via DialogPortal at document.body with z-[60].

#### Scenario: Open pin dialog
- **WHEN** a user clicks the "Pin directory" action (e.g., a button in the sidebar header area)
- **THEN** a dialog SHALL appear with a text input for entering a directory path
- **AND** the dialog is rendered at document.body via DialogPortal

#### Scenario: Pin directory from dialog
- **WHEN** a user enters a path and confirms in the pin dialog
- **THEN** the directory SHALL be pinned and appear in the pinned section
