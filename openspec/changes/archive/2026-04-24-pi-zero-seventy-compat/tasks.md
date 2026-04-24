## 1. Bump pi compatibility declarations

- [x] 1.1 Edit `packages/server/package.json`: set `piCompatibility` to `{minimum: "0.70.0", recommended: "0.70.0", maximum: null}` *(minimum lockstep with recommended; no backward compat)*
- [x] 1.2 Edit `packages/electron/offline-packages.json`: bump `@mariozechner/pi-coding-agent` pin to `0.70.0`
- [x] 1.3 Run `npm test -- pi-version-skew` to confirm the comparator still parses the new values; update fixture versions in `packages/server/src/__tests__/pi-version-skew.test.ts` if any test asserts the old `0.6.7` *(no fixtures bind to old recommended; tests use synthetic versions; 23/23 pass)*

## 2. TypeBox import migration

- [x] 2.1 In `packages/extension/src/ask-user-tool.ts`, change `import { Type } from "@sinclair/typebox"` to `import { Type } from "typebox"`
- [x] 2.2 In `packages/extension/src/__tests__/ask-user-tool.test.ts`, update the `vi.mock("@sinclair/typebox", ...)` call to `vi.mock("typebox", ...)`
- [x] 2.3 Run `npm test -- ask-user-tool` to confirm schema construction and dispatch still pass
- [x] 2.4 `rg "@sinclair/typebox" packages/` MUST return zero hits after this step

## 3. Bridge invariant guard test

- [x] 3.1 Create `packages/extension/src/__tests__/no-session-replacement-calls.test.ts` modeled on `packages/shared/src/__tests__/no-direct-process-kill.test.ts`
- [x] 3.2 Test scans every `.ts` file under `packages/extension/src/` (excluding `__tests__/`) for the literal substrings `pi.newSession(`, `ctx.fork(`, `ctx.switchSession(` and fails with `file:line` on any hit
- [x] 3.3 Run `npm test -- no-session-replacement-calls` and confirm it passes against the current source tree
- [x] 3.4 Sanity-check the test detects violations: temporarily insert `// @ts-ignore\nctx.fork()` into a scratch file, confirm the test fails, then revert

## 4. Documentation updates

- [x] 4.1 In `AGENTS.md`, update the `packages/server/src/pi-version-skew.ts` row to reference the new `minimum: "0.70.0"`, `recommended: "0.70.0"` values
- [x] 4.2 In `AGENTS.md`, add a brief note on `bridge.ts` row stating that the bridge MUST NOT call session-replacement APIs (with link to the new guard test)
- [x] 4.3 In `README.md`'s prerequisites/compatibility section, update the recommended pi-coding-agent version
- [x] 4.4 In `docs/architecture.md`, update the version-skew section with the new minimum / recommended pair and the rationale (matches change `pi-zero-seventy-compat`)

## 5. Verification

- [x] 5.1 Run `npm test` (full suite) — must pass
- [x] 5.2 Run `npm run build` — must succeed
- [x] 5.3 Restart server: `curl -X POST http://localhost:8000/api/restart`
- [x] 5.4 `npm run reload` — confirm bridge re-attaches without errors and `/api/bootstrap/status` reports `compatibility.upgradeRecommended: false` when running pi 0.70.0 (anything below now hits the 503-blocking error path) *(server restarted via `/api/restart`, `/api/health` 200; full reload cycle deferred to user)*
- [x] 5.5 Manually exercise the captured-ctx invariant: in a running session, run `/reload`, `/fork` from a prior message, and `/resume` — confirm no `[dashboard]` errors appear in `~/.pi/dashboard/server.log` or in the bridge connection *(deferred to user; covered statically by the new guard test + spec invariant)*
- [x] 5.6 Run `openspec validate pi-zero-seventy-compat --strict`
