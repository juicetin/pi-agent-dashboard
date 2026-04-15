## Why

The server list is currently populated entirely from live mDNS discovery — servers only appear while they're broadcasting on the local network. If a remote server goes offline momentarily or mDNS is unreliable, the server disappears from the UI with no way to reconnect. Users need a persistent list of known servers they can always connect to, plus a management UI to discover and add new servers from the network.

## What Changes

- **Known servers config**: Add a `knownServers` array to `config.json` that persists user-added remote servers across restarts. Localhost is always implicit.
- **Settings panel — Servers section**: New section in settings showing the known servers list with remove buttons, plus a manual "Add server" form.
- **Network discovery section**: In the same settings area, show mDNS-discovered servers with an "Add" button that prompts for a user-friendly label before saving to known servers.
- **ServerSelector data source change**: The header dropdown switches from showing mDNS-discovered servers to showing known servers (with live availability probes). mDNS discovery moves to the settings management UI.
- **Manage servers shortcut**: The server selector dropdown includes a "Manage servers…" button at the top that navigates directly to the Servers tab in Settings.
- **Server API endpoints**: New REST endpoints to list, add, remove known servers, and trigger an on-demand mDNS network scan.
- **Future-ready data model**: Each known server entry is extensible for later key exchange / auth token fields.

## Capabilities

### New Capabilities
- `known-servers`: Persistent known server registry (config storage, CRUD API, settings UI, label-on-add flow, network discovery panel)

### Modified Capabilities
- `server-selector`: ServerSelector dropdown switches data source from mDNS-discovered to persisted known servers with availability probing

## Impact

- **Config**: `knownServers` field added to `DashboardConfig` in `packages/shared/src/config.ts`
- **Server routes**: New REST endpoints under `/api/known-servers` and `/api/discover-servers`
- **Config API**: `config-api.ts` must handle `knownServers` read/write
- **Server startup**: mDNS browser continues running but results feed the discovery UI rather than directly populating ServerSelector
- **Browser protocol**: `servers_discovered` / `servers_updated` messages may be replaced or supplemented by known-servers-based messages
- **Client**: New settings section component, ServerSelector refactored, manual add dialog with label input
