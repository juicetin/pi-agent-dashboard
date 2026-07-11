# Tasks

## 1. Reproduce (systematic-debugging)
- [ ] 1.1 Reducer/handler test: deliver `[start(40), (end withheld), assistant_turn(42),
  assistant_turn(43)]` with the reconcile route stubbed to 404 → assert the row is
  finalized `complete` + `healedBy:"superseded"` only after a later turn is applied.
- [ ] 1.2 Reducer test: same start, later `tool_start` sibling in the SAME turn, NO later
  assistant turn → assert the row stays `running` (parallel-tool false-positive guard).

## 2. Supersede eligibility (client) — ADD
- [ ] 2.1 Locate the tool call's turn index in `SessionState`; expose a pure selector
  `hasLaterAssistantTurn(state, toolCallId)` (strictly-later turn, not sibling tool_start).
- [ ] 2.2 Track per-row reconcile 404 count (reuse the base change's `lastAttemptRef`
  bookkeeping); expose `SUPERSEDE_MIN_404` (default 2).
- [ ] 2.3 Pure selector `selectSupersededHealTargets(sessionStates, min404, hasLaterTurn)`
  → rows eligible for the fallback (running, ≥`SUPERSEDE_MIN_404` 404s, later turn exists).

## 3. Superseded terminal heal (client) — ADD
- [ ] 3.1 `synthesizeSupersededEnd(toolCallId, now)` → `tool_execution_end` with
  `isError:false`, sentinel body, `details.healedBy:"superseded"`, through the existing
  `toolCallId`-keyed reducer path.
- [ ] 3.2 Wire into the existing session-scoped reconcile tick (NOT a per-row effect) so a
  virtualized/off-screen stuck card still heals.
- [ ] 3.3 Reducer D4 carve-out: allow a real `tool_execution_end` to overwrite a
  `healedBy:"superseded"` row; superseded never clobbers real or another superseded.
- [ ] 3.4 Render: `complete` glyph + muted "result not captured (recovered)" note;
  supersede badge (mirror `RetriedErrorBadge`).

## 4. Observability (observability-instrumentation) — ADD
- [ ] 4.1 Client `supersedeHealCount` incremented on each synthesized heal.
- [ ] 4.2 Surface the count where the base change's dropped-frame counters are exposed.

## 5. Doubt-driven review (before it stands)
- [ ] 5.1 Stress-test the supersede condition against: parallel tools in the active turn;
  a genuinely slow tool whose turn is still newest; a real result racing the placeholder.
  Confirm no false-positive completion in any case; record findings.

## 6. Validate
- [ ] 6.1 `npm test` green (new reducer/selector suites + existing base-change suites).
- [ ] 6.2 `openspec validate fix-stuck-tool-card-superseded-heal --strict`.
- [ ] 6.3 `npm run quality:changed` clean (tsc --noEmit; full suite green; zero new Biome
  warnings on changed lines).

## 7. E2E scenario (tests/e2e/, deferred if harness-gated)
- [ ] 7.1 Force a store-eviction / 404 reconcile, drive a later turn, assert the stuck
  card flips to `complete` + recovered badge without a manual refresh.
