# Spec Gap Analysis Report

**Date**: 2026-03-24  
**Scope**: All 48 specs in `openspec/specs/` vs actual codebase in `src/`

---

## Summary

| Category | Count |
|----------|-------|
| Specs with stale/inaccurate content | 5 |
| Code features with NO spec | 12 |
| Spec requirements not implemented | 3 |
| Minor spec drift (wording/naming) | 8 |

---

## 1. Code Features With NO Spec

These are implemented features that have no corresponding spec at all.

### 1.1 Dev Build on Reload (`devBuildOnReload`)
- **Code**: `src/extension/dev-build.ts`, `src/shared/config.ts` (`devBuildOnReload` field), `src/server/server.ts` (`POST /api/shutdown`)
- **What it does**: When `devBuildOnReload: true` in config, the bridge extension runs `npm run build` and posts to `/api/shutdown` on `/reload`, enabling hot-reload during development
- **Missing spec**: No spec covers `devBuildOnReload` config field, the dev build flow, or the `/api/shutdown` endpoint
- **Recommendation**: Create `dev-build-reload` spec or add to `packaging` spec

### 1.2 Server Shutdown Endpoint (`POST /api/shutdown`)
- **Code**: `src/server/server.ts` — localhost-only `POST /api/shutdown` endpoint
- **What it does**: Allows programmatic server shutdown, used by dev-build-on-reload
- **Missing spec**: Only the `auto-shutdown` spec covers shutdown, and it doesn't mention this REST endpoint
- **Recommendation**: Add to `auto-shutdown` spec or `packaging` spec

### 1.3 Bridge Connection Manager (Exponential Backoff, Message Buffering)
- **Code**: `src/extension/connection.ts` — `ConnectionManager` class with backoff, buffer, reconnect
- **What it does**: WebSocket connection with exponential backoff (1s→30s), message buffer (10K max), automatic reconnect, state replay on reconnect
- **Missing spec**: The `bridge-extension` spec mentions on-demand loading but not the core connection management, buffering, or reconnect behavior
- **Recommendation**: Create `bridge-connection` spec or add to `bridge-extension` spec

### 1.4 Server Probe and Auto-Start
- **Code**: `src/extension/server-probe.ts` (TCP port check), `src/extension/server-launcher.ts` (detached process spawn)
- **What it does**: Bridge checks if server port is open, auto-launches server as detached process if `autoStart: true`
- **Missing spec**: No spec covers server auto-start from the bridge extension
- **Recommendation**: Add to `packaging` spec or create `bridge-server-management` spec

### 1.5 Stats Extraction and Token Accumulation
- **Code**: `src/extension/stats-extractor.ts`, `src/server/pi-gateway.ts` (token accumulation in `stats_update` handler)
- **What it does**: Extracts per-turn token stats (input, output, cacheRead, cacheWrite, cost, contextUsage) from `turn_end` events, accumulates totals server-side
- **Missing spec**: No spec defines how token stats are extracted, accumulated, or forwarded. The `token-stats-bar` spec only covers the UI rendering.
- **Recommendation**: Create `token-stats-pipeline` spec covering extraction → protocol → accumulation → broadcast

### 1.6 Event Status Extraction
- **Code**: `src/server/event-status-extraction.ts`
- **What it does**: Extracts session status changes from events (`agent_start→streaming`, `agent_end→idle`, `tool_execution_start→currentTool`, `model_select→model/thinkingLevel`)
- **Missing spec**: No spec covers this server-side event-to-session-update mapping
- **Recommendation**: Add to `dashboard-server` spec or create `event-status-extraction` spec

### 1.7 Heartbeat Protocol
- **Code**: `src/extension/bridge.ts` (15s interval), `src/server/pi-gateway.ts` (45s timeout)
- **What it does**: Bridge sends `session_heartbeat` every 15s, server times out after 45s of no heartbeat and unregisters session
- **Missing spec**: Referenced in `auto-shutdown` (cleanup), but the protocol itself is not specified
- **Recommendation**: Create `session-heartbeat` spec or add to `bridge-extension` / `shared-protocol` spec

### 1.8 Toast Notification System
- **Code**: `src/client/components/Toast.tsx`, `useToast` hook
- **What it does**: Fixed-position auto-dismiss (3s) toast notifications for errors/results
- **Missing spec**: No spec covers the toast system
- **Recommendation**: Add to a general `ui-notifications` spec or `headless-spawn` spec (which uses toasts for spawn results)

### 1.9 DiffView Component
- **Code**: `src/client/components/DiffView.tsx`
- **What it does**: Renders unified diff output with colored lines (green +, red -, blue @@)
- **Missing spec**: Not covered by any spec
- **Recommendation**: Add to `sleek-chat-design` spec or `markdown-rendering` spec

### 1.10 Tool Renderer Registry
- **Code**: `src/client/components/tool-renderers/` — registry.ts, types.ts, 5 renderers (Read, Edit, Write, Bash, Generic), OpenFileButton
- **What it does**: Extensible tool call rendering with per-tool specialized views. ReadToolRenderer shows files, BashToolRenderer shows commands, EditToolRenderer shows diffs, etc. OpenFileButton triggers `/api/open-editor` with file+line.
- **Missing spec**: No spec covers the tool renderer system or individual renderers
- **Recommendation**: Create `tool-renderers` spec

### 1.11 Session Display Name Logic
- **Code**: `src/client/lib/session-display-name.ts`
- **What it does**: Priority chain: `name` → `firstMessage (truncated 50)` → `cwd last segment` → `ID prefix (8 chars)`
- **Missing spec**: Partially covered by `session-rename` (name field) and `session-identity` (firstMessage) but the display logic itself has no spec
- **Recommendation**: Add to `session-sidebar` spec or `session-identity` spec

### 1.12 Syntax Theme System
- **Code**: `src/client/lib/syntax-theme.ts`
- **What it does**: Maps dashboard themes to react-syntax-highlighter themes (oneDark, oneLight, dracula, nord, ghcolors) for code blocks
- **Missing spec**: `theme-gallery` spec defines color themes but not syntax highlighting theme mapping
- **Recommendation**: Add to `theme-gallery` spec

---

## 2. Stale/Inaccurate Specs

These specs contain requirements that no longer match the implementation.

### 2.1 `packaging` spec — SQLite references
- **Spec says**: Config options include `dbPath` and `retentionDays`
- **Reality**: These were removed in the `drop-sqlite` change. Config has `spawnStrategy`, `autoShutdown`, `shutdownIdleSeconds`, `tunnel`, `devBuildOnReload` instead
- **Spec says**: Peer dependencies include `sql.js` in runtime dependencies
- **Reality**: No SQLite dependencies exist anymore
- **Spec says**: Service templates for systemd/launchd with `--install-service` flag
- **Reality**: No `--install-service` flag exists in `cli.ts`. No service templates in repo.
- **Fix**: Update `packaging` spec to remove SQLite references, fix config fields, remove service template requirements (or mark as future)

### 2.2 `session-identity` spec — SQLite references
- **Spec says**: "The `hidden` field SHALL be a boolean stored in SQLite"
- **Spec says**: "session record SHALL remain in SQLite with `status = "ended"`"
- **Reality**: Hidden state is stored via `StateStore` (JSON file), sessions are in-memory `Map`
- **Fix**: Update `session-identity` spec to reference in-memory session manager and JSON-backed state store

### 2.3 `session-listing` spec — SQLite references
- **Spec says**: "The server SHALL create SQLite session records" / "sessions already in SQLite"
- **Reality**: Server creates in-memory session records via `sessionManager.register()`
- **Fix**: Update to reference in-memory session manager

### 2.4 `session-resume` spec — Missing headless strategy
- **Spec says**: "the server SHALL spawn pi with `pi --session <path>` in the session's cwd via tmux"
- **Reality**: Server reads `spawnStrategy` from config and may spawn headless (RPC mode) instead of tmux
- **Fix**: Update to mention strategy selection (already in `process-manager` and `headless-spawn` specs, but `session-resume` should reference it)

### 2.5 `extension-ui-forwarding` spec — tool_call hook
- **Spec says**: "The bridge extension SHALL subscribe to `tool_call` events" and "When a tool call is blocked"
- **Reality**: Bridge code in `bridge.ts` does NOT subscribe to `tool_call` events. It only listens for the events listed in `eventTypes` array. There's no `tool_call` handler. The `extension_ui_event` message type exists in the protocol but is only forwarded passively (server→browser relay).
- **Fix**: Either implement the tool_call subscription or update spec to reflect current state (event bus only)

---

## 3. Spec Requirements Not Implemented

### 3.1 `packaging` spec — Service templates
- **Spec requires**: `systemd/pi-dashboard.service` and `launchd/ai.pi.dashboard.plist` files, `--install-service` CLI flag
- **Reality**: Not implemented. No service templates, no `--install-service` flag.
- **Action**: Either implement or remove from spec (mark as out-of-scope/future)

### 3.2 `packaging` spec — `--help` flag
- **Spec requires**: `pi-dashboard --help` SHALL display available options
- **Reality**: `cli.ts` has no `--help` handler
- **Action**: Implement or remove from spec

### 3.3 `extension-ui-forwarding` spec — `tool_call` subscription
- **Spec requires**: Bridge subscribes to `tool_call` events and detects blocked calls
- **Reality**: Not implemented (see 2.5 above)
- **Action**: Implement or update spec

---

## 4. Minor Spec Drift

Small inconsistencies that should be cleaned up.

### 4.1 `packaging` spec — Config field names
- **Spec uses**: `httpPort`, `piGatewayPort`
- **Code uses**: `port`, `piPort`

### 4.2 `packaging` spec — Peer dependencies
- **Spec mentions**: `@oh-my-pi/*` packages
- **Reality**: Package only depends on `@mariozechner/pi-coding-agent`. The dual-runtime compatibility section may be outdated.

### 4.3 `shared-config` spec — Incomplete field list
- **Spec mentions**: `spawnStrategy` field
- **Code also has**: `autoStart`, `autoShutdown`, `shutdownIdleSeconds`, `tunnel.enabled`, `devBuildOnReload`
- **Other specs cover some**: `auto-shutdown` spec covers `autoShutdown`/`shutdownIdleSeconds`, `zrok-tunnel` covers tunnel
- **Missing from any spec**: `autoStart` (bridge auto-starts server), `devBuildOnReload`

### 4.4 `session-filtering` spec — "Active-only toggle"
- **Spec says**: Toggle defaults to ON (active/non-hidden)
- **Code**: `session-filter-storage.ts` defaults `getActiveOnly()` to `true`, consistent
- **But spec says**: "sessions with status 'ended' SHALL be hidden"
- **Code actually filters by**: `hidden` flag, not just `status === "ended"`. Active-only filters out `hidden === true` sessions.

### 4.5 `git-context` spec — PR detection
- **Spec covers**: Branch detection
- **Code also does**: PR number detection via `gh pr view`, remote URL parsing, platform-specific link building (GitHub, GitLab, Bitbucket, Gitea, Codeberg, SourceHut)
- **Not in spec**: PR detection, link building, multi-platform support

### 4.6 `open-in-editor` spec — Open file with line number
- **Spec says**: Open editor with path argument
- **Code also supports**: `file` and `line` parameters in `/api/open-editor` to open specific files at specific lines (used by tool renderers)

### 4.7 `context-usage-bar` spec — Context gradient function
- **Code**: `src/client/lib/context-gradient.ts` implements HSL interpolation (green→yellow→red)
- **Spec mentions**: gradient bar but doesn't specify the color interpolation algorithm

### 4.8 `model-selector` spec — ThinkingLevelSelector
- **Code**: `src/client/components/ThinkingLevelSelector.tsx` with 6 levels (off, minimal, low, medium, high, xhigh)
- **Spec**: `model-selector` only mentions model selection, not thinking level selection
- **No spec covers**: The thinking level selector UI or the `set_thinking_level` protocol flow end-to-end

---

## 5. Cross-Cutting Gaps

### 5.1 Event Reducer (`event-reducer.ts`)
The event reducer is the core of the client state management — it converts `DashboardEvent` streams into `SessionState` (messages, tool calls, streaming state, stats, pending prompts). No spec covers:
- How events map to chat messages
- Streaming text assembly
- Tool call state machine (running → complete/error)
- Pending prompt mechanism
- Session compact handling

**Recommendation**: Create `event-reducer` spec

### 5.2 WebSocket Reconnection (Client)
`src/client/hooks/useWebSocket.ts` implements client-side reconnection with exponential backoff (1s→30s), 3-failure offline threshold, and auto-resubscription.
- No spec covers client-side WebSocket management
- **Recommendation**: Add to `mobile-resilience` spec or create `client-websocket` spec

### 5.3 REST API Surface
`src/shared/rest-api.ts` defines types for REST endpoints but no spec comprehensively documents the full REST API:
- `GET /api/sessions` — list all sessions
- `GET /api/events/:sessionId/:seq` — fetch single event
- `GET /api/workspaces` — list workspaces
- `POST /api/workspaces` — create workspace
- `PUT /api/workspaces/:id` — update workspace
- `DELETE /api/workspaces/:id` — delete workspace
- `GET /api/editors?path=` — detect editors (localhost-only)
- `POST /api/open-editor` — open editor (localhost-only)
- `POST /api/shutdown` — shutdown server (localhost-only)

Some are partially covered by `workspace-management` and `open-in-editor` specs. Sessions and events REST endpoints are not in any spec.

**Recommendation**: Create `rest-api` spec or add to `dashboard-server` spec

### 5.4 Bridge State Replay on Reconnect
The bridge replays full session entries via `replayEntriesAsEvents()` on every reconnect and session_register. The server clears events on `session_register` to avoid duplicates. This is a critical architectural behavior not fully specified.

**Recommendation**: Add to `bridge-extension` spec or `on-demand-session-replay` spec

### 5.5 Localhost Guard
`src/server/localhost-guard.ts` is a reusable Fastify preHandler that restricts endpoints to loopback addresses. Used by `/api/editors`, `/api/open-editor`, `/api/shutdown`.
- Only mentioned in `open-in-editor` spec
- **Recommendation**: Document as shared infrastructure in `dashboard-server` spec

---

## 6. Priority Recommendations

### High Priority (architectural gaps)
1. **Update `packaging` spec** — Remove SQLite refs, fix config fields, remove/defer service templates
2. **Update `session-identity` spec** — Remove SQLite refs, reference in-memory + state-store
3. **Update `session-listing` spec** — Remove SQLite refs
4. **Create `token-stats-pipeline` spec** — End-to-end stats flow is unspecified
5. **Create `bridge-connection` spec** — Connection management is core infrastructure

### Medium Priority (feature gaps)
6. **Create `tool-renderers` spec** — Important client feature with no spec
7. **Create `event-reducer` spec** — Client state management core
8. **Create `rest-api` spec** — Full REST API surface
9. **Add heartbeat to `shared-protocol` spec** — Critical for session lifecycle
10. **Fix `extension-ui-forwarding` spec** — tool_call not implemented

### Low Priority (minor drift)
11. Update `git-context` spec with PR detection and link building
12. Update `model-selector` or create `thinking-level` spec
13. Update `open-in-editor` spec with file+line support
14. Add syntax theme mapping to `theme-gallery` spec
15. Create `dev-build-reload` spec or add to `packaging`
