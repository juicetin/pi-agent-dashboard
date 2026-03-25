# PI Dashboard

A web-based dashboard for monitoring and interacting with [pi](https://github.com/badlogic/pi-mono) agent sessions from any browser, including mobile.

## Features

- **Real-time session mirroring** — See all active pi sessions with live streaming messages
- **Bidirectional interaction** — Send prompts and commands from the browser
- **Workspace management** — Organize sessions by project folder
- **Command autocomplete** — `/` prefix triggers command dropdown with filtering
- **Session statistics** — Token counts, costs, model info, thinking level
- **Mobile-friendly** — Responsive layout with swipe drawer and touch targets
- **Session spawning** — Launch new pi sessions from the dashboard via tmux
- **Extension UI forwarding** — View blocked tool calls and extension notifications
- **30-day event retention** — Browse historical sessions with lazy-loaded content

## Installation

### From npm (published package)

**pi:**
```bash
pi install npm:@user/pi-dashboard
```

**Oh My Pi:**
```bash
omp install npm:@user/pi-dashboard
```

> The extension is compatible with both [pi](https://github.com/badlogic/pi-mono) and [Oh My Pi](https://www.npmjs.com/package/@oh-my-pi/pi-coding-agent). The same package works with either runtime — no configuration needed.

### Local development install

For developing or testing the dashboard locally, install dependencies first then register the package with pi:

```bash
# 1. Clone and install dependencies
cd /path/to/pi-chainlint
npm install

# 2. Install as a local pi package (globally)
pi install /path/to/pi-chainlint

# Or install for the current project only
pi install -l /path/to/pi-chainlint
```

This registers the local directory as a pi package. Pi reads the `pi.extensions` field from `package.json` and loads the bridge extension (`src/extension/bridge.ts`) automatically in every pi session.

#### Quick test (single session, no install)

To try the bridge extension without installing:

```bash
pi -e /path/to/pi-chainlint/src/extension/bridge.ts
```

This loads the extension only for the current pi session.

#### Manual settings entry

You can also add the package path directly to your settings file:

**Global** (`~/.pi/agent/settings.json`):
```json
{
  "packages": [
    "/path/to/pi-chainlint"
  ]
}
```

**Project-local** (`.pi/settings.json`):
```json
{
  "packages": [
    "/path/to/pi-chainlint"
  ]
}
```

#### Verifying the extension is loaded

After installing, start pi and check that the bridge extension is active:

```bash
pi
# Then use /reload to pick up changes during development
```

The bridge extension will automatically connect to the dashboard server at `ws://localhost:9999`. Set `PI_DASHBOARD_URL` to override:

```bash
PI_DASHBOARD_URL=ws://192.168.1.100:9999 pi
```

### Removing

```bash
pi remove /path/to/pi-chainlint
```

## Usage

### Auto-start (default)

By default, the bridge extension **automatically starts the dashboard server** when pi launches if it's not already running. You'll see a notification:

```
🌐 Dashboard started at http://localhost:8000
```

Just open that URL in your browser. No separate terminal needed.

To disable auto-start, set `autoStart` to `false` in `~/.pi/dashboard/config.json`.

### Manual start

If you prefer to manage the server yourself (or need `--dev` mode):

```bash
# From the project directory
npx tsx src/server/cli.ts

# Or with flags
npx tsx src/server/cli.ts --port 8000 --pi-port 9999

# Dev mode (proxies to Vite dev server for HMR)
npx tsx src/server/cli.ts --dev
```

> **Note:** Since this is a TypeScript project without a build step for the server, use `npx tsx` to run the CLI directly. After building for production, the `pi-dashboard` bin command will work directly.

### Typical local dev workflow

```bash
# Terminal 1: Start the dashboard server in dev mode
cd /path/to/pi-chainlint
npx tsx src/server/cli.ts --dev

# Terminal 2: Start Vite dev server (for HMR on the web client)
cd /path/to/pi-chainlint
npm run dev

# Terminal 3: Start pi with the bridge extension (auto-start disabled since server is already running)
pi -e /path/to/pi-chainlint/src/extension/bridge.ts
# Or if installed as a package, just:
pi

# Open http://localhost:3000 (Vite proxies API/WS to :8000)
```

### Configuration

Config file: `~/.pi/dashboard/config.json` (auto-created with defaults on first run)

```json
{
  "port": 8000,
  "piPort": 9999,
  "dbPath": "~/.pi/dashboard/dashboard.db",
  "retentionDays": 30,
  "autoStart": true,
  "devBuildOnReload": false
}
```

Configuration precedence: CLI flags → environment variables → config file → defaults.

| CLI Flag | Env Var | Default | Description |
|----------|---------|---------|-------------|
| `--port` | `PI_DASHBOARD_PORT` | 8000 | HTTP + Browser WebSocket |
| `--pi-port` | `PI_DASHBOARD_PI_PORT` | 9999 | Pi extension WebSocket |
| `--dev` | — | false | Proxy to Vite dev server |

#### Dev Build on Reload

Set `"devBuildOnReload": true` in `config.json` to enable a developer workflow where `/reload` in pi automatically rebuilds the Vite client and restarts the dashboard server. This gives you a one-command full-stack refresh during development.

```
/reload → build client → stop server → reload extension → auto-start fresh server
```

> **Note:** This blocks pi for ~2-5s during the client build. The server shutdown affects all connected sessions — they auto-reconnect when one of them restarts the server.

### As a system service

```bash
# macOS
pi-dashboard --install-service

# Linux
pi-dashboard --install-service
```

## Architecture

The dashboard consists of three components:

```
┌─────────────┐     WebSocket      ┌──────────────┐     WebSocket     ┌─────────────┐
│   Bridge    │ ◄─────────────────► │  Dashboard   │ ◄───────────────► │  Web Client  │
│  Extension  │    (port 9999)      │   Server     │    (port 8000)    │  (React)     │
│  (per pi)   │                     │  (Node.js)   │                   │  (Browser)   │
└─────────────┘                     └──────────────┘                   └─────────────┘
                                          │
                                    ┌─────┴─────┐
                                    │  SQLite   │
                                    │  Database │
                                    └───────────┘
```

1. **Bridge Extension** (`src/extension/`) — Runs in every pi session, forwards events to the server
2. **Dashboard Server** (`src/server/`) — Aggregates events, persists to SQLite, serves the web client
3. **Web Client** (`src/client/`) — React UI with real-time updates

See [docs/architecture.md](docs/architecture.md) for detailed documentation.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start dev server (with HMR)
pi-dashboard --dev

# Build for production
npm run build
```

### Project Structure

```
src/
├── shared/           # Shared TypeScript types
│   ├── protocol.ts        # Extension ↔ Server messages
│   ├── browser-protocol.ts # Server ↔ Browser messages
│   ├── types.ts           # Data models
│   └── rest-api.ts        # REST API types
├── extension/        # Bridge extension (runs in pi)
│   ├── bridge.ts          # Main extension entry
│   ├── connection.ts      # WebSocket with reconnection
│   ├── event-forwarder.ts # Event mapping
│   ├── source-detector.ts # Session source detection
│   └── command-handler.ts # Command relay
├── server/           # Dashboard server
│   ├── cli.ts             # CLI entry point
│   ├── server.ts          # HTTP + WebSocket server
│   ├── db.ts              # SQLite database
│   ├── event-store.ts     # Event persistence
│   ├── session-manager.ts # Session registry
│   ├── workspace-manager.ts # Workspace CRUD
│   ├── pi-gateway.ts      # Extension WebSocket
│   ├── browser-gateway.ts # Browser WebSocket
│   └── process-manager.ts # tmux session spawning
└── client/           # React web client
    ├── App.tsx
    ├── hooks/             # WebSocket hook
    ├── lib/               # Event reducer, command filter
    └── components/        # UI components
```

## Extension UI Events

Your own extensions can broadcast UI events to the dashboard:

```typescript
pi.events.emit("dashboard:ui", {
  method: "notify",
  message: "Deployment complete!",
  level: "success",
});
```

Supported methods: `confirm`, `select`, `input`, `notify`.

## License

MIT
