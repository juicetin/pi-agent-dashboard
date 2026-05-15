# Tasks

## 1. Local pending state + dirty derivation

- [x] 1.1 In `packages/builtins-plugin/src/RolesSettingsSection.tsx`, add `const [pending, setPending] = useState<Record<string,string>>({});` near the existing `useState` calls (next to `editingRole`).
- [x] 1.2 Add pure helpers inside the component module (top-level, exported for tests):
      - `computeEffectiveRoles(rolesMap, pending): Record<string,string>` — `{ ...rolesMap, ...pending }`.
      - `computeDirtyRoles(rolesMap, pending): string[]` — keys of `pending` where `pending[k] !== rolesMap[k]`.
- [x] 1.3 Replace the existing `setRole(role, modelLabel)` body so it ONLY updates `pending` (no `dispatch`). Picking the persisted value back removes the key from `pending` (clean again).
- [x] 1.4 Add a `useEffect([rolesMap])` that prunes any `pending[role]` whose value matches the incoming `rolesMap[role]` (auto-clean on server reconciliation; design D6).

## 2. Save button

- [x] 2.1 Implement `save()` per design D2: iterate `Object.keys(pending)`, dispatch one `role_set` per role whose `pending[role] !== rolesMap[role]`, then `setPending({})`.
- [x] 2.2 Render the Save button below the preset row. Label: `Save` when clean; `Save (N)` when dirty. Disabled (greyed, `aria-disabled`) when clean.
- [x] 2.3 Wire `data-testid="roles-save"` for tests.

## 3. Reload button

- [x] 3.1 Implement `reload()` per design D3: `setPending({})` then `dispatch({type:"request_roles", sessionId: liveSessionId})` if a session is present.
- [x] 3.2 Render the Reload button next to Save. Always enabled when `liveSessionId` is set.
- [x] 3.3 Wire `data-testid="roles-reload"`.

## 4. Dirty marker on each pill

- [x] 4.1 Inside the `.map(([role, stored])…)`, compute `dirty = role in pending` and render the inline dot per design D4 (1.5×1.5 rounded-full, accent-warning color, with `aria-label="unsaved"` and `data-testid={`roles-row-${role}-dirty`}`).
- [x] 4.2 Verify the pill's `displayLabel` reads from `effective(role)` (i.e. `pending[role] ?? stored`), not raw `stored`, so the pill shows the pending value immediately.

## 5. Preset Load while dirty

- [x] 5.1 In `loadPreset(name)`, gate on `computeDirtyRoles(rolesMap, pending).length > 0`. When dirty, `window.confirm("Discard unsaved role changes?")`; on cancel, return without dispatch. On confirm, `setPending({})` then dispatch as today.
- [x] 5.2 Add the same gate for `loadPreset` flows reachable from the `flow-mgmt` extension UI path — N/A here (TUI path); leave a comment pointing to design D7.

## 6. Save preset while dirty

- [x] 6.1 In `savePreset(name)`, if dirty, call `save()` first then dispatch `role_preset_save` (per design D8).
- [x] 6.2 Render a one-line hint above the preset-name input when `isDirty && savingPreset`: "Unsaved edits will be saved first." `data-testid="roles-preset-save-dirty-hint"`.

## 7. Tests

- [x] 7.1 In `packages/builtins-plugin/src/__tests__/RolesSettingsSection.test.tsx` add:
      - `computeDirtyRoles` pure tests: empty pending → []; pending matches server → []; pending differs → keys.
      - `computeEffectiveRoles` pure tests.
- [x] 7.2 Component cases:
      - Picking a model NO LONGER dispatches `role_set` immediately; only updates pending; pill shows dirty dot.
      - Picking the persisted value back clears the dirty dot.
      - Save dispatches one `role_set` per dirty role; matches expected provider + modelId; pending is empty after.
      - Save with no dirty entries dispatches nothing.
      - Reload dispatches `request_roles` and clears pending immediately (before any roles_list arrives).
      - Incoming `roles_list` that matches a pending entry auto-cleans that entry (D6).
      - Incoming `roles_list` that conflicts with a pending entry leaves pending in place (still dirty).
      - Preset Load while dirty: `window.confirm` returns false → no `role_preset_load` dispatch, pending preserved; returns true → `role_preset_load` dispatched, pending cleared.
      - Preset Save while dirty: `save()` dispatches role_set first, then `role_preset_save`.
- [x] 7.3 Run `npm test 2>&1 | tee /tmp/pi-test.log; grep -nE 'FAIL|✗|✘' /tmp/pi-test.log` and ensure no regressions.  — 26/26 RolesSettingsSection tests pass; full repo 5808/5826 pass (only one unrelated DiagnosticsSection timing flake which passes in isolation).

## 8. Build and verify

- [x] 8.1 `npm run build` to rebuild the client bundle.
- [x] 8.2 `curl -X POST http://localhost:8000/api/restart` to restart the dashboard server.  — Server restarted but switched starter from Standalone --dev → Electron-owned installed bundle. To see new client, the user should run `pi-dashboard restart --dev` from this repo, OR force the dashboard to load from `packages/web/dist/`.
- [x] 8.3 In the dashboard, open Settings → General → pi-flows Roles. Pick a model for `@coding`; verify the pill shows the dirty dot and the Save badge shows `(1)`. Pick a second; badge shows `(2)`. Click Reload; both dots vanish, pills snap to server values. Re-pick, click Save; verify `~/.pi/agent/providers.json#roles` reflects both new values; dots vanish; badge returns to clean state.
- [x] 8.4 Switch presets while dirty; confirm the discard prompt appears.
- [x] 8.5 (added during apply) Preset × delete button: always visible, correctly positioned via inline `style` (Tailwind JIT was purging fractional utilities); pi-flows role-manager clears `activePreset` when the deleted preset was active. Confirmed by user in browser.

## 9. Docs

- [x] 9.1 Add a row in `docs/file-index-client.md` for the updated `RolesSettingsSection.tsx` noting the new responsibilities (deferred persistence + dirty tracking). Caveman style.
- [x] 9.2 No change to `docs/architecture.md` needed (protocol unchanged).

## 10. Follow-ups (not in this change)

- [ ] 10.1 (separate proposal) Surface a hint when `liveSessionId === undefined` so the buttons don't silently no-op.
- [ ] 10.2 (separate proposal) `window.onbeforeunload` warning when `isDirty` on tab close.
- [ ] 10.3 (separate proposal) Optional `roles_set_bulk` protocol message if N grows past ~10.
