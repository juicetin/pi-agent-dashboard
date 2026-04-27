## ADDED Requirements

### Requirement: Per-surface image-paste state ownership

Pending pasted images SHALL be scoped per prompt-input surface. For the chat input, the surface SHALL be the active session: pending images SHALL be associated with `sessionId` and SHALL survive any client-side navigation that unmounts and remounts `<CommandInput>`. For the OpenSpec Explore dialog, the surface SHALL be the dialog instance itself: pending images SHALL live and die with the dialog. The shared `useImagePaste()` hook SHALL support both modes — controlled (caller-owned `images` + `onImagesChange`) for the chat-input surface and uncontrolled (hook-internal `useState`) for the Explore dialog.

#### Scenario: Chat input pending images survive route change
- **WHEN** the user pastes an image into the chat input, navigates to `/settings`, and navigates back to the same session
- **THEN** the previously pasted image SHALL still be visible in the chat input's preview strip and SHALL be included in the next `send_prompt`

#### Scenario: Chat input pending images do not leak across sessions
- **WHEN** the user pastes an image into the chat input while session A is selected and then switches to session B
- **THEN** session B's chat input SHALL NOT show session A's image, and a `send_prompt` from session B SHALL NOT include session A's image

#### Scenario: Explore dialog pending images live with the dialog
- **WHEN** the user pastes an image into the Explore dialog, then closes the dialog without sending, then reopens it
- **THEN** the reopened Explore dialog SHALL start with no pending images
