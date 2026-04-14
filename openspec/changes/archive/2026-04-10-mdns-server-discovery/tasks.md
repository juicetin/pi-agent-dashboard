## 1. Server Identity Detection

- [x] 1.1 Create `src/shared/server-identity.ts` with `isDashboardRunning(port)` health-check function returning `{ running, pid?, portConflict? }`
- [x] 1.2 Write tests for health-check identity verification (dashboard, other service, nothing, timeout)
- [x] 1.3 Replace `isPortOpen()` with `isDashboardRunning()` in `src/server/server-pid.ts` (`isServerRunning` function)
- [x] 1.4 Replace `isPortOpen()` with `isDashboardRunning()` in `src/server/cli.ts` (`cmdStart`, `cmdStatus`)
- [x] 1.5 Add port conflict error message to `cmdStart` when port is occupied by another service
- [x] 1.6 Update `src/extension/server-auto-start.ts` to use `isDashboardRunning()` instead of `isPortOpen()`
- [x] 1.7 Write tests for updated CLI and bridge detection logic

## 2. Shared mDNS Discovery Module

- [x] 2.1 Add `bonjour-service` dependency to `package.json`
- [x] 2.2 Create `src/shared/mdns-discovery.ts` with `advertiseDashboard(port, piPort)`, `stopAdvertising()`, `discoverDashboard(timeout)`, and `createBrowser()` (continuous browsing with `server-up`/`server-down` events)
- [x] 2.3 Implement localhost detection logic — classify discovered services as local vs remote based on hostname/IP matching
- [x] 2.4 Implement fallback: when mDNS times out, probe `localhost:<config.port>` via `isDashboardRunning()` from `server-identity.ts`
- [x] 2.5 Write tests for mDNS advertise/discover, localhost preference, and fallback chain

## 3. Server mDNS Integration

- [x] 3.1 Add mDNS advertisement to `src/server/server.ts` — call `advertiseDashboard()` on startup, `stopAdvertising()` on shutdown
- [x] 3.2 Add continuous mDNS browser to server — browse for peer `_pi-dashboard._tcp` services, maintain discovered servers list
- [x] 3.3 Add `servers_discovered` and `servers_updated` messages to `src/shared/browser-protocol.ts`
- [x] 3.4 Broadcast discovered peer servers to browsers via `servers_discovered` on subscribe and `servers_updated` on change
- [x] 3.5 Write tests for server mDNS advertisement and peer discovery broadcasting

## 4. Bridge mDNS Discovery

- [x] 4.1 Update `src/extension/server-auto-start.ts` to use mDNS browse → fallback to `isDashboardRunning()` → auto-start
- [x] 4.2 Update `src/extension/bridge.ts` connection logic to use discovered server address instead of hardcoded config port
- [x] 4.3 After auto-starting server, wait for mDNS advertisement before connecting (up to 10s, fallback to config probe)
- [x] 4.4 Write tests for bridge mDNS discovery and fallback

## 5. Config Changes

- [x] 5.1 Add `lastServer` field to `DashboardConfig` in `src/shared/config.ts` with default `undefined`
- [x] 5.2 Update `pi-dashboard status` to use mDNS discovery first, falling back to PID + health check
- [x] 5.3 Write tests for new config field and CLI status with mDNS

## 6. Server Selector UI

- [x] 6.1 Create `src/client/components/ServerSelector.tsx` — dropdown in dashboard header showing discovered servers with hostname, port, Local/Remote badge, connection status
- [x] 6.2 Add WebSocket message handler for `servers_discovered` and `servers_updated` in `src/client/hooks/useMessageHandler.ts`
- [x] 6.3 Implement server switching: close current WebSocket, open new connection to selected server, re-subscribe
- [x] 6.4 Persist last-used server in `localStorage` (`pi-dashboard-last-server`) and reconnect on load
- [x] 6.5 Integrate `ServerSelector` into sidebar/header layout
- [x] 6.6 Write tests for server selector state management and switching logic
