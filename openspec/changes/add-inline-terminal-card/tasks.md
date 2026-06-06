## 1. Shared types & protocol

- [ ] 1.1 Add `ephemeral?: boolean` to `TerminalSession` in `packages/shared/src/terminal-types.ts`
- [ ] 1.2 Add `inline_terminal_open { terminalId }` + `inline_terminal_close { terminalId, transcript }` to the shared event/protocol types

## 2. Extension — trigger

- [ ] 2.1 In `command-handler.ts` `parseCommand`, add bare-`!!` (empty command) branch → new `{ type: "open-inline-terminal" }`; leave `!! <cmd>` and `! <cmd>` paths unchanged
- [ ] 2.2 On open-inline-terminal, spawn ephemeral terminal + emit `inline_terminal_open`
- [ ] 2.3 Unit test: bare `!!` → open path; `!! <cmd>` → bash excludeFromContext; `! <cmd>` → bash to-LLM (no regression)

## 3. Server — PTY + transcript

- [ ] 3.1 `terminal-manager.ts`: honor `ephemeral` flag on spawn
- [ ] 3.2 Capture final ring-buffer transcript at kill time for ephemeral terminals
- [ ] 3.3 Emit / forward `inline_terminal_close { terminalId, transcript }` on close
- [ ] 3.4 Ensure ephemeral terminals are reaped on session teardown

## 4. Client — rendering & lifecycle

- [ ] 4.1 `TerminalView.tsx`: bounded fixed-height variant (no hard `flex-1`); verify FitAddon rows; guard against half-height regression
- [ ] 4.2 `TerminalsView.tsx`: filter out `ephemeral` terminals from the tab bar
- [ ] 4.3 `event-reducer.ts`: add `inlineTerminal` chat role + `inline_terminal_open` / `inline_terminal_close` reducer arms (live vs frozen, update-in-place by `terminalId`)
- [ ] 4.4 Chat message renderer: render live `inlineTerminal` row (bounded `TerminalView`, reattach via `terminalId`) and frozen row (read-only scrollable transcript)
- [ ] 4.5 Composer: add open-inline-terminal button → same open path as bare `!!`

## 5. Reload / replay

- [ ] 5.1 Live + PTY alive → reattach `/ws/terminal/:id` (ring buffer replay)
- [ ] 5.2 Live + PTY dead → best-effort transcript / disconnected notice
- [ ] 5.3 Closed → frozen transcript from `inline_terminal_close`

## 6. Verification

- [ ] 6.1 `npm test` green
- [ ] 6.2 Manual: bare `!!` opens card; run interactive program (REPL / tab-complete); scroll within fixed-height card; close → frozen transcript; reload → card reconstructed
- [ ] 6.3 Confirm ephemeral terminals absent from content-area TerminalsView tabs
- [ ] 6.4 Confirm no terminal output reaches LLM context
