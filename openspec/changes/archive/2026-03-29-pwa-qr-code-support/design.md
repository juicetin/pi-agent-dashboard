## Context

The dashboard can be exposed remotely via zrok tunnel, but there's no convenient way to open it on a phone. The server already tracks the active tunnel URL via `getTunnelUrl()` in `src/server/tunnel.ts`. The client has no knowledge of whether a tunnel is active or what the URL is. There is no PWA manifest or service worker, so the app can't be installed on mobile.

## Goals / Non-Goals

**Goals:**
- Make the dashboard installable as a PWA on mobile devices
- Expose the active tunnel URL to the web client via a REST endpoint
- Provide a QR code button in the sidebar header that shows a scannable QR code dialog when a tunnel is active
- Keep the QR code generation entirely client-side

**Non-Goals:**
- Offline-first functionality (service worker is minimal, just enough for installability)
- Push notifications
- Custom PWA icons (use a simple generated icon for now)
- Caching strategies beyond the basic shell

## Decisions

### 1. Tunnel status REST endpoint
Add `GET /api/tunnel-status` returning `{ active: boolean, url: string | null }`. Reuses existing `getTunnelUrl()` from `src/server/tunnel.ts`. No new state management needed.

**Why REST over WebSocket**: Tunnel status changes rarely (only on server start/stop). Polling or one-time fetch is sufficient. The client fetches once on mount and optionally polls every 30s.

### 2. QR code library: `qrcode` npm package
Use the `qrcode` package which can render to a canvas or data URL entirely client-side. It's lightweight (~30KB) and well-maintained.

**Alternative considered**: `qr.js` — smaller but less maintained and no TypeScript types.

### 3. Minimal PWA manifest
A `manifest.json` in `public/` with app name, theme color, display mode `standalone`, and a simple SVG icon. Vite serves `public/` as static assets.

### 4. Minimal service worker
A bare-bones `sw.js` that satisfies Chrome's installability requirements (fetch handler). No complex caching — the dashboard is always online when accessible.

### 5. QR button placement
Add a QR code icon button in the sidebar header (`SessionSidebar.tsx`), next to the π logo. The button is conditionally rendered — only when `tunnelUrl` is non-null. Uses `mdiQrcode` from `@mdi/js`.

### 6. QR code dialog
A new `QrCodeDialog.tsx` component rendered via `DialogPortal`. Shows:
- QR code (canvas rendered by `qrcode` library)
- Tunnel URL as selectable/copyable text
- A "Copy" button
- Close button

## Risks / Trade-offs

- **[Minimal service worker]** → The SW does almost nothing, but it's required for PWA installability. If we later want offline support, we extend it.
- **[Polling tunnel status]** → Client polls every 30s. Acceptable since tunnel changes are rare. If the tunnel goes down, the QR button disappears on next poll.
- **[No custom icon]** → PWA will use a simple SVG π icon. Can be improved later with proper icon set.
