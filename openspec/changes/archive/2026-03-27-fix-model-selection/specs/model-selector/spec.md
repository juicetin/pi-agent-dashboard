## MODIFIED Requirements

### Requirement: Select model
- **WHEN** user clicks a model in the dropdown
- **THEN** a `set_model` message SHALL be sent with `{ provider, modelId }` extracted from the selected model string
- **AND** the dropdown closes

_Previously sent a `send_prompt` with `/model provider/id` text, which only works in the TUI._
