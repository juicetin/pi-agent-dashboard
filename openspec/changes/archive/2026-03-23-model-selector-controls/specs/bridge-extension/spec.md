## ADDED Requirements

### Requirement: Send available models on session start
The bridge extension SHALL read available models from `ctx.modelRegistry.getAvailable()` on session_start and send a `models_list` message.

#### Scenario: Models sent on start
- **WHEN** the session starts
- **THEN** the extension sends `models_list` with all models that have configured API keys

### Requirement: Handle request_models
The bridge extension SHALL handle `request_models` messages by re-reading available models and responding with `models_list`.

#### Scenario: Refresh models
- **WHEN** the extension receives `request_models`
- **THEN** it reads `modelRegistry.getAvailable()` and sends `models_list`
