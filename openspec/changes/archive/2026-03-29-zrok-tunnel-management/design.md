## Context

The dashboard server can expose itself via a zrok tunnel for remote access. The current `tunnel.ts` uses zrok REST API to create shares, but zrok v2's REST-only shares don't actually proxy HTTP traffic — real proxying requires running `zrok share public` as a long-lived subprocess. Users without zrok installed have no guidance on how to set it up.

Current state:
- `src/server/tunnel.ts` — REST-based `createTunnel()` / `deleteTunnel()` using fetch
- `src/server/server.ts` — calls `createTunnel(port)` after listen, `deleteTunnel()` on shutdown
- `src/client/components/SettingsPanel.tsx` — toggle for `tunnel.enabled`
- No binary detection, no stale cleanup, no client-side tunnel status

## Goals / Non-Goals

**Goals:**
- Replace REST API share with `zrok share public` subprocess that actually proxies traffic
- Detect whether `zrok` binary is available on PATH
- Clean up stale `zrok share` processes from previous crashed runs
- Expose tunnel status via REST endpoint for the client
- Add a tunnel status button in the sidebar action bar
- Show OS-aware installation guide when zrok is not installed

**Non-Goals:**
- Supporting zrok private shares or other share modes
- Auto-installing zrok (just guide the user)
- Supporting non-zrok tunnel providers (e.g. ngrok, cloudflare)
- Changing the `tunnel.enabled` config schema

## Decisions

### D1: Subprocess via `child_process.spawn` instead of REST API

Run `zrok share public --headless localhost:{port}` as a child process. Parse the public URL from stdout (zrok prints it on startup). Store the child process reference for cleanup.

**Why**: REST API creates shares in the zrok controller but doesn't run the local proxy. The `zrok share public` command runs both the registration and the local proxy.

**Alternative**: Keep REST API and also run a local proxy manually — too complex, duplicates what `zrok` already does.

### D2: Binary detection via `which`/`where` command

Use `child_process.execSync("which zrok")` (or `where zrok` on Windows) to check if the binary is on PATH. Cache the result at server start.

**Why**: Simple, reliable, cross-platform with the which/where distinction.

### D3: Stale process cleanup via PID file

Write the zrok subprocess PID to `~/.pi/dashboard/zrok.pid` on tunnel creation. On server start, read this file; if the PID exists and is a zrok process, kill it. Delete the PID file after cleanup or on clean shutdown.

**Why**: PID file is simpler and more targeted than scanning all processes. Avoids killing unrelated zrok processes the user might be running.

**Alternative**: `pgrep -f "zrok share"` — risks killing user's other zrok shares.

### D4: REST endpoint `GET /api/tunnel-status`

Returns `{ status: "active", url: "https://..." }`, `{ status: "inactive" }`, or `{ status: "unavailable" }` (binary not found). The client polls this or fetches on-demand when the tunnel button is clicked.

**Why**: Simple REST call, no need for WebSocket protocol additions. Tunnel status changes rarely.

### D5: Sidebar tunnel button with dual behavior

Add a small tunnel icon button in the sidebar header action bar (next to settings gear in `SessionList.tsx`). On click:
- If tunnel is active → show URL (copyable) in a small popover/toast
- If zrok is not installed → navigate to `/tunnel-setup` guide view
- If tunnel is inactive but zrok is available → show status

**Why**: Reuses existing sidebar action pattern. Minimal UI surface.

### D6: OS detection via `navigator.platform` / `navigator.userAgent`

Detect macOS, Linux, or Windows from the browser's navigator API. Show platform-specific install commands. Default to Linux if detection fails.

**Why**: Client-side detection is sufficient since the install guide is informational. The server could also report its OS, but for a guide page, client-side is simpler and the server OS is what matters — so we'll include the server's OS in the tunnel-status endpoint response.

**Revised**: Include `serverOs: "darwin" | "linux" | "win32"` in the tunnel-status response so the install guide shows instructions for the server's actual OS.

## Risks / Trade-offs

- **[Risk] zrok stdout format changes** → Parse conservatively, log raw output. The URL pattern `https://*.share.zrok.io` or similar is fairly stable.
- **[Risk] Subprocess crashes silently** → Monitor the child process `exit` event, log it, set tunnel status to inactive.
- **[Risk] PID file stale after OS reboot** → Check if PID is actually running before killing. If process doesn't exist, just clean up the PID file.
- **[Trade-off] No WebSocket push for tunnel status** → Client must poll or fetch on interaction. Acceptable since tunnel status changes are rare events (startup/shutdown only).
