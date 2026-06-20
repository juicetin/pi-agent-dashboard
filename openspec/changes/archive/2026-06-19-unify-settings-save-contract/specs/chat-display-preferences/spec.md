## ADDED Requirements

### Requirement: Per-session View popover retains instant apply; Settings panel defers

The per-session display-preferences popover (the "⚙ View" `ChatViewMenu`) SHALL continue to apply changes instantly via `setSessionDisplayPrefs` on each toggle. The Settings-panel global display-preferences section SHALL NOT apply on each toggle; it SHALL buffer into the Settings draft and persist via the unified Save (see `settings-panel`). The `PATCH /api/preferences/display` endpoint and its `display_prefs_updated` WS broadcast SHALL remain unchanged; only the Settings-panel call timing moves from on-change to on-save.

#### Scenario: View popover still applies instantly
- **GIVEN** a selected session and the ⚙ View popover open
- **WHEN** the user toggles a display-preference axis in the popover
- **THEN** the client SHALL send `setSessionDisplayPrefs { sessionId, override }` immediately
- **AND** the chat view SHALL reflect the change without a separate save step

#### Scenario: Settings-panel display section does not autosave
- **WHEN** the user toggles a global display-preference axis in the Settings panel
- **THEN** no `PATCH /api/preferences/display` SHALL be sent until the user saves
- **AND** the global prefs SHALL persist via the unified Save fan-out
