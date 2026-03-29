## 1. Server: Binary Detection & Stale Cleanup

- [x] 1.1 Add `detectZrokBinary()` function using `which zrok` / `where zrok` to check PATH availability
- [x] 1.2 Add PID file helpers: `writeZrokPid(pid)`, `readZrokPid()`, `removeZrokPid()` writing to `~/.pi/dashboard/zrok.pid`
- [x] 1.3 Add `cleanupStaleZrok()` that reads PID file, checks if process is running, kills if stale, removes PID file
- [x] 1.4 Write tests for binary detection, PID file helpers, and stale cleanup

## 2. Server: Subprocess Tunnel

- [x] 2.1 Rewrite `createTunnel(port)` to spawn `zrok share public --headless localhost:{port}`, parse URL from stdout, write PID file, return URL
- [x] 2.2 Add subprocess exit handler that logs warning and clears tunnel state on unexpected exit
- [x] 2.3 Add spawn timeout (30s) — kill process and return null if no URL parsed in time
- [x] 2.4 Rewrite `deleteTunnel()` to kill the child process and remove PID file
- [x] 2.5 Add `getTunnelStatus()` returning `{ status, url?, serverOs }` object
- [x] 2.6 Write tests for createTunnel, deleteTunnel, getTunnelStatus, timeout, and crash handling

## 3. Server: REST Endpoint & Lifecycle

- [x] 3.1 Add `GET /api/tunnel-status` endpoint in `server.ts` calling `getTunnelStatus()`
- [x] 3.2 Call `cleanupStaleZrok()` at server startup before tunnel creation
- [x] 3.3 Add tunnel status types to `src/shared/rest-api.ts`
- [x] 3.4 Wire startup: detect binary → cleanup stale → create tunnel (if enabled & available)

## 4. Client: Tunnel Button in Sidebar

- [x] 4.1 Create `TunnelButton` component that fetches `/api/tunnel-status` on mount/click
- [x] 4.2 Show connected indicator when active (click copies URL), neutral when inactive, guide icon when unavailable
- [x] 4.3 Add `TunnelButton` to sidebar header actions in `SessionList.tsx` (next to settings gear)

## 5. Client: Installation Guide View

- [x] 5.1 Create `ZrokInstallGuide` component with OS-specific install/enroll/verify sections
- [x] 5.2 Add `/tunnel-setup` route in `App.tsx` rendering the guide with a back button
- [x] 5.3 Navigate to `/tunnel-setup` from `TunnelButton` when status is "unavailable"

## 6. Documentation

- [x] 6.1 Update `AGENTS.md` key files table with new/changed files
- [x] 6.2 Update `docs/architecture.md` with tunnel subprocess lifecycle
- [x] 6.3 Update `README.md` with zrok tunnel setup instructions
