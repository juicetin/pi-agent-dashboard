# Tasks

## 1. Doctor-core shape changes (TDD)

- [ ] 1.1 Add failing tests in `packages/shared/src/__tests__/doctor-core.test.ts` asserting `DoctorSection` accepts `"tunnel"` and that `SECTION_OF` maps the four new names.
- [ ] 1.2 Widen `DoctorSection` union to include `"tunnel"`; add the four `SECTION_OF` entries; add the four `SUGGESTIONS` entries.
- [ ] 1.3 Extend `SharedChecksDeps` with optional `getTunnelWatchdogStatus` and `dnsLookup`; default `dnsLookup` to `dns.promises.lookup`.

## 2. Per-check implementation (TDD per check)

- [ ] 2.1 `zrok binary` — test: missing → `warning` with `suggestion`; found → `ok` with resolved path in `detail`. Implement using `ToolResolver` (the same instance pattern tunnel.ts uses).
- [ ] 2.2 `zrok environment` — test: neither file exists → `warning`; v2 valid → `ok`; v1 valid → `ok` (with note); malformed JSON → `warning` (does not throw). Reuse the read logic from `loadZrokEnvironment` — factor out a pure `readZrokEnvironment(homedir)` helper in `packages/shared/src/zrok-env.ts` and import it from both tunnel.ts and doctor-core.ts.
- [ ] 2.3 `zrok API reachable` — test: lookup resolves → `ok`; `EAI_AGAIN` / `ENOTFOUND` → `warning` with reason in `detail`; timeout (3 s) → `warning` with "timeout 3000 ms" in `detail`. Use the injected `dnsLookup` seam.
- [ ] 2.4 `tunnel runtime` — test four branches: no watchdog dep injected → `ok` "no tunnel data available"; `getTunnelWatchdogStatus()` returns null → `ok` "no tunnel active"; status with `consecutiveFailures === 0` and fresh `lastSuccessAt` → `ok` with `url`/`recycleCount` in `detail`; status with `consecutiveFailures > 0` or stale `lastSuccessAt` → `warning` with `lastFailureReason` in `detail`.

## 3. Server wiring

- [ ] 3.1 In `packages/server/src/server.ts` (or wherever `runSharedChecks` is invoked from `/api/doctor`), inject `getTunnelWatchdogStatus` from `./tunnel-watchdog.js` into the deps object. Electron's invocation site passes nothing — no change needed there.
- [ ] 3.2 Integration test: `GET /api/doctor` includes a `tunnel` section with four checks; auth gate unchanged (covered by existing doctor-routes test, no new assertion needed).

## 4. Spec updates

- [ ] 4.1 Update `openspec/changes/add-tunnel-diagnostic-checks/specs/doctor-diagnostic/spec.md` with MODIFIED + ADDED requirements per `proposal.md`.

## 5. Verification

- [ ] 5.1 `openspec validate add-tunnel-diagnostic-checks --strict` passes.
- [ ] 5.2 `npm test` green; specifically `doctor-core.test.ts` covers all 12 scenarios (3 outcomes × 4 checks, minus the watchdog-runtime test's 4 branches).
- [ ] 5.3 Manual smoke: stop the dashboard, set `/etc/hosts` `127.0.0.1 api-v1.zrok.io` (simulate DNS fail), restart, open Settings ▸ Diagnostics, confirm `zrok API reachable` row is `warning` with the captured reason. Revert hosts file.
- [ ] 5.4 Confirm Electron Doctor window also shows the new `tunnel` section (auto-flows from shared core).
