## 1. Phase 1 — Bump piCompatibility

- [ ] 1.1 In `packages/server/package.json::piCompatibility`:
  - [ ] 1.1.1 Change `minimum: "0.75.0"` → `"0.76.0"`.
  - [ ] 1.1.2 Change `recommended: "0.75.5"` → `"0.76.0"`.
  - [ ] 1.1.3 Leave `maximum: null` unchanged.
- [ ] 1.2 In `packages/server/package.json::dependencies`, bump `"@earendil-works/pi-coding-agent"` from `^0.75.0` → `^0.76.0` so a fresh `npm install @blackbelt-technology/pi-dashboard-server` doesn't resolve a pi that the new floor would reject.

## 2. Phase 2 — Bundled-extension peer-deps in lockstep

- [ ] 2.1 `packages/electron/resources/bundled-extensions/pi-anthropic-messages/package.json`: peer-dep `@earendil-works/pi-coding-agent` `">=0.75.0"` → `">=0.76.0"`.
- [ ] 2.2 `packages/electron/resources/bundled-extensions/pi-flows/package.json`:
  - [ ] 2.2.1 `peerDependencies`: `pi-ai`, `pi-coding-agent`, `pi-tui` all `^0.75.0` → `^0.76.0`.
  - [ ] 2.2.2 `devDependencies`: same three packages, `^0.75.0` → `^0.76.0`.
- [ ] 2.3 Catch-all: `grep -rn '0\.75' packages/electron/resources/bundled-extensions/ --include='package.json'`. Expect no output post-edit. Bump any survivors discovered.

## 3. Phase 3 — Lint table update

- [ ] 3.1 In `packages/shared/src/__tests__/bundled-node-meets-pi-floor.test.ts`, add a row to `PI_MIN_TO_NODE_FLOOR`: `"0.76.0": { major: 22, minor: 19 }` (pi 0.76 inherits 0.75's Node floor; no change). Add the row alongside the existing `0.75.0` entry; keep the table sorted by version.
- [ ] 3.2 Confirm the test passes with the new floor.

## 4. Phase 4 — Verification (automated)

- [ ] 4.1 `npm test -- pi-version-skew bundled-node-meets-pi-floor` passes.
- [ ] 4.2 No other test in the suite asserts against the literal `"0.75.0"` as a floor sentinel (synthetic fixtures referencing `"0.74.0"` / `"0.75.0"` as versions for resolution tests are not floor literals; they keep passing).

## 5. Phase 5 — Manual smoke (BEFORE merge)

- [ ] 5.1 Clean install `npm i -g @earendil-works/pi-coding-agent@0.76.0`. Spawn a dashboard session against it. Verify `GET /api/health` shows the new floor; the bootstrap banner is clean (no upgrade hint, no blocking error).
- [ ] 5.2 Downgrade locally to `@earendil-works/pi-coding-agent@0.75.5`. Re-spawn. Verify the bootstrap banner renders the red "below minimum" state pointing at `0.76.0`.
- [ ] 5.3 (Optional) Quick functional smoke: a model-proxy compaction round-trip on 0.76, watching for any regression from the new `retry.provider.maxRetries` enforcement (`#4991`). If `model-proxy.jsonl` shows unexpected retry behavior, file a follow-up; do NOT block this change on it unless the proxy is broken end-to-end.

## 6. Documentation

- [ ] 6.1 Append a CHANGELOG entry under `## [Unreleased] / ### Changed`: "Bump pi compatibility floor to 0.76.0 (recommended 0.76.0). Tracks the latest upstream pi-coding-agent release; no Node engines change."
- [ ] 6.2 No update needed to `AGENTS.md` Key Files — the affected rows (`piCompatibility` in `server/package.json`, peer-deps in bundled-extensions) are not architectural backbone.
- [ ] 6.3 No update needed to `docs/file-index-server.md` or `docs/file-index-shared.md` — the change-history annotation on `pi-version-skew.ts` already references the floor-tracking pattern; this is one more tick on the same surface.

## 7. Post-merge

- [ ] 7.1 Verify `/api/bootstrap/status.compatibility.recommended === "0.76.0"` on a clean install.
- [ ] 7.2 Verify a user on pi 0.75.x sees `compatibility.error` + the red "below minimum" banner.
- [ ] 7.3 Open follow-up issues for optional 0.76 adoption work (each one a separate proposal candidate):
  - Consume `--session-id` for deterministic session creation from the dashboard (would let server-spawn-from-UI carry an explicit id end-to-end).
  - Consume RPC `excludeFromContext` from the RPC keeper for out-of-band bash probes (version checks, health pings) without polluting model context.
  - Surface `retry.provider.maxRetries` in the model-proxy custom-provider UI.
