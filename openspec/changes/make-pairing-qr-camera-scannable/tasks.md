# Tasks — Make the pairing QR camera-scannable

## 1. Tests first (TDD)
- [ ] 1.1 Unit-test a new `encodePairingQrUrl(payload, baseUrl)` helper: output is a valid `https://<baseUrl>/pair#pi:pair:v1.<b64>` URL, and its fragment decodes back to the original `{ v, id, code, urls[] }`.
- [ ] 1.2 Assert the payload rides in the URL **fragment**, not the query string (nothing after `?`, everything after `#`).
- [ ] 1.3 Assert the copy-string is still the bare `pi:pair:v1.<b64>` (unchanged), distinct from the QR URL.
- [ ] 1.4 Browser `PairView`: test that reading a `#pi:pair:v1.<b64>` hash decodes the payload and drives redeem→confirm→poll (mock `/api/pair/*`), showing the confirm code and, on approved poll, storing the bearer.
- [ ] 1.5 Electron decode tolerance: `decodePayloadString("https://ep/pair#pi:pair:v1.<b64>")` returns the same payload as `decodePayloadString("pi:pair:v1.<b64>")`.
- [ ] 1.6 Verify 1.1/1.2 fail against the current `encodePayloadString`-only QR.

## 2. QR content (client)
- [ ] 2.1 Add `encodePairingQrUrl(payload, baseUrl)` alongside `encodePayloadString` in `GatewayPairQR.tsx` (or a shared lib): wrap the base64url payload as `https://<baseUrl>/pair#pi:pair:v1.<b64>`.
- [ ] 2.2 Pick the landing `baseUrl` = the primary TLS pairing endpoint (`pairingEps[0]`, https form). Feed `encodePairingQrUrl(...)` into the pairing `QrCanvas`; keep the copy-string as `encodePayloadString(...)`.
- [ ] 2.3 Leave link QRs (no-TLS bare URLs) unchanged.

## 3. Browser pairing landing (`/pair`)
- [ ] 3.1 Add a `/pair` route serving a browser `PairView` component (port of `packages/shell/src/components/PairView.tsx`).
- [ ] 3.2 Read `location.hash`, strip leading `#`, `decodePayloadString` → payload; error state when hash missing/invalid.
- [ ] 3.3 Run the identical handshake against `payload.urls[]`: challenge (verify fingerprint == `payload.id`, refuse on mismatch) → redeem → show confirm code → poll.
- [ ] 3.4 Swap the keyring sink for a browser bearer store (localStorage/cookie); on approved poll, persist the token and route into the dashboard.
- [ ] 3.5 Same-origin `/api/pair/*` calls (no CORS); handle expired/rejected/unknown poll states with a clear restart affordance.

## 4. Electron wrapper tolerance
- [ ] 4.1 In `packages/shell/.../protocol.ts` `decodePayloadString` (or `PairView.scanQr`): if input is an `https` URL, use its fragment as the payload before decoding. Non-URL input unchanged.

## 5. Security (security-hardening)
- [ ] 5.1 Confirm the one-time code appears only in the fragment and in the redeem POST body — never in a query string or any logged URL.
- [ ] 5.2 Confirm the browser `PairView` refuses to proceed on server-fingerprint mismatch (challenge step preserved).
- [ ] 5.3 Confirm D12 desktop typed-approval is required and unchanged (a scan alone cannot self-approve).

## 6. Docs
- [ ] 6.1 Update the `GatewayPairQR.tsx` row in `packages/client/src/components/Gateway/AGENTS.md` — pairing QR encodes an https `/pair#payload` deep link; copy-string unchanged. Add `See change: make-pairing-qr-camera-scannable`.
- [ ] 6.2 Add an `AGENTS.md` row for the new `/pair` route + browser `PairView`.
- [ ] 6.3 Update the `GatewayPairQR.tsx` header comment to describe the https-wrapped pairing QR.

## 7. Validate
- [ ] 7.1 `openspec validate make-pairing-qr-camera-scannable --strict` passes.
- [ ] 7.2 Manual: scan the pairing QR with a real phone camera → browser opens `/pair` → confirm code shown → desktop operator approves → phone lands in the dashboard authenticated.
- [ ] 7.3 Manual: Electron "Scan QR" of the same code still pairs; copy-string paste still pairs.
