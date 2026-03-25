## Context

During development, refreshing the full pi-agent-dashboard stack requires: building the Vite client, restarting the server, and reloading the extension. Currently these are separate manual steps. The bridge extension already has a cleanup hook on `/reload` that tears down timers and disconnects WebSocket. We can extend this hook to also build the client and shut down the server, so the existing `autoStart` flow spawns a fresh server on reconnect.

The server runs TypeScript via `tsx`, so it picks up code changes on restart without a build step. Only the Vite client needs an explicit build (`npm run build`).

## Goals / Non-Goals

**Goals:**
- Add `devBuildOnReload` config option to `DashboardConfig` (default `false`)
- On `/reload` with flag enabled: build client, stop server, log progress to terminal
- Add `POST /api/shutdown` endpoint to the dashboard server for graceful shutdown

**Non-Goals:**
- Server-side TypeScript compilation (tsx handles this)
- Async/background builds (blocking is acceptable for dev workflow)
- Protecting other sessions from server shutdown (accepted trade-off)

## Decisions

### 1. Synchronous build via `execSync`

Use `child_process.execSync("npm run build", { cwd: packageRoot })` in the cleanup hook. This blocks pi for ~2-5s but the user explicitly opted in via config. Progress is shown via `console.log` before and after the build.

**Alternative**: Async build with `spawn` — rejected because timing with the reload cycle is complex and the blocking delay is acceptable for a dev-only feature.

### 2. Package root resolution

Derive the package root from the extension file's `__dirname` — the extension lives at `src/extension/bridge.ts`, so `path.resolve(__dirname, '..', '..')` gives the package root. This works whether running from source or installed as a package.

### 3. HTTP shutdown endpoint

Add `POST /api/shutdown` to the Fastify server. It calls `server.stop()` then `process.exit(0)`. The bridge sends a fire-and-forget `fetch()` to this endpoint — no need to wait for a response since the server is dying.

**Alternative**: WebSocket protocol message — rejected because the cleanup hook disconnects WS first, and adding a shutdown message before disconnect adds ordering complexity.

### 4. Terminal logging

Use `console.log` with emoji prefixes for visibility:
- `🔨 Dashboard: building client...`
- `✅ Dashboard: client built`
- `🛑 Dashboard: stopping server...`
- `✅ Dashboard: server stopped`

On build failure, log the error but don't throw — the reload should still proceed.

## Risks / Trade-offs

- **[Blocking UI]** → Acceptable: dev-only, opt-in, ~2-5s
- **[Multi-session impact]** → Accepted: all sessions lose server briefly, auto-reconnect recovers
- **[Build failure]** → Mitigated: catch errors, log them, continue with reload
- **[Shutdown endpoint security]** → Low risk: server is localhost-only by default
