## 1. Routing: board on a live slot

- [ ] 1.1 In `packages/automation-plugin/package.json`, change the board claim from `{ slot: "command-route", command: "/automation" }` to `{ slot: "shell-overlay-route", component: "AutomationBoard", path: "/folder/:encodedCwd/automations" }`.
- [ ] 1.2 Update `AutomationBoard.tsx` to derive `cwd` from `routeParams.encodedCwd` via `decodeFolderPath`; drop reliance on `session?.cwd`. Accept `onBack`/`onClose`.
- [ ] 1.3 Confirm `routeParams` param name matches the `path` template (`encodedCwd`) against `ShellOverlayRouteSlot` in `dashboard-plugin-runtime`.
- [ ] 1.4 Wrap board body in shell-overlay page chrome (sticky title + back), mirroring the OpenSpec board.

## 2. Sidebar parity re-skin

- [ ] 2.1 Re-skin `FolderAutomationSection.tsx` to `FolderOpenSpecSection` anatomy: 10px uppercase title `AUTOMATIONS (N) →` + `mdiArrowRight`, refresh icon (`mdiRefresh`), `flex-1` spacer, right-aligned `+ New` blue chip.
- [ ] 2.2 Preserve invalid-count `⚠ N` badge and the "render after first load, even at N=0" behavior.
- [ ] 2.3 Navigate the title to `/folder/${encodeFolderPath(folder.cwd)}/automations`; wire `+ New` chip to open `CreateAutomationDialog` directly.
- [ ] 2.4 Add `stopPropagation()` to handlers so the folder collapse trigger is not fired.

## 3. Tests

- [ ] 3.1 Update `FolderAutomationSection.test.tsx`: assert OpenSpec-parity markup (uppercase title, refresh, `+ New` chip) and navigation target `/folder/<enc>/automations`.
- [ ] 3.2 Add a test mounting the `shell-overlay-route` board claim at `/folder/:encodedCwd/automations` and asserting it renders with the decoded cwd.
- [ ] 3.3 `npm test 2>&1 | tee /tmp/pi-test.log` then `grep -nE 'FAIL|Error|✗' /tmp/pi-test.log` → green.

## 4. Docs

- [ ] 4.1 Update `docs/file-index-plugins.md` rows for `FolderAutomationSection.tsx`, `AutomationBoard.tsx`, `package.json` (delegate per Documentation Update Protocol, caveman style).

## 5. Build & verify

- [ ] 5.1 `npm run build` then `curl -X POST http://localhost:8000/api/restart`; reload pi sessions if extension untouched (client-only here).
- [ ] 5.2 Visually confirm sidebar row matches OpenSpec row and the link opens the full board.
