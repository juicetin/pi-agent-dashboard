## Why

The `ask_user` interactive UI cards display title and message text as plain text, but the LLM frequently sends markdown content (bold, code blocks, lists). Additionally, the `ask_user` tool requires a separate `.pi/extensions/ask-user.ts` file per project, when it could be bundled into the bridge extension that's already installed globally.

## What Changes

- Render `title` and `message` fields in interactive UI renderers (confirm, select, input, multiselect) as markdown instead of plain text
- Move the `ask_user` tool registration from the standalone `.pi/extensions/ask-user.ts` file into the bridge extension (`src/extension/bridge.ts`), so it's automatically available in every pi session that has the dashboard bridge installed
- Collision avoidance strategy using the existing `PI_DASHBOARD_SPAWNED` env var:
  - **Dashboard-spawned sessions** (`PI_DASHBOARD_SPAWNED=1`): Always register `ask_user`, overriding any existing TUI tool — the dashboard is the primary UI for these sessions
  - **User-launched pi** (no env var): Only register `ask_user` if no other extension already provides it — respect user's own custom implementation

## Capabilities

### New Capabilities
_(none)_

### Modified Capabilities
- `interactive-ui-dialogs`: Add markdown rendering to title and message fields in interactive renderers
- `bridge-extension`: Register the `ask_user` tool directly within the bridge extension with conditional override based on `PI_DASHBOARD_SPAWNED`

## Impact

- **Client renderers**: `ConfirmRenderer`, `SelectRenderer`, `InputRenderer`, `MultiselectRenderer` — replace plain text `<span>` with markdown renderer for title/message
- **Bridge extension**: `src/extension/bridge.ts` — add `registerTool` call for `ask_user` with `PI_DASHBOARD_SPAWNED`-aware collision logic
- **Deprecated file**: `.pi/extensions/ask-user.ts` — can be removed after migration
- **Dependencies**: May need to reuse existing markdown rendering component from chat view
