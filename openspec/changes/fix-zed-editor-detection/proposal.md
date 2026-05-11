## Why

The native editor registry's Zed entry is out of date with upstream Zed in three ways that break the **Open in Zed** button on real-world setups:

1. **Linux pattern collides with the ZFS Event Daemon (`zed`) and no longer matches Zed itself.** Per Zed [PR #12622](https://github.com/zed-industries/zed/pull/12622), the running editor process on Linux has been `zed-editor` (in `libexec/` or `lib/zed/`) since 2024 — `zed` is just the CLI launcher. On any Linux box with ZFS, `pgrep -f "zed"` matches the ZFS daemon, so the dashboard advertises a Zed button that fails to launch (and on systems without ZFS the button never appears even when Zed is running).
2. **Zed has been a fully-supported Windows platform since Sept 2025** ([Zed for Windows](https://zed.dev/blog/zed-for-windows-is-here)) but the registry comment still reads "Zed not available on Windows" and `processPattern.win32` is unset, so `detectEditors` skips it on win32 entirely.
3. **Every "open file at line" click on a session card spawns a brand-new Zed workspace** because the spawn site never passes `--add` or `--reuse`. With the existing CLI flags (per the [CLI Reference](https://zed.dev/docs/reference/cli)), single-file opens should attach to the currently-open Zed window.

## What Changes

- **Linux process pattern**: `processPattern.linux` for the `zed` editor entry changes from `"zed"` to `"zed-editor"` to match Zed's actual binary on Linux and stop colliding with the ZFS daemon.
- **Windows support**: Add `processPattern.win32 = "Zed.exe"` and `winCli = "zed.exe"` to the `zed` editor entry. (Per [zed.dev/docs/reference/cli](https://zed.dev/docs/reference/cli): *"The CLI is included with Zed. Add Zed's installation directory to your PATH, or use the full path to `zed.exe`."* Windows install layout — main app `%LOCALAPPDATA%\Programs\Zed\Zed.exe`, CLI `…\Zed\bin\zed.exe` — matches issues [#41728](https://github.com/zed-industries/zed/issues/41728) and [#40958](https://github.com/zed-industries/zed/issues/40958).) The existing `if (!pattern) continue` branch in `detectEditors` will then admit Zed on Windows automatically.
- **`--add` for single-file opens**: When `/api/open-editor` is called with both `file` and `line` (or just `file`), the spawn argv prepends `--add` so Zed/VS Code reuse the user's current workspace instead of opening a new one. Folder opens (`file` absent) keep current behaviour.
- **No new flag for folder opens**: Discarded `--reuse` after evidence review — `--reuse` *replaces* the existing workspace's contents, which is destructive when the user has an unrelated project open. Folder open stays as-is (default behaviour: Zed opens a new workspace for a new directory, which is correct).
- **Tests**: `editor-registry.test.ts` line 45's "should not have win32 pattern for zed" assertion flips to assert the new pattern; new scenarios cover the Linux `zed-editor` pattern and Windows detection. New unit test verifies the spawn argv includes `--add` when `file` is set.
- **Docs**: A short note added to `docs/architecture.md` (or wherever editor detection is described) about Zed's Windows status and the [#46943](https://github.com/zed-industries/zed/issues/46943) caveat that `path:line:col` cursor-placement is still broken on Windows upstream — we ship the syntax (it's the documented contract) but cursor placement may be a no-op until Zed fixes it.

Not in scope: the long-tail VS Code / IntelliJ behaviour, the code-server / EditorView UI, or any change to `editor-detection` (code-server) spec.

## Capabilities

### New Capabilities

None. All changes modify existing requirements.

### Modified Capabilities

- `open-in-editor`: The "Editor detection" requirement gains a Windows scenario, the Linux scenario's process pattern updates from `zed` to `zed-editor`, and a new "Single-file open uses --add" requirement is added under "Open editor endpoint".

## Impact

**Code:**
- `packages/server/src/editor-registry.ts` — `EDITORS[0]` (zed entry): add `winCli`, add `processPattern.win32`, change `processPattern.linux`. Drop the "Zed not available on Windows" comment.
- `packages/server/src/routes/system-routes.ts` — `/api/open-editor` handler: prepend `--add` to argv when `file` is present.
- `packages/server/src/__tests__/editor-registry.test.ts` — flip the "no win32 pattern" assertion; add Linux + Windows detection scenarios.
- `packages/server/src/__tests__/editor-endpoints.test.ts` — add a scenario asserting `--add` is in spawn argv for single-file opens.
- `packages/shared/src/__tests__/platform-process-scan.test.ts` — extend the existing Zed-on-Darwin test set with `linux: "zed-editor"` coverage if not already implicit.

**Specs:**
- `openspec/specs/open-in-editor/spec.md` — delta in `openspec/changes/fix-zed-editor-detection/specs/open-in-editor/spec.md`.

**Cross-platform:**
- macOS: no behaviour change (pattern stays `/Applications/Zed.app`).
- Linux: users on systems with ZFS will stop seeing a phantom Zed button. Users with Zed actually running will start seeing it (currently they don't, because `pgrep -f "zed"` matches non-Zed processes).
- Windows: users with Zed installed via installer / `winget install ZedIndustries.Zed` will see the **Open in Zed** button for the first time, provided the CLI bin dir is on PATH (Zed docs require this).

**No protocol or persistence changes.** No new config fields. No migration needed.

**Risks:**
- The `path:line:col` cursor placement is broken on Windows in upstream Zed ([#46943](https://github.com/zed-industries/zed/issues/46943)). The file will open at line 1 instead of the requested line until Zed ships a fix. Documented as a known limitation; the dashboard's contract (call `zed file:line:col`) remains correct.
- Users running Zed-preview / nightly on Linux with a non-stock binary name (e.g. `zed-preview`) will be undetectable. Out of scope; can be added later via config override if requested.
