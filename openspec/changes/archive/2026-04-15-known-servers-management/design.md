## Context

The dashboard currently discovers peer servers exclusively via mDNS (bonjour-service). The server runs a continuous `createBrowser()` that emits `server-up`/`server-down` events, stored in an in-memory `peerServers` Map. On browser connect, `servers_discovered` is sent; on mDNS changes, `servers_updated` is broadcast. The `ServerSelector` dropdown renders this transient list. The only persistence is `lastServer` in config (last-used address string).

This means remote servers vanish when mDNS stops broadcasting, with no way to reconnect without re-discovery.

## Goals / Non-Goals

**Goals:**
- Persist a list of known remote servers in `config.json` that survives restarts
- Provide a Settings UI section to view, add (with label), and remove known servers
- Provide a network discovery sub-section that shows live mDNS results with "Add" action
- Switch `ServerSelector` dropdown to show known servers instead of raw mDNS list
- Keep the data model extensible for future key exchange / auth tokens

**Non-Goals:**
- Key exchange or mutual authentication between servers (future change)
- Automatic server trust / pairing
- Syncing known servers across machines
- Changing how mDNS advertisement works on the server side

## Decisions

### 1. Persist known servers in config.json

**Decision**: Add `knownServers: KnownServer[]` to `DashboardConfig`.

```typescript
interface KnownServer {
  host: string;
  port: number;
  label?: string;
  addedAt: string; // ISO timestamp
}
```

**Rationale**: Config is the natural persistence layer — already has `lastServer`, `trustedNetworks`, and similar user-managed lists. Using the existing `writeConfigPartial` merge flow avoids new persistence code. Localhost is always implicit and not stored.

**Alternative considered**: Separate `known-servers.json` file — rejected because it adds a new persistence file for a small list that fits naturally in config.

### 2. REST API for CRUD + discovery

**Decision**: New REST endpoints in a `server-routes.ts` or dedicated `known-servers-routes.ts`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/known-servers` | GET | List known servers (from config) |
| `POST /api/known-servers` | POST | Add a known server `{ host, port, label? }` |
| `DELETE /api/known-servers` | DELETE | Remove by `{ host, port }` |
| `POST /api/discover-servers` | POST | Trigger on-demand mDNS scan, return results |

**Rationale**: REST is simpler than WebSocket messages for CRUD operations. The discovery scan is also REST since it's request-response (scan → wait → results). Existing `writeConfigPartial` handles the config merge.

### 3. ServerSelector shows known servers + self

**Decision**: The header `ServerSelector` dropdown data source changes from `discoveredServers` (mDNS) to known servers loaded from the config API. Localhost/self is always shown first. Each entry gets a live availability probe (existing health-check pattern).

The existing `servers_discovered`/`servers_updated` WebSocket messages are kept but only feed the Settings discovery panel, not the header dropdown.

**Rationale**: Known servers are the stable, user-curated list. mDNS results are transient and belong in the management UI where users can promote them.

### 4. Settings panel "Servers" section

**Decision**: Add a new section to `SettingsPanel.tsx` with two sub-sections:

1. **Known Servers** — List with label, host:port, availability dot, remove (✕) button, and "Add manually" form
2. **Network Discovery** — "Scan" button triggers `POST /api/discover-servers`, results shown with "Add" button that opens a label input prompt before saving

**Rationale**: Settings is the right location — this is server configuration, not a workspace feature. The label prompt on add gives users control over how servers appear in the dropdown.

### 5. Label input on add

**Decision**: When adding a discovered server (or manually), show a small inline form or dialog with:
- Pre-filled host and port (read-only for discovered, editable for manual)
- Label text input (optional, defaults to hostname)
- Confirm/Cancel buttons

**Rationale**: User requested label support on add. Keeping it inline in the settings panel avoids a heavy dialog for a simple form.

### 6. Keep mDNS browser running on server

**Decision**: The continuous mDNS browser stays running on the server. It continues to populate `peerServers` for the on-demand scan endpoint and `servers_updated` broadcasts. The `POST /api/discover-servers` endpoint returns the current `peerServers` map contents (already collected) plus triggers a fresh short scan if the map is empty.

**Rationale**: mDNS browse is lightweight and having a warm cache means the scan endpoint responds instantly. No architectural change needed on the server mDNS side.

## Risks / Trade-offs

- **[Risk] Config file conflicts**: Multiple server instances writing `knownServers` simultaneously → **Mitigation**: `writeConfigPartial` already does atomic read-merge-write; known servers is a small list unlikely to cause real conflicts.
- **[Risk] Stale known servers**: A known server that's permanently gone stays in the list → **Mitigation**: Availability probes show status; user can remove manually. Future: auto-prune after N consecutive failures.
- **[Trade-off] REST vs WebSocket for CRUD**: REST is simpler but means the Settings panel needs fetch calls instead of WS messages → Acceptable since Settings already uses REST for config read/write.

### 7. Manual add saves without probing

**Decision**: When a user manually adds a server (or adds from discovery), save it to config immediately without checking availability. The discovery scan endpoint (`POST /api/discover-servers`) probes each result before returning. The ServerSelector dropdown probes on open (existing behavior).

**Rationale**: Users may add servers that are temporarily offline. Blocking on availability would prevent saving servers for later use.

### 8. Electron app uses the same web client

**Decision**: The Electron app loads the web client in a `BrowserWindow`. The `ServerSelector` refactor and Settings panel changes apply automatically inside Electron. The Electron loading/reconnect page (`showLoadingPage`) SHALL also consult known servers — if the primary server is unreachable, offer to connect to another known server.

**Rationale**: Electron is just a shell around the web client. Known servers are especially useful in Electron since users may launch the app while their usual server is on a different machine.
