# pi-dashboard-honcho-plugin

Dashboard plugin for [pi-memory-honcho](https://github.com/ACSEZen/pi-memory-honcho) — adds a settings panel, per-session-card actions, and optional self-hosted Honcho server management to the pi-agent-dashboard.

## Install

```bash
pi-dashboard plugin install @blackbelt-technology/pi-dashboard-honcho-plugin
```

Or add to your dashboard's packages:

```bash
npm install @blackbelt-technology/pi-dashboard-honcho-plugin
```

## Prerequisites

- [pi-agent-dashboard](https://github.com/BlackBeltTechnology/pi-agent-dashboard) running
- [pi-memory-honcho](https://github.com/ACSEZen/pi-memory-honcho) extension installed in pi (the plugin prompts to install if missing)

### Self-host mode (optional)

- [Docker Desktop](https://docs.docker.com/get-docker/) or Docker Engine
- ~500 MB disk for Postgres + Honcho containers

## Cloud mode quickstart

1. Install the plugin (see above)
2. Open Settings → General → Honcho Memory
3. Enter your Honcho API key and workspace
4. Click "Save Connection"

The plugin reads/writes `~/.honcho/config.json` — the same file used by the pi-memory-honcho extension.

## Self-host quickstart

1. Install the plugin
2. Ensure Docker is running
3. Open Settings → General → Honcho Memory
4. Switch Mode to **Self-host**
5. (Optional) Pick an LLM model — defaults to pi-model-proxy if installed
6. Click Start

The plugin manages a Docker Compose stack (Postgres pgvector + Honcho API) at `~/.honcho/docker-compose.yml`. Data persists at `~/.pi-dashboard/honcho/pgdata/` by default.

**Ports:** API on `8765`, Postgres on `5455` (changed from upstream 8000/5432 to avoid collisions).

## Features

| Feature | Description |
|---------|-------------|
| Settings panel | Connection, recall mode, cloud/self-host, server lifecycle, LLM model picker, doctor, sync, interview, advanced flags |
| Session card badge | `🧠 <state>` on every session card |
| Session card actions | Interview, sync, map session name |
| Map name popover | Per-directory Honcho session name editor |
| Self-host lifecycle | Start/stop/restart Docker Compose stack from the dashboard |
| LLM model picker | Aggregate model dropdown grouped by source (pi-model-proxy, Anthropic, OpenAI, Gemini, custom) |

## Troubleshooting

### Docker missing

The plugin requires Docker for self-host mode. Install Docker Desktop and restart the dashboard.

### Port conflict

Default ports 8765 (API) and 5455 (Postgres) may conflict with other services. Change them in Settings → Server → API Port / DB Port, then restart.

### Migrations failed

If alembic migrations fail on first boot, the plugin sets state to `offline`. Check the error in the settings panel, fix the issue, then restart the server.

### Storage backend

Default `host-directory` bind-mounts Postgres data to `~/.pi-dashboard/honcho/pgdata/`. This has ~10-25% slower I/O on macOS/Windows. Switch to `docker-volume` for better performance (data moves out of home directory).

Changing storage backend requires stopping the stack first. Data is NOT migrated automatically — use `pg_dump`/`pg_restore` if needed.

## Development

This plugin lives in the pi-agent-dashboard monorepo at `packages/honcho-plugin/`.

```bash
npm install          # from repo root
npm test             # all tests
```

## License

MIT
