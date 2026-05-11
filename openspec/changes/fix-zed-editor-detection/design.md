## Context

The dashboard's native-editor button row is driven by `EDITORS` in `packages/server/src/editor-registry.ts` and surfaced via `GET /api/editors`. The Zed entry was authored before:
- Zed renamed its Linux process to `zed-editor` (Zed PR #12622, mid-2024).
- Zed shipped a fully-supported Windows port (Zed for Windows blog, Sept 2025).
- The `--add` flag became the standard way to attach a file to an existing Zed window without spawning a new workspace.

Current state of `EDITORS[0]`:
```ts
{ id: "zed", name: "Zed", cli: "zed",
  processPattern: { darwin: "/Applications/Zed.app", linux: "zed" } }
// Zed not available on Windows
```

Failure modes in the wild:
1. Linux + ZFS host → `pgrep -f "zed"` matches the **ZFS Event Daemon** (`zed`) ([openZFS man page](https://openzfs.github.io/openzfs-docs/man/v2.2/8/zed.8.html)). Dashboard advertises a Zed button that fires `spawn("zed", ...)` and gets the ZFS daemon's path, not the editor.
2. Linux without ZFS, Zed actually running → `pgrep -f "zed"` does NOT match (real process is `zed-editor`). Button never appears.
3. Windows → `EditorEntry.processPattern.win32` is unset; `detectEditors` hits `if (!pattern) continue` and skips Zed. No button at all.
4. Every "open file at line" click on a session card → `spawn("zed", ["foo.ts:42"])` opens a brand-new workspace because no `--add` flag is sent. UX is "every click steals my window".

The infrastructure for solving these is already in place:
- `EditorEntry.processPattern.win32?: string` and `winCli?: string` are first-class precedented fields (VS Code: `Code.exe` + `code.cmd`; IntelliJ: `idea64.exe`).
- `isProcessRunning` in `packages/shared/src/platform/process-scan.ts` handles the `tasklist` vs `pgrep` split internally.
- `ToolResolver.which` handles PATHEXT-aware Windows lookup (`.EXE` preferred over `.CMD`).
- `/api/open-editor` does bare `spawn(editor.cli, args, { detached, stdio:"ignore" })` — adding flags to `args` is a one-line change.

## Goals / Non-Goals

**Goals:**
- Zed button appears reliably on macOS, Linux (with or without ZFS), and Windows when Zed is installed and running.
- Single-file opens (with or without line) attach to the user's existing Zed window via `--add` instead of spawning a new workspace.
- No regression for VS Code (`Code.exe` / `code.cmd`) or IntelliJ (`idea64.exe`) detection or launch behaviour.
- Tests cover all three platforms for the Zed entry, plus the new spawn-argv shape.

**Non-Goals:**
- Detecting Zed Preview / Zed Nightly under their alternate binary names (`Zed-Preview.exe`, `zed-preview`). Could be added later via config override.
- Behaviour change for VS Code / IntelliJ flag handling — this change only adds `--add` for the spawn, which is a no-op for editors that don't recognize the flag (both `code` and `idea` accept `--add`-equivalent semantics by default; not worth scope creep here).
- Fixing the upstream Zed bug where `path:line:col` is ignored on Windows ([zed-industries/zed#46943](https://github.com/zed-industries/zed/issues/46943)). We ship the syntax (it's the documented contract) and document the limitation.
- Changing how the code-server / EditorView (browser-served VS Code) is detected or launched. That goes through a separate `editor-detection` capability.
- Changing the localhost-only access policy for `/api/open-editor`.

## Decisions

### D1. Linux process pattern: `"zed-editor"` (not `"zed"`)

**Choice**: Set `processPattern.linux = "zed-editor"`.

**Rationale**: Per [Zed PR #12622](https://github.com/zed-industries/zed/pull/12622) and [issue #13360](https://github.com/zed-industries/zed/issues/13360), the actual editor process on Linux is `zed-editor` (in `libexec/` on most distros, `lib/zed/` on Arch). `zed` is the CLI launcher binary. The previous `pgrep -f "zed"` matched any command-line containing the substring "zed" — most catastrophically the ZFS Event Daemon shipped on every Ubuntu+ZFS install.

**Alternatives considered**:
- *Keep `"zed"` and tighten match to `pgrep -x "zed"`*: Would still match the ZFS daemon (which is also exactly named `zed`). And Zed's CLI launcher is not the long-running editor process — it forks and exits.
- *Keep `"zed"` and also check that the binary path resolves under a Zed install dir*: Adds platform-specific logic (XDG dirs, `/opt/zed`, `/usr/lib/zed`) for marginal benefit. Rejected.

### D2. Windows process pattern: `"Zed.exe"`, CLI: `"zed.exe"`

**Choice**: `processPattern.win32 = "Zed.exe"` and `winCli = "zed.exe"`.

**Rationale**:
- The running process on Windows is `Zed.exe` (capital Z), per Zed Windows installer layout: `%LOCALAPPDATA%\Programs\Zed\Zed.exe` (also referenced in [issue #41728](https://github.com/zed-industries/zed/issues/41728), [issue #40958](https://github.com/zed-industries/zed/issues/40958), [issue #44126](https://github.com/zed-industries/zed/issues/44126)). `tasklist /FI "IMAGENAME eq Zed.exe"` is case-insensitive in practice but we use the documented case for clarity.
- The CLI is `zed.exe` (lowercase, in `…\Zed\bin\zed.exe`), per [zed.dev/docs/reference/cli](https://zed.dev/docs/reference/cli):
  > "Windows: The CLI is included with Zed. Add Zed's installation directory to your PATH, or use the full path to `zed.exe`."
- `winCli = "zed.exe"` (with explicit `.exe`) is consistent with IntelliJ's `idea64.exe` precedent and means `ToolResolver.which("zed.exe")` will go through `where zed.exe` and find it directly without PATHEXT scoring complications.

**Alternatives considered**:
- *Use `winCli = "zed"` (no extension)*: Works because `whichSync` adds PATHEXT and prefers `.EXE`. But explicit `.exe` is what VS Code / IntelliJ do, and it's clearer in test mocks and grep output. Rejected for consistency.
- *Match Zed's preview channel under a different IMAGENAME*: Out of scope (see Non-Goals).

### D3. Single-file opens prepend `--add`

**Choice**: When `/api/open-editor` is called with `file` set, prepend `"--add"` to `args` so the spawn argv is `["--add", "<absPath>:<line>"]` (or `["--add", "<absPath>"]`).

**Rationale**: Per [Zed CLI reference](https://zed.dev/docs/reference/cli) and the [PR #9202 description](https://github.com/zed-industries/zed/pull/9202):
> "Add files to the currently open workspace"

This matches the user's expectation when clicking a file pill in a tool result: "open the file in my current Zed window", not "open a fresh workspace". For folder opens (`file` absent), `--add` is intentionally NOT used — opening a directory should give the user a project window.

The flag is also compatible with VS Code (`code --add` exists and adds a folder/file to the current window) and with IntelliJ (which ignores unknown flags or treats them as additional path arguments). So we apply `--add` uniformly when `file` is set, rather than adding editor-specific argv builders for one editor.

**Alternatives considered**:
- *`--reuse`*: Replaces the existing window's contents with the new path. **Destructive** — closes the user's open project. Rejected.
- *Editor-specific argv builders (a function per editor entry)*: Over-engineered for one flag that's broadly supported. If a future editor needs custom argv, we add a `buildArgs?: (cwd, file?, line?) => string[]` field to `EditorEntry` then. Defer.
- *Send `--add` for both folder and file opens*: For a folder open, `--add` would graft the dir onto a possibly-unrelated current workspace. Wrong UX. Keep folder open default.

### D4. Drop the "Zed not available on Windows" comment

**Choice**: Remove the inline comment. The platform branch does the right thing automatically once `processPattern.win32` is set.

**Rationale**: Comments that contradict reality are worse than no comments. The structural fact (Windows support) is encoded in the data, not in prose.

### D5. Test strategy

**Choice**: Three test layers, no new test file:

1. **`packages/server/src/__tests__/editor-registry.test.ts`** —
   - Flip the existing `expect(zed.processPattern.win32).toBeUndefined()` assertion (line 45) to assert `"Zed.exe"`. Add a parallel assertion for `winCli === "zed.exe"`.
   - Update the Linux `EDITORS` snapshot to expect `"zed-editor"`.
   - Add a new `detectEditors` scenario for `process.platform = "win32"` returning `{ id: "zed", name: "Zed" }` when `tasklist` matches and `where zed.exe` resolves.
   - Add a Linux scenario that asserts `pgrep -f "zed-editor"` is the command issued (no `"zed"` substring).

2. **`packages/server/src/__tests__/editor-endpoints.test.ts`** —
   - Existing test covers `Open file at line`. Extend to assert spawn argv is `["--add", "<absPath>:<line>"]`, not `["<absPath>:<line>"]`.
   - Existing test for folder open: assert spawn argv has NO `--add` (just `["<cwd>"]`).

3. **`packages/shared/src/__tests__/platform-process-scan.test.ts`** —
   - Existing Darwin scenario stays.
   - Add a Linux scenario asserting `pgrep -f "zed-editor"` returns true mock-mocking the exec.

No client-side tests change. The client never sees the registry; it just consumes `/api/editors` output.

## Risks / Trade-offs

- **[Risk] Windows users without `zed.exe` on PATH** → `winget install` adds `%LOCALAPPDATA%\Programs\Zed\bin\` to PATH automatically; users who ran the manual installer may not have it. **Mitigation**: `isCliAvailable("zed.exe")` returns false → button doesn't appear → user sees no UI regression. The Zed Windows docs explicitly tell users to add the install dir to PATH.
- **[Risk] `path:line:col` cursor placement broken on Windows** ([Zed #46943](https://github.com/zed-industries/zed/issues/46943)) → file opens at line 1 instead of requested line on Windows. **Mitigation**: Document in tasks + design as an upstream limitation. We ship the documented contract (`zed file:line:col`); when Zed fixes #46943 it works automatically with no dashboard change.
- **[Risk] `--add` semantics differ across editors** → For Zed and VS Code, `--add` attaches to current workspace. For IntelliJ, the long form is `--line` for line-only and there's no `--add`. **Mitigation**: IntelliJ's `idea64.exe` typically ignores unknown flags or treats them as additional path arguments. Manual sanity-check during apply: spawn `idea64.exe --add <file>` and confirm it opens the file. If broken, fall back to editor-specific argv builders (see D3 alternatives).
- **[Risk] Linux distros shipping Zed under a different binary name (Flatpak, Snap)** → `pgrep -f "zed-editor"` won't match. **Mitigation**: Out of scope for this change; acknowledged in Non-Goals. Future work: optional `processPattern.linuxAlt: string[]` for fallbacks, gated on a real user request.
- **[Trade-off] We don't pin Zed CLI flag stability** → `--add` is documented but Zed could rename it. **Mitigation**: If Zed changes the flag, our test suite catches the spawn-argv mismatch on next dashboard release.
