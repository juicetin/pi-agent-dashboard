## 1. Protocol — shared types

- [ ] 1.1 Add `AttachProposalChangedExtensionMessage` interface in `packages/shared/src/protocol.ts` with fields `type: "attach_proposal_changed"`, `sessionId: string`, `attachedChange: string | null`
- [ ] 1.2 Add the new variant to the `ServerToExtensionMessage` union in the same file
- [ ] 1.3 Build `packages/shared` and confirm no type errors in dependents (`packages/server`, `packages/extension`)

## 2. Bridge — context state

- [ ] 2.1 Add `attachedChange: string | null` (initial value `null`) to `BridgeContext` in `packages/extension/src/bridge-context.ts` and to `createBridgeContext` initialiser
- [ ] 2.2 Mirror the field in the `bc.*` reads/writes block at the top of `packages/extension/src/bridge.ts` (the same site that already reads `bc.sessionId`, `bc.cachedCtx`, etc.)
- [ ] 2.3 Unit test: constructing a fresh `BridgeContext` yields `attachedChange === null`

## 3. Bridge — inbound message handler

- [ ] 3.1 In `packages/extension/src/connection.ts` (or whichever module dispatches inbound `ServerToExtensionMessage` variants), add a `case "attach_proposal_changed":` arm
- [ ] 3.2 Handler SHALL ignore messages whose `sessionId` does not match `bc.sessionId`
- [ ] 3.3 Handler SHALL set `bc.attachedChange = msg.attachedChange` when `sessionId` matches
- [ ] 3.4 Unit test: matching `sessionId` updates `bc.attachedChange`; mismatched `sessionId` leaves it untouched; `null` payload clears it

## 4. Bridge — system-prompt injector module

- [ ] 4.1 Create `packages/extension/src/dashboard-context-injector.ts` exporting `registerDashboardContextInjector(pi, bc): void`
- [ ] 4.2 Inside, register `pi.on("before_agent_start", handler)` returning `{ systemPrompt: spliceContextFragment(event.systemPrompt, pi.sessionId, cwd, bc.attachedChange) }`
- [ ] 4.3 Implement pure `spliceContextFragment(sp, sessionId, cwd, attachedChange)`:
  - Search for the LAST occurrence of `\nCurrent working directory: ` in `sp`.
  - If found, return `sp.slice(0, anchorIndex) + "\n" + buildContextFragment(…)`.
  - If not found (fallback), return `sp + "\n\n" + buildContextFragment(…)`.
  - cwd source: `event.systemPromptOptions?.cwd ?? pi.cwd ?? process.cwd()`.
- [ ] 4.4a Implement pure `buildContextFragment(sessionId, cwd, attachedChange)` returning the exact format:
  ```
  ── pi-dashboard session context ──
  You are pi session <sessionId> running in <cwd>.
  Attached OpenSpec change: <name> (artifacts at openspec/changes/<name>/)
  ```
  Mandatory delimiter + `You are pi session …` line; conditional `Attached OpenSpec change: …` line only when `attachedChange` non-empty; no trailing blank line (caller controls separators).
- [ ] 4.4 Unit-test `buildContextFragment` for the three scenarios: no attach, with attach, post-detach (`null`)
- [ ] 4.5 Unit-test `spliceContextFragment`:
  - Anchor present: returned SP retains everything before `\nCurrent working directory: …` verbatim, replaces from that anchor with the fragment, drops the original cwd line.
  - Anchor absent: returned SP equals input + `\n\n` + fragment.
  - Multiple anchors: only the last is replaced.
- [ ] 4.6 Add repo-lint / version-probe test asserting the anchor `\nCurrent working directory: ` still appears in the installed pi's `dist/core/system-prompt.js`; skip cleanly if pi cannot be resolved from `node_modules`.

## 5. Bridge — wiring into bridge.ts

- [ ] 5.1 In `packages/extension/src/bridge.ts`, call `registerDashboardContextInjector(pi, bc)` from the existing `session_start` re-registration path so it survives pi 0.69+ session reseating on fork/resume
- [ ] 5.2 Confirm via test that after a synthesised `session_start` reason `"fork"` the injector re-registers on the new captured `pi` instance

## 6. Server — dispatch from applyAttachProposal

- [ ] 6.1 In `packages/server/src/browser-handlers/session-meta-handler.ts::applyAttachProposal`, after the existing `session.attachedProposal = changeName` mutation and `session_updated` broadcast, call a new helper `pushAttachProposalChanged(ctx, sessionId, changeName)` that sends `{ type: "attach_proposal_changed", sessionId, attachedChange: changeName }` through `pi-gateway`
- [ ] 6.2 Helper SHALL be a silent no-op when no bridge is connected for `sessionId`
- [ ] 6.3 Verify the same dispatch fires for: WS attach, WS detach (passes `null`), REST attach/detach via `session-api.ts`, and `pendingAttachRegistry.consume` resolution
- [ ] 6.4 Unit test: invoking `applyAttachProposal` with a fake `pi-gateway` records exactly one `attach_proposal_changed` send with the expected payload (mirror the existing bridge test harness pattern — same fake-pi/fake-gateway helpers used by current `*.test.ts` in `packages/extension/src/__tests__/` and `packages/server/src/__tests__/`)

## 7. Server — replay on session_register

- [ ] 7.1 In `packages/server/src/event-wiring.ts`, inside the `pi-gateway.onSessionRegistered` hook, after the existing `pendingAttachRegistry.consume` branch, look up the `DashboardSession` for the registering `sessionId`
- [ ] 7.2 When the consume branch did NOT fire (returned `null`) and `session.attachedProposal` is a non-empty string, send `{ type: "attach_proposal_changed", sessionId, attachedChange: session.attachedProposal }` to the registering bridge
- [ ] 7.3 When the consume branch DID fire, skip the replay (it already covered this case via `applyAttachProposal`)
- [ ] 7.4 Unit test: register-after-restart with `session.attachedProposal === "X"` triggers replay; register with `attachedProposal === null` triggers no replay; register with pending registry intent triggers exactly one push

## 8. Integration tests

- [ ] 8.1 Bridge integration test: end-to-end `before_agent_start` SP — given a synthetic chained SP that ends with `Current date: …\nCurrent working directory: /tmp/x` — produces output that retains the `Current date:` line, drops the original cwd line, and ends with the fragment (delimiter + sessionId/cwd line + attached-change line when set)
- [ ] 8.2 Bridge integration test: post-detach (`attachedChange: null`) the next `before_agent_start` SP omits the attached-change line and no message is injected
- [ ] 8.3 Server integration test: WS `attach_proposal` with a connected bridge results in a recorded `attach_proposal_changed` send
- [ ] 8.4 Server integration test: dashboard-restart simulation (in-memory `DashboardSession.attachedProposal === "X"`) + `session_register` triggers replay push

## 9. Documentation

- [ ] 9.1 Add a row under "Bridge & extension protocol" in `docs/file-index-extension.md` for `dashboard-context-injector.ts` (caveman style — see Documentation Update Protocol in AGENTS.md)
- [ ] 9.2 Add a row in `docs/file-index-shared.md` for the new `AttachProposalChangedExtensionMessage` if its location warrants its own row, otherwise update the existing `protocol.ts` row with a `See change:` annotation
- [ ] 9.3 Update the `proposal-attachment` notes in `docs/file-index-server.md` (existing row for `session-meta-handler.ts`) noting the new pi-gateway dispatch + `event-wiring.ts` replay
- [ ] 9.4 Delegate ALL `docs/` writes to a general-purpose subagent with the caveman-style rule passed verbatim, per AGENTS.md Documentation Update Protocol

## 10. Verification

- [ ] 10.1 Run `npm test` — all existing tests pass; new unit tests pass
- [ ] 10.2 Run `openspec validate inject-session-context-into-agent` — passes
- [ ] 10.3 Manual smoke test: `npm run reload` to refresh bridges, attach a change via UI, send a prompt, confirm the agent's response references the attached change accurately; detach, send another prompt, confirm the agent no longer treats it as attached
- [ ] 10.4 Confirm token-cost-baseline unchanged for sessions with no attach (sessionId/cwd line only adds ~30 tokens/turn — note in commit message)
