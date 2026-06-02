# Tasks

## 1. Align header derivation with the card

- [x] 1.1 In `App.tsx`, compute the selected session's context usage from the shared map: `const selectedContextUsage = (selectedId ? contextUsageMap.get(selectedId) : undefined) ?? selectedState.contextUsage;`
- [x] 1.2 Pass `selectedContextUsage` to the desktop `<TokenStatsBar contextUsage={...} />` (replaces `selectedState.contextUsage`).
- [x] 1.3 Pass `selectedContextUsage` to the mobile info-strip inline context bar (replaces `selectedState.contextUsage`).

## 2. Tests

- [x] 2.1 Write a failing test: session has no live `state.contextUsage` but carries persisted `contextTokens` + `contextWindow`; assert the header context bar renders filled (matches the card), not empty. (Extracted shared `buildContextUsageMap` helper → `packages/client/src/lib/context-usage.ts`; test `lib/__tests__/context-usage.test.ts` covers persisted-fallback, live-wins, omit-when-empty, tokens=0.)
- [x] 2.2 Verify existing `TokenStatsBar` segmented-bar tests still pass (live path with `turnStats` unchanged). (14/14 pass.)
- [x] 2.3 Run `npm test 2>&1 | tee /tmp/pi-test.log` and grep for failures. (7092 passed; sole failure `run-bootstrap.test.ts` flood-throttle is an unrelated timing flake — passes in isolation.)

## 3. Rebuild + verify

- [x] 3.1 `npm run build` then `curl -X POST http://localhost:8000/api/restart`. (Build clean, type-check passed; server restarted, health ok, production mode.)
- [x] 3.2 Manual check: open a freshly-loaded session that has prior persisted usage; confirm card bar and header bar agree before any new turn runs. (Browser spot-check: list cards show green context bars; content header shows `121k / 1000k` blue fill from shared `selectedContextUsage`. No regression on either surface. Persisted-fallback case locked by `context-usage.test.ts`.)
