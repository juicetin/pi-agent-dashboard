## Context

Pi agent sessions run in terminals and editors (Zed) without centralized visibility. Users working across multiple projects have no way to monitor, interact with, or manage sessions from a single interface — particularly from mobile devices. Pi provides a rich extension API with event hooks and an `pi.events` shared bus, plus an RPC protocol for programmatic control. This design leverages these capabilities to build a web dashboard that mirrors and interacts with live pi sessions.

The system consists of three components: a global pi extension (bridge), a Node.js dashboard server, and a React web client. Communication uses WebSocket between all layers with SQLite persistence on the server.

## Goals / Non-Goals

**Goals:**
- Mirror all pi session activity in real-time in a web browser
- Bidirectional interaction: send prompts and commands from the browser
- Workspace-level organization of sessions by project folder
- Mobile-friendly access with resilient reconnection
- Spawn new pi sessions from the dashboard via tmux
- 30-day event retention with lazy-loaded content for performance
- Distribute as a pi package (npm)

**Non-Goals:**
- Replacing the TUI — the dashboard is a complement, not a replacement
- Authentication/authorization (deferred; OAuth planned for later)
- Multi-user collaboration (single-user dashboard)
- Custom LLM configuration from the dashboard (use pi's TUI/config for that)
- Full extension UI interactivity from browser (read-only display of dialogs for v1)
- Session file management (creating/deleting pi session files)

## Decisions

### 1. Three-component architecture (Extension + Server + Client)

**Decision:** Separate bridge extension, standalone Node.js server, and React web client.

**Alternatives considered:**
- *Extension-only with embedded HTTP server*: Each pi session would serve its own web UI. Problem: 20 sessions = 20 servers, no aggregation, no shared state.
- *RPC-mode approach*: Dashboard spawns pi subprocesses via `pi --mode rpc`. Problem: Can't observe existing TUI sessions, only dashboard-launched ones.
- *Chainlit integration*: Use Chainlit (Python) as the web UI. Problem: Chainlit assumes it owns the LLM conversation; using it "inside out" wastes 80% of its machinery and adds a Python dependency.

**Rationale:** The bridge extension runs inside every pi session (global install), capturing events at the source. The server aggregates across sessions and provides persistence. The client renders the UI. Clean separation of concerns, single codebase (all TypeScript), no impedance mismatch.

### 2. WebSocket for all real-time communication

**Decision:** WebSocket between extension↔server and server↔browser. REST only for non-real-time operations (workspace CRUD, lazy content fetch).

**Alternatives considered:**
- *Server-Sent Events (SSE)*: Simpler for server→browser push, but can't do bidirectional (would need separate POST endpoint for commands). SSE also has connection limit issues in HTTP/1.1.
- *HTTP polling*: Simple but high latency for streaming text deltas.
- *gRPC*: Good for typed protocols but overkill for this scale, adds complexity.

**Rationale:** WebSocket gives bidirectional real-time communication. The streaming text deltas from pi arrive at LLM speed (10-50 tokens/second) — WebSocket handles this trivially. 20 concurrent sessions × 2 connections (extension + browser) = 40 WebSocket connections, well within single-process capability.

### 3. SQLite for persistence

**Decision:** Single SQLite database at `~/.pi/dashboard/dashboard.db` using `better-sqlite3` (synchronous API).

**Alternatives considered:**
- *PostgreSQL*: Overkill for single-user local dashboard.
- *In-memory only*: Loses state on server restart, no historical browsing.
- *Pi's session files (.jsonl)*: Could read directly, but they're append-only trees, not optimized for the queries we need (sequence-based replay, time-range filtering).
- *LevelDB/RocksDB*: Good for append-heavy workloads but adds native dependency complexity.

**Rationale:** SQLite is zero-config, handles our scale trivially, and `better-sqlite3` provides fast synchronous access. The write load is modest: even at peak (20 sessions streaming simultaneously), we're writing ~1000 events/second, well within SQLite's capability. The 30-day retention keeps the database bounded.

### 4. Lazy-loaded collapsed tool content

**Decision:** Tool call steps are collapsed by default. Browser holds only metadata (tool name, summary). Full content fetched via REST on expand.

**Alternatives considered:**
- *Send everything, render collapsed*: Simpler but DOM/memory grows unbounded. A session with 500 tool calls at ~50KB each = 25MB in browser memory.
- *Virtual scrolling with full data*: Helps DOM but not memory.
- *Stream content chunks on expand*: Overkill; a single REST fetch is sufficient since tool results are finite.

**Rationale:** Mobile devices with limited memory benefit most. The REST fetch on expand adds ~50-100ms latency (localhost) which is imperceptible. Server already has the data in SQLite indexed by (sessionId, seq).

### 5. Event-driven state in browser (reducer pattern)

**Decision:** Browser maintains UI state via a reducer that processes events. On connect, server replays events; reducer builds the full UI state incrementally.

```
events stream → eventReducer(state, event) → new state → React renders
```

**Alternatives considered:**
- *Server-rendered state*: Server builds the full session view and sends it. Problem: duplicates rendering logic, doesn't work well with streaming.
- *Message-based state*: Store parsed messages instead of raw events. Problem: loses intermediate states (streaming progress, tool execution phases).

**Rationale:** The reducer pattern is natural for event-sourced systems. Same reducer handles both live events and replay, simplifying reconnection. State is deterministic: same events = same state, regardless of whether they arrived live or via replay.

### 6. Session source detection via environment variables

**Decision:** Bridge extension detects source (TUI/Zed/tmux) by checking environment variables: `PI_DASHBOARD_SPAWNED`, `ZED_TERM`, `TMUX`.

**Alternatives considered:**
- *User-configured labels*: Manual, error-prone.
- *Process tree inspection*: Platform-specific, fragile.
- *Connection metadata*: Extension can't easily know its context without env vars.

**Rationale:** Environment variables are reliable, cross-platform, and already set by the respective environments. `PI_DASHBOARD_SPAWNED` is set by the process manager when spawning, giving perfect detection for dashboard-launched sessions.

### 7. Tmux for session spawning

**Decision:** Spawn new pi sessions inside tmux windows within a `pi-dashboard` session.

**Alternatives considered:**
- *Background process*: No terminal for interaction, defeats "mirror" purpose.
- *Screen*: Less common than tmux, similar capability.
- *Platform terminal emulators*: Different on each OS (Terminal.app, gnome-terminal, Windows Terminal), fragile.
- *Embedded terminal in browser*: xterm.js — significant complexity, but interesting for v2.

**Rationale:** Tmux is cross-platform (macOS/Linux), widely installed, and allows both dashboard access AND direct terminal access to the same session. Users can `tmux attach -t pi-dashboard` to see all sessions. Windows falls back to WSL tmux or native cmd.

### 8. React + Tailwind + shadcn/ui for the web client

**Decision:** React for UI framework, Tailwind CSS for styling, shadcn/ui for components, Vite for bundling.

**Alternatives considered:**
- *Svelte/SvelteKit*: Lighter, but fewer chat UI components and libraries available.
- *Vanilla JS + Web Components*: Maximum control, but slow to build chat UI.
- *Vue*: Viable, but team familiarity matters and React ecosystem is larger.

**Rationale:** React has the most mature ecosystem for chat-like UIs. shadcn/ui provides command palette (for autocomplete), responsive sidebar, and other components out of the box. Tailwind handles responsive breakpoints cleanly. Vite provides fast builds and HMR for development.

### 9. Extension UI capture via tool_call hooks + pi.events bus

**Decision:** Capture extension UI interactions through two channels: (1) observing tool_call block/allow results, (2) listening on `pi.events` bus for `dashboard:ui` events from user's own extensions.

**Alternatives considered:**
- *Require all extensions to broadcast*: Too invasive, breaks third-party extensions.
- *Monkey-patch ctx.ui*: The bridge extension doesn't have access to other extensions' ctx.
- *Upstream pi change (ui_request/ui_response events)*: Cleanest but requires pi core contribution. Planned for v2.

**Rationale:** tool_call hooks catch the most visible extension interaction (permission gates that block commands). The pi.events bus allows opt-in broadcasting from user's own extensions with minimal code changes. Together they cover ~90% of practical cases. The upstream pi change is the right long-term solution.

## Risks / Trade-offs

**[Risk: Extension UI gaps]** → Some extension UI interactions (notifications, dialogs from third-party extensions) are invisible to the bridge extension. Mitigation: capture what we can (tool_call blocks, pi.events bus), document gaps, plan upstream pi PR for comprehensive UI event hooks.

**[Risk: WebSocket reliability on mobile]** → Mobile connections drop frequently (WiFi↔cellular handoff, sleep). Mitigation: exponential backoff reconnection, sequence-based event replay to catch up, offline message queue. The 30-day SQLite store ensures no data loss server-side.

**[Risk: SQLite write contention]** → 20 sessions streaming simultaneously = high write volume. Mitigation: `better-sqlite3` uses synchronous writes (no WAL contention), batch inserts for event replay, and the write volume (~1000 events/sec peak) is well within SQLite's capabilities.

**[Risk: Large session replay]** → A session with hours of streaming could have thousands of events. Mitigation: replay in batches of 200, tool content not included in replay (lazy-loaded), and the event reducer processes incrementally.

**[Risk: tmux not available]** → Some users won't have tmux installed. Mitigation: graceful degradation — session spawning is disabled with a clear message, all other features work. Windows falls back to cmd.

**[Risk: Port conflicts]** → Default ports (8000, 9999) may be in use. Mitigation: configurable ports via CLI, env vars, and config file. Clear error message on port conflict.

**[Trade-off: All TypeScript]** → No Python in the stack, despite Chainlit being Python. This means we build more UI from scratch but gain: single language, shared types across all components, no cross-language serialization issues, simpler deployment.

**[Trade-off: Read-only extension UI in dashboard]** → Extension dialogs shown in TUI are only displayed read-only in the dashboard (not interactive). This avoids the dual-responder problem (who answers the dialog — TUI or dashboard?). Interactive dashboard responses can be added later when the upstream pi UI event protocol is available.

## Migration Plan

Not applicable — greenfield project. No existing system to migrate from.

**Rollback:** Since this is an additive extension package, uninstalling (`pi remove @user/pi-dashboard`) cleanly removes all integration. No pi core changes required.

## Open Questions

1. **xterm.js terminal embedding** — Should the dashboard embed actual terminal views (via xterm.js) in addition to the chat mirror? This would allow full TUI interaction from the browser, making the "mirror" truly bidirectional. Significant complexity but high value for mobile.

2. **Multi-device session handoff** — If a user views a session on desktop and then on mobile, should there be any handoff semantics? Currently both just see the same stream independently.

3. **Bandwidth optimization for mobile** — Should the server support a "mobile mode" that skips thinking deltas and reduces streaming frequency (batch deltas into 100ms chunks)? Or is this premature optimization?

4. **Dashboard-to-dashboard** — If someone runs two dashboard servers (e.g., different machines), should extensions support multiple server connections? For now, single server only.
