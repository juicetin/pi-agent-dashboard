## ADDED Requirements

### Requirement: Per-session pending image attachments

The chat input SHALL preserve pasted-image attachments on a per-session basis, in-memory, for as long as the application tab is open. Pending images for session `S` SHALL be retained when the user navigates to any view that unmounts the chat area (Settings, OpenSpec preview, file diff view, pi resources view, readme preview, archive browser, terminals view, editor view, or any other `detailPanel` branch) and SHALL be re-displayed when the user returns to the chat view with session `S` selected. Pending images for session `S` SHALL NOT appear in any other session's input.

#### Scenario: Pending images survive navigation to Settings
- **WHEN** the user has pasted a PNG into the chat input for session A and then navigates to the Settings panel
- **THEN** on returning to session A's chat view the input's image preview strip SHALL show that PNG thumbnail

#### Scenario: Pending images survive navigation to a folder terminals view
- **WHEN** the user has pasted an image into the chat input for session A and then navigates to `/folder/<cwd>/terminals`
- **THEN** on returning to session A's chat view the image preview strip SHALL still show the pasted image

#### Scenario: Pending images do not leak between sessions
- **WHEN** the user has pasted an image into the chat input for session A and then switches the active session to session B
- **THEN** session B's chat input SHALL show session B's pending images (empty if none) and SHALL NOT show session A's image

#### Scenario: Sending in session A after switching back does not send to session B
- **WHEN** the user pastes an image while session A is selected, switches to session B, then switches back to session A and presses Send with text
- **THEN** the `send_prompt` message SHALL be addressed to session A and SHALL include the pasted image

#### Scenario: Sending in a different session does not attach another session's images
- **WHEN** the user pastes an image while session A is selected, switches to session B, types text in session B, and presses Send
- **THEN** the `send_prompt` message SHALL be addressed to session B and SHALL contain `images: undefined` (or an empty array)

#### Scenario: Pending images cleared on successful send
- **WHEN** the user sends a message with pasted images attached for session A
- **THEN** session A's pending images SHALL be empty after the send and the preview strip SHALL render no thumbnails

## MODIFIED Requirements

### Requirement: Per-session draft text persistence

The chat input SHALL preserve typed-but-unsent text on a per-session basis. The draft for session `S` SHALL be retained when the user navigates to any view that unmounts the chat area (Settings, OpenSpec preview, file diff view, pi resources view, readme preview, archive browser, or any other `detailPanel` branch) and SHALL be re-displayed when the user returns to the chat view with session `S` selected. The draft for session `S` SHALL NOT appear in any other session's input.

#### Scenario: Draft survives navigation to Settings
- **WHEN** the user has typed "hello world" into the chat input for session A and then navigates to the Settings panel
- **THEN** on returning to session A's chat view the input SHALL contain "hello world"

#### Scenario: Draft does not leak between sessions
- **WHEN** the user has typed "foo" into the chat input for session A and then switches to session B
- **THEN** session B's chat input SHALL show session B's draft (empty if none) and SHALL NOT show "foo"

#### Scenario: Draft survives a page reload
- **WHEN** the user has typed "remember me" into the chat input for session A and then reloads the page
- **THEN** after reconnecting and selecting session A, the chat input SHALL contain "remember me"

#### Scenario: Draft cleared on successful send
- **WHEN** the user sends the current draft text via the Send button or Enter key
- **THEN** the draft for that session SHALL be cleared from both in-memory state and persistent storage

#### Scenario: Pasted images are NOT persisted across page reload
- **WHEN** the user has pasted an image into the input and then reloads the page
- **THEN** the pasted image SHALL NOT be restored after reload (image attachments are kept in-memory only and not written to `localStorage`)
