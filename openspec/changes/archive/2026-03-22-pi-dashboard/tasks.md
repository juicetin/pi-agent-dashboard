# Phase 1: Foundation — "See a session in a browser"

## 1. Project Setup

- [x] 1.1 Initialize monorepo structure: `src/shared/`, `src/extension/`, `src/server/`, `src/client/`, with `package.json`, `tsconfig.json`, and Vite config. Add `docs/architecture.md` describing the three-component architecture.
- [x] 1.2 Add dependencies: `better-sqlite3`, `ws`, `fastify` (or `hono`), `react`, `react-dom`, `tailwindcss`, `@sinclair/typebox`. Declare pi peer deps: `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`.
- [x] 1.3 Configure `package.json` with `pi.extensions` pointing to the bridge extension entry point, and `bin` pointing to the dashboard server CLI entry.

## 2. Shared Protocol Types

- [x] 2.1 Write tests for protocol message serialization round-trip (create a message, serialize to JSON, deserialize, assert equality). Cover extension→server, server→extension, server→browser, and browser→server message types.
- [x] 2.2 Define extension↔server WebSocket message types in `src/shared/protocol.ts`: `session_register`, `session_unregister`, `session_heartbeat`, `event_forward`, `commands_list`, `extension_ui_event`, `stats_update` (extension→server) and `send_prompt`, `abort`, `request_commands`, `request_state_sync` (server→extension). Each message has a `type` discriminator field.
- [x] 2.3 Define server↔browser WebSocket message types in `src/shared/browser-protocol.ts`: `session_added`, `session_updated`, `session_removed`, `event`, `event_replay`, `commands_list`, `extension_ui_event`, `workspace_updated` (server→browser) and `subscribe`, `unsubscribe`, `send_prompt`, `abort`, `request_commands`, `fetch_content` (browser→server).
- [x] 2.4 Define shared data model types in `src/shared/types.ts`: `Workspace`, `DashboardSession`, `DashboardEvent`, `SessionSource`, `SessionStatus`, `CommandInfo`. Define REST API response envelope `{ success, data?, error? }`.
- [x] 2.5 Define REST API types in `src/shared/rest-api.ts`: endpoint types for workspace CRUD, session listing, event content fetch, session spawn, and aggregate stats.

## 3. Bridge Extension — Core

- [x] 3.1 Write tests for session source detection: mock env vars (`PI_DASHBOARD_SPAWNED`, `ZED_TERM`, `TMUX`) and verify correct source is returned for each combination.
- [x] 3.2 Implement source detection in `src/extension/source-detector.ts`: check env vars in priority order, return `SessionSource`.
- [x] 3.3 Write tests for event-to-protocol mapping: given a pi event object, assert the correct protocol message is produced with sessionId and all fields.
- [x] 3.4 Implement event forwarder in `src/extension/event-forwarder.ts`: function that maps each pi event type to the corresponding `event_forward` protocol message. Extract only serializable fields.
- [x] 3.5 Write tests for reconnection logic: simulate connect/disconnect/reconnect cycles, verify backoff schedule (1s, 2s, 4s, 8s, max 30s), verify state sync sent on reconnect.
- [x] 3.6 Implement WebSocket connection manager in `src/extension/connection.ts`: connect to configurable URL, reconnect with exponential backoff, buffer events during disconnect (up to 1000), flush on reconnect.
- [x] 3.7 Implement main bridge extension in `src/extension/bridge.ts`: default export function that subscribes to all pi events, forwards via event forwarder, handles `session_start`/`session_shutdown`, sends `session_register`/`session_unregister`, sends heartbeat every 15s.
- [x] 3.8 Write tests for command relay: given a `send_prompt` message from server, verify `pi.sendUserMessage()` is called with correct args. Test idle vs streaming behavior (plain call vs `deliverAs: "followUp"`).
- [x] 3.9 Implement command handler in `src/extension/command-handler.ts`: listen for server→extension messages, dispatch `send_prompt` to `pi.sendUserMessage()`, `abort` to `ctx.abort()`, `request_commands` to `pi.getCommands()`.
- [x] 3.10 Implement state sync in bridge: on connect/reconnect, read `ctx.sessionManager.getBranch()`, convert entries to events, send in chunks of 100. Send `commands_list` on connect and after reload.

## 4. Dashboard Server — Core

- [x] 4.1 Write tests for SQLite schema creation: verify database file created, tables exist, indexes exist, migrations applied.
- [x] 4.2 Implement database layer in `src/server/db.ts`: create/open SQLite database, run migrations (create `sessions`, `events`, `workspaces`, `commands_cache` tables with indexes on `(session_id, seq)` and `(session_id, event_type)`).
- [x] 4.3 Write tests for event store: insert events, verify seq number assignment (monotonic per session, independent across sessions), query events by session and seq range.
- [x] 4.4 Implement event store in `src/server/event-store.ts`: insert event with auto-assigned seq, query events for replay (by sessionId + minSeq), fetch single event by sessionId+seq (for lazy loading).
- [x] 4.5 Write tests for session registry: register session (match to workspace by cwd prefix), update status, unregister, list active sessions.
- [x] 4.6 Implement session manager in `src/server/session-manager.ts`: in-memory registry backed by SQLite, register/unregister/update sessions, match session cwd to workspace path (longest prefix match).
- [x] 4.7 Implement Pi Gateway in `src/server/pi-gateway.ts`: WebSocket server on configurable port, accept extension connections, parse `session_register`, route incoming events to event store + browser broadcast, route browser commands to correct extension by sessionId. Handle heartbeat timeout (45s → mark ended).
- [x] 4.8 Implement Browser Gateway in `src/server/browser-gateway.ts`: WebSocket on HTTP port, accept browser connections, handle `subscribe`/`unsubscribe` (track which sessions each browser watches), broadcast events to subscribed browsers, handle `send_prompt`/`abort` by routing to Pi Gateway.
- [x] 4.9 Implement HTTP server in `src/server/server.ts`: serve static files (web client), mount REST API routes, start both WebSocket servers. Configuration via CLI flags → env vars → config file (with precedence).
- [x] 4.10 Implement server CLI in `src/server/cli.ts`: parse `--port`, `--pi-port`, `--dev` flags, load config from `~/.pi/dashboard/config.json`, start server, print URL.

## 5. Web Client — Basic Chat View

- [x] 5.1 Scaffold React app with Vite + Tailwind + shadcn/ui in `src/client/`. Configure build to output to `dist/client/` for bundling.
- [x] 5.2 Implement WebSocket hook in `src/client/hooks/useWebSocket.ts`: connect to dashboard server, parse incoming messages, expose send function. Basic reconnection (detailed resilience in Phase 3).
- [x] 5.3 Implement event reducer in `src/client/lib/event-reducer.ts`: reducer function `(state, event) → state`. Build session state from events: message list, current streaming text, tool call statuses, session metadata. Write tests: given a sequence of events, assert final state matches expected messages/tools.
- [x] 5.4 Implement basic session list in `src/client/components/SessionList.tsx`: show connected sessions with name, status indicator, model. Click to select.
- [x] 5.5 Implement basic chat view in `src/client/components/ChatView.tsx`: render messages from reducer state. User messages, assistant messages (with streaming text + cursor), basic tool call display (name only, no content).
- [x] 5.6 Implement basic input box in `src/client/components/MessageInput.tsx`: text input, Enter to send, send via `send_prompt` WebSocket message.
- [x] 5.7 Wire up App.tsx: layout with session list (left) + chat view (right) + input. Subscribe to sessions on connect, show selected session's chat.
- [x] 5.8 End-to-end smoke test: start dashboard server, start pi with bridge extension, verify session appears in browser, send a prompt from pi TUI, verify it shows in browser.

# Phase 2: Workspace & Interaction — "Actually usable"

## 6. Workspace Management

- [x] 6.1 Write tests for workspace CRUD: create workspace (validate path exists, reject duplicates), read, update (name, sortOrder), delete (sessions become unassigned).
- [x] 6.2 Implement workspace manager in `src/server/workspace-manager.ts`: CRUD operations backed by SQLite, validate path existence on create.
- [x] 6.3 Implement workspace REST API routes: `GET /api/workspaces`, `POST /api/workspaces`, `PUT /api/workspaces/:id`, `DELETE /api/workspaces/:id`.
- [x] 6.4 Write tests for workspace auto-discovery: given a mock filesystem, verify it finds folders with `.git/` or `.pi/`, excludes already-added workspaces.
- [x] 6.5 Implement auto-discovery in `src/server/workspace-manager.ts`: scan configurable base directories one level deep, return candidate folders.
- [x] 6.6 Implement WorkspaceBar component in `src/client/components/WorkspaceBar.tsx`: tabs/pills for each workspace with active session count badge, "+" button for add dialog, "All" view option.
- [x] 6.7 Implement AddWorkspaceDialog component: path input, auto-populated name from basename, cancel/add buttons, auto-discovery button.
- [x] 6.8 Wire workspace selection to session filtering: selecting a workspace filters the session sidebar to show only matching sessions.

## 7. Session Sidebar — Full Stats

- [x] 7.1 Implement stats accumulation in event reducer: track tokens_in, tokens_out, cost from `turn_end` events, current tool from `tool_execution_start`/`tool_execution_end`, status from `agent_start`/`agent_end`.
- [x] 7.2 Implement full SessionSidebar component in `src/client/components/SessionSidebar.tsx`: replace basic list with full sidebar showing source badge (TUI/Zed/tmux), model + thinking level, token count (formatted), cost (formatted), current tool, status indicator (streaming/idle/ended).
- [x] 7.3 Implement inactive sessions toggle: collapsed section showing ended sessions sorted by last activity, with filter to 30-day retention period. Load from REST API `GET /api/sessions?status=ended&workspaceId=X`.
- [x] 7.4 Implement "New session" button: call `POST /api/sessions/new` with workspaceId, show "Starting..." toast, session appears when bridge connects.

## 8. Chat View — Full Rendering

- [x] 8.1 Implement markdown rendering: integrate a markdown renderer (e.g., `react-markdown` or `marked`) for assistant messages with support for headings, bold/italic, lists, links, inline code, fenced code blocks, tables, blockquotes.
- [x] 8.2 Implement syntax highlighting: integrate `shiki` for code blocks. Detect language from fenced block tags or file extensions.
- [x] 8.3 Implement collapsed tool call steps in `src/client/components/ToolCallStep.tsx`: one-line summary by tool type (read → filepath, bash → command, edit → filepath, etc.), collapsed by default, expand/collapse toggle.
- [x] 8.4 Implement lazy content loading on expand: on expand, fetch `GET /api/events/:sessionId/:seq`, render full tool result. On collapse, remove heavy content from DOM. Show loading spinner while fetching.
- [x] 8.5 Implement file diff rendering in `src/client/components/DiffView.tsx`: green/red line highlighting for additions/removals in edit/write tool results.
- [x] 8.6 Implement thinking block rendering: collapsible "💭 Thinking..." section, collapsed by default, expands to show thinking text.
- [x] 8.7 Implement session header in `src/client/components/SessionHeader.tsx`: workspace name, session name, model, thinking level, token count, cost, duration (live-updating).
- [x] 8.8 Implement auto-scroll with scroll lock: auto-scroll to bottom on new content, pause when user scrolls up, "↓ New messages" button to resume, resume on manual scroll to bottom.
- [x] 8.9 Implement compaction indicator: visual divider when `session_compact` event arrives, with collapsible summary text.

## 9. Command Autocomplete

- [x] 9.1 Write tests for command filtering: given a command list and a filter string, verify correct matches (case-insensitive substring).
- [x] 9.2 Implement CommandInput component in `src/client/components/CommandInput.tsx`: detect `/` at start of input, show autocomplete dropdown, filter as user types, keyboard navigation (ArrowUp/Down, Enter, Escape, Tab).
- [x] 9.3 Implement source badges in dropdown: 📋 prompt, 🔧 skill, ⚡ extension. Show description alongside name.
- [x] 9.4 Implement argument autocomplete proxy: when command is selected and user types space + text, send `request_argument_completions` to bridge extension (via server), render results in dropdown.
- [x] 9.5 Implement multi-line input: Shift+Enter for newline, Enter to send. Textarea that grows with content.

# Phase 3: Reliability — "Works on my phone"

## 10. Event Persistence & Replay

- [x] 10.1 Write tests for 30-day retention cleanup: insert events with various timestamps, run cleanup, verify only events within retention period remain. Verify ended sessions with no remaining events are deleted.
- [x] 10.2 Implement retention cleanup job in `src/server/event-store.ts`: delete events older than `retentionDays`, delete orphaned ended sessions, run on server start and every 24 hours.
- [x] 10.3 Write tests for event replay batching: insert 500 events, request replay from seq 0, verify events arrive in batches of 200.
- [x] 10.4 Implement batched replay in Browser Gateway: on `subscribe` with `lastSeq`, query events, send in batches of 200 via `event_replay` messages.
- [x] 10.5 Implement state sync for inactive sessions: when browser selects an inactive session, load all events from SQLite and send via replay to browser.

## 11. Mobile & Connection Resilience

- [x] 11.1 Implement responsive layout in App.tsx: CSS breakpoints for desktop (≥1024px), tablet (768-1023px), mobile (<768px). Workspace bar → dropdown on tablet/mobile. Sidebar → swipe drawer on mobile.
- [x] 11.2 Implement mobile swipe drawer for session sidebar: swipe-from-left gesture, hamburger menu button, close on session select.
- [x] 11.3 Implement workspace dropdown for tablet/mobile: replace tabs with a dropdown selector.
- [x] 11.4 Implement WebSocket auto-reconnect with exponential backoff in `src/client/hooks/useWebSocket.ts`: 1s, 2s, 4s, 8s, 16s, max 30s. Reset on success. Re-subscribe to all sessions with last known seq on reconnect.
- [x] 11.5 Implement connection status indicator: 🟢 Connected (hidden), 🟡 Reconnecting (with countdown), 🔴 Disconnected (with retry button).
- [x] 11.6 Implement offline outgoing message queue in `src/client/lib/message-queue.ts`: queue messages while disconnected, deliver on reconnect, limit to 10 queued messages.
- [x] 11.7 Implement touch-friendly sizing: minimum 44px touch targets for all interactive elements on mobile. Horizontal scroll for code blocks.
- [x] 11.8 Test on mobile: verify layout, drawer, autocomplete, streaming, reconnection on actual mobile browser.

# Phase 4: Power Features — "Complete system"

## 12. Process Manager (tmux)

- [x] 12.1 Write tests for platform detection: mock `process.platform`, verify correct spawn strategy selected (macOS/Linux → tmux, Windows → WSL tmux or cmd fallback).
- [x] 12.2 Write tests for tmux command generation: verify correct `tmux new-session` vs `tmux new-window` based on whether `pi-dashboard` session exists.
- [x] 12.3 Implement process manager in `src/server/process-manager.ts`: detect platform, check tmux availability, spawn pi in tmux with `PI_DASHBOARD_SPAWNED=1` env var, handle errors.
- [x] 12.4 Implement spawn REST endpoint: `POST /api/sessions/new` validates workspace exists, delegates to process manager, returns success/error.
- [x] 12.5 Implement Windows support: WSL detection, fallback to `cmd /c` spawn.

## 13. Extension UI Forwarding

- [x] 13.1 Write tests for tool_call block detection: given a tool_call event that returns `{ block: true, reason }`, verify an `extension_ui_event` is produced.
- [x] 13.2 Implement tool_call hook in bridge extension: subscribe to `tool_call` events, detect blocked calls, forward as `extension_ui_event` with method, title, and result.
- [x] 13.3 Implement pi.events bus listener in bridge extension: listen for `dashboard:ui` events, forward as `extension_ui_event` to dashboard server.
- [x] 13.4 Implement ExtensionUI component in `src/client/components/ExtensionUI.tsx`: render confirm (✅/❌/⏳), select (selected option), input (entered value), notify (info/warning/error styling) inline in chat view.
- [x] 13.5 Document how user's own extensions can broadcast UI events to the dashboard via `pi.events.emit("dashboard:ui", ...)`. Add examples in README.

## 14. Packaging & Distribution

- [x] 14.1 Configure `package.json` for pi package: `pi.extensions`, `bin`, `keywords: ["pi-package"]`, peer deps with `"*"` range, runtime deps in `dependencies`.
- [x] 14.2 Configure Vite production build: output to `dist/client/`, include in npm package.
- [x] 14.3 Implement `--dev` mode in server CLI: proxy to Vite dev server for HMR during development.
- [x] 14.4 Implement `--install-service` in server CLI: copy systemd unit file (Linux) or launchd plist (macOS) to appropriate user directory, print enable instructions.
- [x] 14.5 Create service templates: `templates/pi-dashboard.service` (systemd) and `templates/ai.pi.dashboard.plist` (launchd).
- [x] 14.6 Create default config file on first run: write `~/.pi/dashboard/config.json` with defaults if it doesn't exist.
- [x] 14.7 Write README.md: installation (`pi install`), server start (`pi-dashboard`), configuration, architecture overview, screenshots/diagrams.
- [x] 14.8 Update `docs/architecture.md` with final architecture, data flow, protocol reference, and component documentation.
- [x] 14.9 Test full install flow: `npm pack`, `pi install` from tarball, verify extension loads, server starts, web client serves, end-to-end session mirroring works.
