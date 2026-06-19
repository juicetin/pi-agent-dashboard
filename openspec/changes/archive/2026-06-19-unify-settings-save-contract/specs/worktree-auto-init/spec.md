## MODIFIED Requirements

### Requirement: Auto-init-on-spawn preference
The dashboard SHALL expose a global boolean preference `autoInitWorktreeOnSpawn`,
default `false`, persisted via the preferences store. When absent it SHALL read as
`false`. The Settings-panel toggle SHALL buffer its edit into the Settings draft and
persist only on Save; it SHALL NOT write the preference optimistically on each toggle.

#### Scenario: Preference defaults off
- **WHEN** a fresh install reads `autoInitWorktreeOnSpawn`
- **THEN** the value SHALL be `false`
- **AND** worktree spawn SHALL behave as today (manual Initialize button only)

#### Scenario: Preference toggled in Settings
- **WHEN** the user enables "Initialize on worktree" in Settings and saves from the Save Bar
- **THEN** the server SHALL persist `autoInitWorktreeOnSpawn = true` to `preferences.json`
- **AND** toggling without saving SHALL NOT write the preference
