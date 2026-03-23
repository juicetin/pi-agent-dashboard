## Context

The dashboard shows pi sessions grouped by `cwd`. Users working locally want to quickly jump from a session to the project in their editor. Sessions already carry `cwd`, so we can detect editors and open them server-side.

The dashboard server already has REST endpoints (`/api/sessions`, `/api/workspaces`). Zed, VS Code, and IntelliJ all have CLIs that handle "open or focus" behavior natively — if the project is already open, they focus the existing window.

## Goals / Non-Goals

**Goals:**
- Detect available editors for a session's project directory
- Open/focus the correct editor window from the dashboard
- Keep it secure (localhost-only, path-validated)

**Non-Goals:**
- Opening specific files or lines within an editor
- Configurable editor commands (we use well-known CLI names)
- Remote dashboard support (this is localhost-only by design)
- Editor plugin/extension integration

## Decisions

### 1. Detection: folder marker + CLI on PATH

Detect editors by checking two conditions:
1. Config folder exists in `cwd`: `.zed/`, `.vscode/`, `.idea/`
2. Corresponding CLI is available on PATH: `zed`, `code`, `idea`

Both must be true. A `.vscode/` folder without `code` on PATH means VS Code isn't usable on this machine.

**Alternative considered**: Only check CLI existence (no folder check). Rejected because it would show editor buttons for projects that don't use that editor.

### 2. Server-side execution via REST endpoints

Two new endpoints:
- `GET /api/editors?path=<cwd>` — returns detected editors for a path
- `POST /api/open-editor` with `{ path: string, editor: string }` — spawns the CLI

The POST endpoint validates that `path` matches a known session `cwd` from the session manager. The editor ID must be one of the known editors (`zed`, `vscode`, `idea`).

**Alternative considered**: WebSocket message instead of REST. Rejected because this is a request/response pattern, not a stream — REST is the natural fit.

### 3. Editor registry as a static map

```
{ folder: ".zed",    id: "zed",    cli: "zed",  name: "Zed"      }
{ folder: ".vscode", id: "vscode", cli: "code", name: "VS Code"  }
{ folder: ".idea",   id: "idea",   cli: "idea", name: "IntelliJ" }
```

This is a simple array in a shared module. Adding a new editor = adding one entry.

### 4. Client-side localhost detection

The client checks `window.location.hostname` against `localhost` / `127.0.0.1` / `::1` before showing editor buttons or calling the API. The server also rejects requests from non-loopback IPs as a defense-in-depth measure.

### 5. Error feedback via auto-dismiss toast

When `POST /api/open-editor` returns an error, the client shows a brief auto-dismiss toast notification. No existing toast/notification system exists in the client, so a lightweight `<Toast>` component is introduced — simple transient message with auto-dismiss, no library dependency.

### 6. Extract SessionCard into its own module

Before adding editor buttons, extract from `SessionList.tsx` into `SessionCard.tsx`:
- `SessionCard`, `ActivityIndicator`, `TokenStats`, `GitInfo`, `GroupGitInfo` components
- `statusColors`, `sourceBadgeColors` maps

`SessionList.tsx` retains the orchestration: filtering, grouping, group headers, and layout. This keeps editor button additions contained in `SessionCard.tsx` without bloating the list component (~340 lines today).

### 7. Spawn with detached process, no wait

The server spawns the editor CLI as a detached process (`{ detached: true, stdio: 'ignore' }`) and unrefs it. We don't wait for the editor to close — fire and forget.

## Risks / Trade-offs

- **[CLI not on PATH in server context]** → The dashboard server may run with a different PATH than the user's shell. Mitigation: check common locations (`/usr/local/bin/`, `/opt/homebrew/bin/`) as fallbacks.
- **[Stale editor detection]** → User adds `.vscode/` after session starts and detection was cached. Mitigation: no aggressive caching — detect on each API call (filesystem check is cheap).
- **[Security: path traversal]** → Malicious path in POST body. Mitigation: validate against session manager's known cwds.
