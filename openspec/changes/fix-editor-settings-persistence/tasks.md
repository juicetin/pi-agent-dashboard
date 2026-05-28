## 1. Implementation

- [ ] 1.1 Rename `writeVscodeThemeSettings` → `writeVscodeUserSettings` in `packages/server/src/editor-manager.ts`; update both call sites (`start()` and `setTheme()`).
- [ ] 1.2 Extend the merged settings object with persistence keys:
  - `window.restoreWindows: "all"`
  - `workbench.editor.restoreViewState: true`
  - `files.hotExit: "onExitAndWindowClose"`
  - `security.workspace.trust.enabled: false`
  - `update.mode: "none"`
  - `extensions.autoCheckUpdates: false`
  - `workbench.startupEditor: "none"`
- [ ] 1.3 Flip merge order so existing user values win over seeded defaults (currently seeded values overwrite). Theme keys remain authoritative because they are explicitly set by the dashboard each spawn.
- [ ] 1.4 In `stop()`, change `killProcess(pid, { timeoutMs: 2000 })` → `killProcess(pid, { timeoutMs: 5000 })`.

## 2. Tests

- [ ] 2.1 Unit test: calling `start(cwd)` on a fresh data dir writes a `settings.json` containing all seeded keys.
- [ ] 2.2 Unit test: calling `start(cwd)` when `settings.json` already has `security.workspace.trust.enabled: true` preserves that value; absent keys get seeded.
- [ ] 2.3 Unit test: `setTheme(cwd, "light")` after a prior `start(cwd)` updates the theme keys but does not strip the seeded persistence keys.
- [ ] 2.4 Unit test: `stop()` waits up to 5 s before SIGKILL (mock `killProcess` and assert `timeoutMs` arg).

## 3. Documentation

- [ ] 3.1 Update `docs/file-index-server.md` row for `editor-manager.ts` with a "See change: fix-editor-settings-persistence" annotation noting the rename + persistence-keys seeding. (Delegate to a subagent per AGENTS.md Documentation Update Protocol.)
- [ ] 3.2 No `AGENTS.md` change — backbone row already covers the file at the right altitude.

## 4. Verification

- [ ] 4.1 Manual: open a folder editor, open 3 tabs, edit a buffer (don't save), run `pi-dashboard restart`, reopen the same folder → all 3 tabs reappear, dirty buffer restored from hot-exit.
- [ ] 4.2 Manual: open a fresh folder → no Workspace Trust dialog, no "Welcome" tab, no update banner.
- [ ] 4.3 `npm test 2>&1 | tee /tmp/pi-test.log` clean; `grep -nE 'FAIL|Error' /tmp/pi-test.log` empty.
- [ ] 4.4 `openspec validate fix-editor-settings-persistence` passes.
