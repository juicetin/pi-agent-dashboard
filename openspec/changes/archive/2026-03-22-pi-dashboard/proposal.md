## Why

Pi agent sessions run in terminals and Zed editor across multiple projects. There is no way to observe, interact with, or manage these sessions from a single place — especially from a mobile device. When working across 1–20 concurrent sessions, switching between terminals is cumbersome, and there is no remote access at all.

A web-based dashboard would mirror all active pi sessions in real-time, allow bidirectional interaction (send prompts, run commands), and provide workspace-level organization with session statistics — accessible from any browser including mobile phones.

## What Changes

- **New pi extension** (`bridge`): global extension that runs in every pi session, forwards all events to the dashboard server via WebSocket, and relays commands back to pi.
- **New dashboard server**: Node.js HTTP + WebSocket server that aggregates events from all pi sessions, persists them in SQLite (30-day retention), and serves the web client. Includes a process manager for spawning new pi sessions via tmux.
- **New web client**: React-based responsive UI with workspace bar, session sidebar with live stats, chat view with streaming messages, collapsed/lazy-loaded tool calls, command autocomplete, and extension UI forwarding.
- **Workspace management**: project folders as workspaces, sessions auto-grouped by `cwd` prefix match, ability to add/remove/reorder workspaces.
- **New session spawning**: launch pi inside tmux from the dashboard, cross-platform (macOS, Linux, Windows+WSL).
- **Shared protocol types**: TypeScript types for extension↔server and server↔browser communication.

## Capabilities

### New Capabilities
- `shared-protocol`: Shared TypeScript types and message definitions for extension↔server and server↔browser WebSocket communication, plus REST API types.
- `bridge-extension`: Global pi extension that connects to the dashboard server, detects session source (TUI/Zed/tmux), forwards all pi events, relays commands, sends command lists for autocomplete, and handles reconnection with state sync.
- `dashboard-server`: Node.js server with dual WebSocket endpoints (pi extensions on `:9999`, browsers on `:8000`), SQLite persistence, event replay buffer, session registry, workspace management API, and stats aggregation.
- `workspace-management`: Workspace CRUD (add, rename, remove, reorder project folders), session-to-workspace matching via cwd prefix, auto-discovery of project folders, and workspace bar UI.
- `session-sidebar`: Active session list with live stats (model, thinking level, token count, cost, current tool, status indicator, source badge), inactive session toggle with filters, and mobile swipe drawer.
- `chat-view`: Message rendering (user, assistant, tool calls), streaming text with cursor, collapsed tool call steps with lazy-loaded content on expand, syntax-highlighted code blocks, file diff rendering, markdown rendering, auto-scroll with scroll lock.
- `command-autocomplete`: Input box with `/` prefix autocomplete dropdown showing extension commands, skills, and prompt templates with source badges, client-side filtering, argument autocomplete proxied to extensions, keyboard and touch navigation.
- `event-persistence`: SQLite event store with sequence numbers, 30-day retention with daily cleanup, replay protocol for browser reconnection catch-up, split storage (metadata in memory, heavy content fetched on demand).
- `process-manager`: Spawn pi in tmux from dashboard, platform detection (macOS/Linux/Windows+WSL), tmux session management (`pi-dashboard` session), environment markers, error handling.
- `extension-ui-forwarding`: Hook `tool_call` events to detect blocked calls (confirms/selects), listen on `pi.events` bus for own extensions' UI broadcasts, render dialogs and notifications read-only in dashboard, display results when available.
- `mobile-resilience`: Responsive layout (desktop↔mobile breakpoints), workspace dropdown on mobile, session swipe drawer, collapsed tool calls by default, horizontal-scroll code blocks, WebSocket auto-reconnect with exponential backoff, offline outgoing message queue, connection status indicator.
- `packaging`: Pi package format (npm with `pi.extensions` config), `pi-dashboard` CLI for server startup, configuration (ports, db path, retention), bundled web client via Vite, systemd/launchd service templates.

### Modified Capabilities
<!-- No existing specs to modify — this is a greenfield project. -->

## Impact

- **Dependencies**: React, Tailwind CSS, shadcn/ui, better-sqlite3 (or similar), ws, Vite, shiki (syntax highlighting).
- **Pi peer dependencies**: `@mariozechner/pi-coding-agent`, `@sinclair/typebox`, `@mariozechner/pi-tui`.
- **System requirements**: Node.js, tmux (optional, for spawning sessions).
- **Network**: Dashboard server listens on two ports (configurable). Mobile access requires same network or tunneling.
- **Storage**: SQLite database at `~/.pi/dashboard/dashboard.db`, grows with event volume, pruned to 30 days.
- **Code instructions**: TDD approach (tests first), DRY (shared protocol types, reusable components), minimal changes per task, architecture documentation maintained throughout.

## Phased Implementation

### Phase 1: Foundation — "See a session in a browser"
Capabilities: `shared-protocol`, `bridge-extension`, `dashboard-server` (core only), `chat-view` (basic)

### Phase 2: Workspace & Interaction — "Actually usable"
Capabilities: `workspace-management`, `session-sidebar`, `chat-view` (full), `command-autocomplete`

### Phase 3: Reliability — "Works on my phone"
Capabilities: `event-persistence`, `mobile-resilience`

### Phase 4: Power Features — "Complete system"
Capabilities: `process-manager`, `extension-ui-forwarding`, `packaging`
