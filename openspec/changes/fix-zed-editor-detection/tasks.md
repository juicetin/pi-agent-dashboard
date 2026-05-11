## 1. Editor registry: Linux + Windows fix

- [ ] 1.1 Update `EDITORS[0]` in `packages/server/src/editor-registry.ts`: change `processPattern.linux` from `"zed"` to `"zed-editor"`. Add `processPattern.win32 = "Zed.exe"`. Add `winCli = "zed.exe"`. Remove the `// Zed not available on Windows` comment.
- [ ] 1.2 Verify the resulting entry compiles and matches the precedent shape of the `vscode` entry (same set of fields populated).

## 2. Open-editor route: --add flag for file opens

- [ ] 2.1 In `packages/server/src/routes/system-routes.ts`, modify the `POST /api/open-editor` handler so that when `file` is set, the spawn argv prepends `"--add"`. Folder opens (no `file`) keep current argv shape (just `[<cwd>]`).
- [ ] 2.2 Confirm the change does not affect the `unknown editor` / `unknown session path` early-return branches.

## 3. Tests: editor-registry

- [ ] 3.1 In `packages/server/src/__tests__/editor-registry.test.ts`, flip the existing `expect(zed.processPattern.win32).toBeUndefined()` assertion (around line 45) to `expect(zed.processPattern.win32).toBe("Zed.exe")`.
- [ ] 3.2 Add an assertion that `zed.winCli === "zed.exe"`.
- [ ] 3.3 Update the EDITORS-shape snapshot test to expect `processPattern.linux === "zed-editor"`.
- [ ] 3.4 Add a `detectEditors` scenario for `process.platform = "win32"`: mock `tasklist /FI "IMAGENAME eq Zed.exe"` to return a match and `where zed.exe` to resolve. Assert result includes `{ id: "zed", name: "Zed" }`.
- [ ] 3.5 Add a `detectEditors` scenario for Linux where `pgrep -f "zed-editor"` matches and `which zed` resolves. Assert Zed is in the result.
- [ ] 3.6 Add a `detectEditors` scenario for Linux where `pgrep -f "zed-editor"` does NOT match (only the ZFS daemon is running, matching the bare `zed` substring). Assert Zed is NOT in the result.

## 4. Tests: open-editor endpoint

- [ ] 4.1 In `packages/server/src/__tests__/editor-endpoints.test.ts`, locate the existing folder-open test. Assert the spawn argv has NO `--add` (just `[<cwd>]`).
- [ ] 4.2 Locate the existing "Open file at line" test (or add one if missing). Assert the spawn argv equals `["--add", "<absPath>:<line>"]`.
- [ ] 4.3 Add a "Open specific file (no line)" test asserting spawn argv equals `["--add", "<absPath>"]`.

## 5. Tests: process-scan

- [ ] 5.1 In `packages/shared/src/__tests__/platform-process-scan.test.ts`, ensure existing Darwin coverage stays.
- [ ] 5.2 Add a Linux scenario: mock `pgrep -f "zed-editor"` returning success, assert `isProcessRunning("zed-editor", { platform: "linux", exec })` is `true`.
- [ ] 5.3 Add a Windows scenario: mock `tasklist /FI "IMAGENAME eq Zed.exe"` returning a line containing `Zed.exe`, assert `isProcessRunning("Zed.exe", { platform: "win32", exec })` is `true`.

## 6. Verify and run

- [ ] 6.1 Run `npm test 2>&1 | tee /tmp/pi-test.log` and grep for `FAIL|Error|✗` — all editor-registry, editor-endpoints, and platform-process-scan tests pass.
- [ ] 6.2 If running on Linux dev box: install Zed (`curl -f https://zed.dev/install.sh | sh`), launch it, restart the dashboard, confirm the **Open in Zed** button appears in the folder action bar for the current cwd.
- [ ] 6.3 If running on Linux dev box: click a "open file" button in a tool result while Zed is open with another project. Confirm the file is added to the existing window (not opened in a new workspace).

## 7. Docs

- [ ] 7.1 Update `docs/file-index-server.md`'s row for `editor-registry.ts` (if present) to mention Windows + Linux Zed coverage and `--add` semantics. Per AGENTS.md doc protocol: delegate the edit to a general-purpose subagent with the caveman-style rule passed verbatim.
- [ ] 7.2 If `docs/architecture.md` has a section on editor detection, add a short note that Zed Windows is supported and that `path:line:col` cursor placement is gated on upstream Zed [#46943](https://github.com/zed-industries/zed/issues/46943). Otherwise skip this task.
- [ ] 7.3 Update CHANGELOG.md `## [Unreleased]` section with a one-line entry: "Fixed: Zed editor detection on Linux (was matching ZFS daemon) and added Windows support; single-file opens now use `--add` to attach to current Zed window."

## 8. Restart and reload

- [ ] 8.1 After server-side changes: rebuild client (`npm run build`) is NOT required (no client changes), but restart the dashboard server: `curl -X POST http://localhost:8000/api/restart`.
- [ ] 8.2 No bridge changes — `npm run reload` not needed.
