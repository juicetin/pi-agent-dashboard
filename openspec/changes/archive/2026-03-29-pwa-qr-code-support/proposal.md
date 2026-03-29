## Why

The dashboard is accessible remotely via zrok tunnel, but there's no easy way to open it on a mobile device. Users need to manually type or share the tunnel URL. Adding PWA support with a QR code dialog lets users scan and instantly open (or install) the dashboard on their phone, making mobile monitoring frictionless.

## What Changes

- Add a **web app manifest** (`manifest.json`) and basic **service worker** for PWA installability (icon, name, theme color, offline shell)
- Add a `<meta>` viewport/theme-color tag and manifest link to `index.html`
- Expose the **active tunnel URL** from the server via a new REST endpoint (`GET /api/tunnel-status`)
- Add a **QR code button** to the sidebar header (next to the π logo) that is only visible when a tunnel is active
- Clicking the button opens a **QR code dialog** showing the tunnel URL as a scannable QR code, with the URL displayed as copyable text below
- Use a lightweight client-side QR code library (e.g., `qrcode` npm package) to generate the QR code — no server-side rendering needed

## Capabilities

### New Capabilities
- `pwa-manifest`: Web app manifest, service worker registration, and PWA metadata for installability
- `qr-code-dialog`: QR code dialog triggered from sidebar header, showing tunnel URL as scannable code with copy-friendly text

### Modified Capabilities
- `zrok-tunnel`: Expose tunnel URL via REST endpoint so the client can query tunnel status and URL

## Impact

- **New files**: `public/manifest.json`, `public/sw.js`, `src/client/components/QrCodeDialog.tsx`
- **Modified files**: `src/client/index.html` (manifest link, meta tags), `src/server/server.ts` (tunnel status endpoint, store tunnel URL), `src/client/components/SessionSidebar.tsx` (QR button in header), `src/shared/rest-api.ts` (tunnel status types)
- **New dependency**: `qrcode` npm package (client-side QR generation)
- **No breaking changes**
