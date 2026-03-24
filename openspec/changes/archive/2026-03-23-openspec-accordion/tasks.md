## 1. Shared Types & Protocol

- [x] 1.1 Define `OpenSpecChange` and `OpenSpecData` types in `src/shared/types.ts`
- [x] 1.2 Add `openspec_update` message to extension→server protocol (`src/shared/protocol.ts`)
- [x] 1.3 Add `openspec_refresh` message to server→extension protocol (`src/shared/protocol.ts`)
- [x] 1.4 Add `openspec_update` message to server→browser protocol (`src/shared/browser-protocol.ts`)
- [x] 1.5 Add `openspec_refresh` message to browser→server protocol (`src/shared/browser-protocol.ts`)

## 2. Extension Polling

- [x] 2.1 Create `src/extension/openspec-poller.ts` — runs `openspec list --json` + `openspec status --change <name> --json`, returns `OpenSpecData`, handles CLI errors gracefully
- [x] 2.2 Write tests for openspec-poller: success, CLI not found, project not initialized, parse errors
- [x] 2.3 Integrate poller into `bridge.ts` — poll on session_start, every 30s, send `openspec_update` only on data change
- [x] 2.4 Handle `openspec_refresh` in `command-handler.ts` — run poller immediately and return `openspec_update`

## 3. Server Message Routing

- [x] 3.1 Route `openspec_update` from extension to subscribed browsers in `pi-gateway.ts` / `browser-gateway.ts`
- [x] 3.2 Route `openspec_refresh` from browser to extension in `browser-gateway.ts`

## 4. Client State Management

- [x] 4.1 Add `openspecMap: Map<string, OpenSpecData>` state in `App.tsx`, updated on `openspec_update` messages
- [x] 4.2 Add `onOpenSpecRefresh(sessionId)` callback that sends `openspec_refresh` to server
- [x] 4.3 Pass `openspecData` and callbacks through `SessionList` to `SessionCard`

## 5. Accordion Card

- [x] 5.1 Update `SessionCard` to render expanded section when selected (smooth CSS transition)
- [x] 5.2 Write tests for accordion expand/collapse behavior

## 6. OpenSpec Section Component

- [x] 6.1 Create `OpenSpecSection` component — shows changes grouped by status (in-progress / completed), action buttons, refresh button, "+ New Change"
- [x] 6.2 Write tests for OpenSpecSection: renders changes, correct buttons per status, calls onSendPrompt with correct text
- [x] 6.3 Integrate `OpenSpecSection` into `SessionCard` expanded area

## 7. Dialogs

- [x] 7.1 Create `ConfirmDialog` component — generic confirm modal with message, cancel/confirm buttons
- [x] 7.2 Create `ExploreDialog` component — modal with multiline textarea, sends `/skill:openspec-explore <name>\n<text>`
- [x] 7.3 Write tests for ConfirmDialog and ExploreDialog
- [x] 7.4 Wire Archive button to ConfirmDialog, Explore button to ExploreDialog in OpenSpecSection
