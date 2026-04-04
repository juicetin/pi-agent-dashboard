## ADDED Requirements

### Requirement: First-run detection
The Electron app SHALL detect first-run state by checking whether pi and openspec are installed and whether an API key is configured.

#### Scenario: Fresh machine — nothing installed
- **WHEN** the app launches and neither pi nor openspec is found and no API key exists in `~/.pi/agent/settings.json`
- **THEN** the first-run wizard SHALL be displayed

#### Scenario: Tools installed but no API key
- **WHEN** pi and openspec are found but no API key is configured
- **THEN** the wizard SHALL skip dependency installation and show only the API key step

#### Scenario: Everything configured
- **WHEN** pi, openspec, and API key are all present
- **THEN** the wizard SHALL be skipped and the dashboard loads directly

### Requirement: Dependency installation step
The wizard SHALL show the status of each dependency (pi, openspec) with progress indicators during installation.

#### Scenario: Installing dependencies
- **WHEN** the wizard installs pi and openspec
- **THEN** it SHALL show a progress indicator per dependency with status (checking → installing → installed / failed)

#### Scenario: Installation failure
- **WHEN** a dependency installation fails
- **THEN** the wizard SHALL show the error message and a "Retry" button
- **AND** SHALL allow proceeding to the next step if the failed dependency is openspec (pi is mandatory)

### Requirement: API key configuration step
The wizard SHALL prompt for an LLM API key and write it to pi's settings file.

#### Scenario: User enters API key
- **WHEN** the user enters an API key and clicks "Save"
- **THEN** the wizard SHALL write the key to `~/.pi/agent/settings.json` in the appropriate provider field

#### Scenario: User skips API key
- **WHEN** the user clicks "Skip" on the API key step
- **THEN** the wizard SHALL proceed to launch the dashboard (pi sessions will fail until configured, but the dashboard itself works)

### Requirement: Wizard completion
After all steps complete, the wizard SHALL transition to the dashboard view.

#### Scenario: Successful completion
- **WHEN** all wizard steps are complete (or skipped)
- **THEN** the wizard SHALL close and the dashboard SHALL load normally
