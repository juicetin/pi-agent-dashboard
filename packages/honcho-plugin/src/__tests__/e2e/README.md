# Honcho plugin E2E tests

Tier 3 integration tests for the honcho dashboard plugin: real React tree
in jsdom, real Fastify routes, real config-store, mocked nothing.

## Approach

In-process Fastify (`fastify.inject`) wired to a `globalThis.fetch` shim
so the React component code calls `fetch("/api/...")` exactly as it does
in production, but each call resolves through the in-process router with
no network, no port, no subprocess.

See `openspec/changes/honcho-dashboard-plugin/design.md`
"E2E Test Fixture Approach" for the full rationale.

## Layout

```
fixtures/
  server-fixture.ts   in-process Fastify + honcho routes + /api/packages stub
  client-mount.tsx    PluginContextProvider + fetch shim wired to fastify.inject
*.e2e.test.tsx        per-task tests
```

## Running

```bash
HOME=$(mktemp -d) npx vitest run packages/honcho-plugin/src/__tests__/e2e
```

Or via the root harness: `npm test`.

## Tasks covered

| Task  | Test file                       | Asserts                                           |
| ----- | ------------------------------- | ------------------------------------------------- |
| 6.8f  | model-picker.e2e.test.tsx       | model dropdown click → config.json source/model   |
| 6.8g  | route-override.e2e.test.tsx     | route dropdown gating + source switch on disk     |
| 9.8   | install-gate.e2e.test.tsx       | install gate vs full panel; install POST body     |
| 9.9   | card-actions-gate.e2e.test.tsx  | badge + action bar gated on extension install     |
| 9.10  | map-popover.e2e.test.tsx        | popover round-trip: edit → save → re-open        |

## Adding a new e2e test

1. `import { createE2eServerFixture } from "./fixtures/server-fixture.js"`.
2. `import { mountHonchoComponent } from "./fixtures/client-mount.js"`.
3. Render a single component — direct prop wiring is fine
   (`<LlmSection config={...} onSave={...} saving={false} />`) for tests
   that target one panel; mount `<HonchoSettings />` only when the test
   exercises the install-gate branch.
4. `await server.close()` in `afterEach` plus `cleanup()` from
   `@testing-library/react` (auto-cleanup is gated on vitest globals,
   which this project does not enable).

## Out of scope

- **Genuine browser fidelity** (CSS layout, focus, hover). Use Playwright
  if a future task requires this. Current asserts are DOM-presence + on-disk
  state only.
- **Subprocess starter coverage**. The `qa/smoke/server-launch/` suite
  proves `pi-dashboard start` reaches health; the e2e tier does not
  duplicate that surface.
- **Auth flow**. The fixture skips `auth-plugin` registration; provider
  auth is exercised by `packages/server/src/__tests__/auth-plugin.test.ts`.
