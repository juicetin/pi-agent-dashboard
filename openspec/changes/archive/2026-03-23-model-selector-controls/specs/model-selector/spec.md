## ADDED Requirements

### Requirement: Model selector in status bar
The status bar SHALL display the current model name. Clicking it SHALL open an autocomplete dropdown listing all available models.

#### Scenario: Display current model
- **WHEN** a session has a model selected (e.g., "anthropic/claude-4")
- **THEN** the status bar shows the model name on the left side

#### Scenario: Open model dropdown
- **WHEN** user clicks the model name
- **THEN** a dropdown appears with a text filter and scrollable list of available models

#### Scenario: Filter models
- **WHEN** user types in the filter input
- **THEN** the list filters to models matching the query (provider or id)

#### Scenario: Select model
- **WHEN** user clicks a model in the dropdown
- **THEN** a `send_prompt` is sent with text `/model provider/id`
- **AND** the dropdown closes

#### Scenario: No models available
- **WHEN** no models list has been received from the extension
- **THEN** the model name is shown as plain text (not clickable)

### Requirement: Status bar always visible
The status bar SHALL be always visible between ChatView and CommandInput, replacing the WorkingIndicator which only appeared during streaming.

#### Scenario: Idle state
- **WHEN** the session is idle
- **THEN** the status bar shows the model selector on the left, right side is empty

#### Scenario: Streaming state
- **WHEN** the session is streaming
- **THEN** the status bar shows the model selector on the left and working status on the right

### Requirement: Models list from extension
The extension SHALL send a `models_list` message on session_start with all available models from `modelRegistry.getAvailable()`.

#### Scenario: Models sent on session start
- **WHEN** a pi session starts
- **THEN** the extension sends `models_list` with available models

#### Scenario: Browser requests models refresh
- **WHEN** the browser sends `request_models`
- **THEN** the extension responds with `models_list`
