## 1. Config & Shared Types

- [x] 1.1 Add `KnownServer` interface and `knownServers` field to `DashboardConfig` in `packages/shared/src/config.ts` with defaults (empty array)
- [x] 1.2 Add known-servers REST types to `packages/shared/src/rest-api.ts` (request/response shapes for list, add, remove, discover)

## 2. Server API

- [x] 2.1 Create `packages/server/src/routes/known-servers-routes.ts` with `GET /api/known-servers` (read from config), `POST /api/known-servers` (add/update with dedup), `DELETE /api/known-servers` (remove by host:port)
- [x] 2.2 Add `POST /api/discover-servers` endpoint that returns current `peerServers` map contents
- [x] 2.3 Register known-servers routes in `packages/server/src/server.ts` and pass `peerServers` reference to the discover endpoint
- [x] 2.4 Write tests for known-servers CRUD endpoints (add, add duplicate updates label, remove, remove idempotent, list)

## 3. ServerSelector Refactor

- [x] 3.1 Add client-side fetch helpers in `packages/client/src/lib/known-servers-api.ts` for list, add, remove, discover endpoints
- [x] 3.2 Refactor `ServerSelector.tsx` to load known servers from `GET /api/known-servers` instead of mDNS-discovered list; keep availability probing on dropdown open
- [x] 3.3 Update `App.tsx` / `useMessageHandler.ts` — `discoveredServers` state now feeds only the Settings discovery panel, not ServerSelector
- [x] 3.4 Write tests for ServerSelector rendering known servers with labels

## 4. Settings Panel — Servers Section

- [x] 4.1 Create `packages/client/src/components/KnownServersSection.tsx` — list known servers with label, host:port, remove button; "Add server" inline form with host, port, label fields
- [x] 4.2 Create `packages/client/src/components/NetworkDiscoverySection.tsx` — "Scan network" button, display discovered servers, "Add" button with label input prompt, "Already added" badge for known servers
- [x] 4.3 Integrate both sections into `SettingsPanel.tsx` as a "Servers" group at the top
- [x] 4.4 Write tests for KnownServersSection (render, add, remove) and NetworkDiscoverySection (scan, add with label, already-added detection)

## 5. Electron Integration

- [x] 5.1 Update Electron `showLoadingPage` in `packages/electron/src/main.ts` to load known servers from config and offer switching to another known server if the primary is unreachable
- [x] 5.2 Test Electron loading page with known servers fallback

## 6. Documentation

- [x] 6.1 Update AGENTS.md with new key files (known-servers-routes, KnownServersSection, NetworkDiscoverySection, known-servers-api)
- [x] 6.2 Update docs/architecture.md with known servers config field and API endpoints
