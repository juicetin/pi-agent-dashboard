# Tasks — surface-model-introspection-to-agents

## 1. Server: ungated `GET /api/models`

- [ ] 1.1 Add `registerModelsIntrospectionRoute` (or extend an existing session/provider route module) wiring `GET /api/models` to the shared `getRegistry()` dependency → verify: route returns `200` with a non-empty `data`/rows array against the running dashboard.
- [ ] 1.2 Default response = reachability-filtered (`getAvailable()`); `?annotated=1` = `getAllAnnotated()` including `excludedReason` → verify: annotated response contains at least one row with `excludedReason` in {`no-credential`,`oauth-incompatible`} when an unauthed provider exists.
- [ ] 1.3 Confirm no credential material in the payload (only id/provider/capability/cost) → verify: response body grepped for key/token/secret fields is empty. (`security-hardening` checkpoint.)
- [ ] 1.4 Auth-gate posture matches decision in design.md Q1 → verify: behavior identical to `GET /api/provider-auth/status` for the gated/ungated case.

## 2. Skill: `dashboard-list-models` command

- [ ] 2.1 Add `packages/extension/.pi/skills/pi-dashboard/commands/dashboard-list-models.md` (LIST counterpart to `dashboard-session-model`): resolve base URL/port the same way, call `GET /api/models[?annotated=1]`, report rows → verify: `/dashboard:list-models` returns the catalogue.
- [ ] 2.2 Command text explicitly instructs: never parse `providers.json`/`models.json`; use this endpoint → verify: rule present in the command markdown.

## 3. Docs pointer

- [ ] 3.1 Add a one-line entry to `packages/extension/.pi/skills/pi-dashboard/references/api-reference.md` documenting `GET /api/models` (+ `annotated`) as the model-introspection surface → verify: entry present and matches route shape.
- [ ] 3.2 Add the new command + reference rows to the nearest directory `AGENTS.md` per the Documentation Update Protocol → verify: rows present, path-alphabetical.

## 4. Tests

- [ ] 4.1 Unit test for `GET /api/models`: default filtered vs `?annotated=1` shapes, and no-secret invariant → verify: `npm test` green for the new spec.
- [ ] 4.2 `openspec validate surface-model-introspection-to-agents --strict` passes → verify: exit 0.

## 5. Gates (at completion, before commit)

- [ ] 5.1 `npm run quality:changed` green.
- [ ] 5.2 CodeRabbit advisory review on the diff; fix Critical/Warning.
