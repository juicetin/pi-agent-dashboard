## 1. PWA Manifest & Service Worker

- [x] 1.1 Create `public/manifest.json` with app name, icons, display mode, theme/background colors
- [x] 1.2 Create `public/sw.js` with minimal fetch event handler (network pass-through)
- [x] 1.3 Update `src/client/index.html` to add manifest link, theme-color meta, apple-mobile-web-app-capable meta
- [x] 1.4 Add service worker registration in `src/client/main.tsx` (with feature detection)

## 2. Tunnel Status Endpoint

- [x] 2.1 Add `TunnelStatusResponse` type to `src/shared/rest-api.ts`
- [x] 2.2 Add `GET /api/tunnel-status` endpoint in `src/server/server.ts` using `getTunnelUrl()`
- [x] 2.3 Write test for tunnel status endpoint (endpoint already existed)

## 3. QR Code Dialog Component

- [x] 3.1 Install `qrcode` npm package and `@types/qrcode`
- [x] 3.2 Create `src/client/hooks/useTunnelStatus.ts` hook (fetch on mount + 30s polling)
- [x] 3.3 Create `src/client/components/QrCodeDialog.tsx` (QR canvas, URL text, copy button, close)
- [x] 3.4 Write tests for QrCodeDialog component

## 4. Sidebar Integration

- [x] 4.1 Add QR code button to `src/client/components/SessionSidebar.tsx` header, conditionally rendered
- [x] 4.2 Wire up `useTunnelStatus` hook and QrCodeDialog open/close state
- [x] 4.3 Create a simple SVG π icon for the PWA manifest (`public/icon-192.png`, `public/icon-512.png`)

## 5. Documentation

- [x] 5.1 Update AGENTS.md key files table with new files
- [x] 5.2 Update docs/architecture.md with PWA and tunnel status endpoint details
