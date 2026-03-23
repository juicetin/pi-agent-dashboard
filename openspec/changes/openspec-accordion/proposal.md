## Why

There is no way to manage OpenSpec changes from the dashboard. Users must switch to the terminal to run `/opsx:*` commands. The session cards are also flat — all cards show the same level of detail regardless of selection. Accordion-style cards with an embedded OpenSpec section would let users monitor change progress and trigger workflow actions directly from the dashboard.

## What Changes

- **Accordion session cards**: Selected card expands to show additional detail sections; non-selected cards remain compact
- **OpenSpec section in expanded card**: Shows all openspec changes for the session's project, grouped by status (in-progress / completed), with artifact progress and task counts
- **OpenSpec action buttons**: Continue, FF, Apply, Archive, Explore — each sends the corresponding `/opsx:*` or `/skill:openspec-explore` command as a `send_prompt` to the session
- **Explore dialog**: Modal with multiline text input, sends `/skill:openspec-explore <name>\n<user text>`
- **Quick confirm dialog**: Shown before destructive actions (Archive)
- **Periodic polling**: Extension polls `openspec list --json` + `openspec status --json` every ~30s, sends updates to browser
- **Manual refresh**: Refresh button in OpenSpec section header triggers immediate poll
- **New protocol messages**: `openspec_refresh` (browser→server→extension) and `openspec_update` (extension→server→browser)
- **Conditional display**: OpenSpec section only shown when openspec is initialized for that session's project (non-empty response from CLI)

## Capabilities

### New Capabilities
- `openspec-polling`: Extension periodically polls openspec CLI and forwards change data to the browser via new protocol messages
- `openspec-card-section`: UI component in expanded session card showing openspec changes grouped by status with action buttons
- `openspec-dialogs`: Explore dialog (multiline input) and quick confirm dialog for destructive actions

### Modified Capabilities
- `shared-protocol`: New message types for openspec data flow (openspec_refresh, openspec_update)
- `bridge-extension`: Extension gains openspec polling and refresh handling

## Impact

- **New files**: `OpenSpecSection` component, `ExploreDialog` component, `ConfirmDialog` component, openspec polling logic in extension
- **Modified files**: `SessionCard.tsx` (accordion expand when selected), `bridge.ts` (polling), `command-handler.ts` (refresh handling), `protocol.ts` + `browser-protocol.ts` (new message types), `server.ts`/`browser-gateway.ts` (message routing)
- **Dependencies**: None new — uses existing `spawnSync` for CLI calls
- **Data model**: No changes to `DashboardSession` or `DashboardEvent` — openspec data flows via dedicated messages
