## 1. Skill package scaffolding

- [x] 1.1 Create `packages/dashboard-plugin-skill/package.json` with `name: @blackbelt-technology/pi-dashboard-plugin-skill`, `private: false`, and a `pi.skills` declaration pointing at `skills/dashboard-plugin-scaffold/SKILL.md`.
- [x] 1.2 Add the package to the workspace root `package.json` `workspaces` array. (covered by existing `packages/*` glob)
- [x] 1.3 Add a stub `vitest.config.ts` and `tsconfig.json` that mirror `packages/dashboard-plugin-runtime/`.
- [x] 1.4 Add `packages/dashboard-plugin-skill/README.md` describing how to install (`npm i -g @blackbelt-technology/pi-dashboard-plugin-skill`) and how to invoke from a pi session.

## 2. Skill markdown

- [x] 2.1 Author `skills/dashboard-plugin-scaffold/SKILL.md` with the hybrid contract: the up-front `ask_user` batch, the mode branch, and the prescriptive steps for each mode.
- [x] 2.2 Author `references/slot-taxonomy.md` covering all 10 React slot ids: when to use, prop contract, multiplicity, ordering rules, example snippet.
- [x] 2.3 Author `references/manifest-schema.md` mirroring `dashboard-plugin-loader/spec.md` Requirement 1 (the canonical schema).
- [x] 2.4 Author `references/plugin-context-api.md` documenting the public exports of `@blackbelt-technology/dashboard-plugin-runtime/context` (the de-facto client SDK).
- [x] 2.5 Author `references/server-context-api.md` documenting the `ServerPluginContext` from `dashboard-plugin-loader/spec.md` Requirement 3.
- [x] 2.6 Author `references/tui-to-dashboard-mapping.md` with the canonical mapping table (from this proposal's design.md §"TUI → dashboard mapping").
- [x] 2.7 Author `references/build-integration.md` summarising the Vite plugin behavior, dev vs prod fixture filtering, and tree-shaking.

## 3. Templates (mode `new`)

- [x] 3.1 `templates/plugin-package.json.tmpl` with a `pi-dashboard-plugin` manifest, `requiredApi: "^0.x"`, and placeholder `{{ id }}` / `{{ displayName }}` / `{{ priority }}` / `{{ claims }}`.
- [x] 3.2 `templates/client.tsx.tmpl` + `templates/slot-sections.ts` with one section per slot id, each commented with the prop contract and a TODO marker. The renderer keeps only sections matching the user's `multiselect`.
- [x] 3.3 `templates/server-index.ts.tmpl` exporting a default `registerPlugin(ctx)` with example REST route + WS handler scaffolds.
- [x] 3.4 `templates/bridge-index.ts.tmpl` exporting a stub pi-extension entry. (Only emitted when the user opts in.)
- [x] 3.5 `templates/configSchema.json.tmpl` — empty JSON Schema 7 object with a `$schema` header.
- [x] 3.6 `templates/tsconfig.json.tmpl` matching the conventions in `packages/dashboard-plugin-runtime/tsconfig.json`.
- [x] 3.7 `templates/vitest.config.ts.tmpl` matching the conventions in `packages/dashboard-plugin-runtime/vitest.config.ts`.
- [x] 3.8 `templates/README.md.tmpl` summarising the plugin's claims and how to develop it.
- [x] 3.9 `templates/test-index.test.ts.tmpl` with one assertion per claim type, using vitest.

## 4. Scripts

- [x] 4.1 `scripts/grep-tui-surface.sh` — runs the grep prelude (`ctx.ui.*`, `pi.registerTool`, `registerExtensionUI`, session-replacement bans) and emits a JSON callsite list.
- [x] 4.2 `scripts/register-workspace.sh` — idempotently adds `packages/<id>-plugin` to the root `package.json#workspaces` array, atomic write via tmp+rename.

## 5. Mode `new` flow tests

- [x] 5.1 Vitest test that drives the templates with a synthetic answer set (id: `acme`, slots: `["settings-section","tool-renderer"]`, server: true, bridge: false) and asserts the resulting in-memory tree (file set + manifest contents). (See `src/__tests__/render-new.test.ts`.)
- [x] 5.2 Vitest test that drives the templates with **all 10 slots** selected and asserts every slot stub is present in `client.tsx` and a claim per slot is in the manifest.
- [x] 5.3 Vitest test asserting the generated `package.json#pi-dashboard-plugin` satisfies the forward-compat contract (top-level field, package-relative paths, no workspace:* deps, exports subpaths match, requiredApi present). Per the design's resolved decision, this is the canonical contract test — the manifest-validator hookup remains a future-work option.

## 6. Mode `augment` flow tests

- [x] 6.1 Vitest test that runs `grep-tui-surface.sh` against a tmp-dir fixture pi-extension containing `ctx.ui.select`, `ctx.ui.custom`, `pi.registerTool`, and `ctx.fork` callsites. Asserts the JSON output names all four with correct categories and is deterministic across re-runs. (See `src/__tests__/grep-prelude.test.ts`.)
- [x] 6.2 Vitest test that takes a synthetic per-callsite confirmation set, runs the augment-mode renderer, and asserts the resulting `package.json#pi-dashboard-plugin`, dependencies, and exports match expectations. Also asserts only `package.json` + `src/dashboard/*` are written (additive contract).
- [x] 6.3 Vitest test asserting the augmented manifest satisfies the forward-compat contract (items 1-5 in design.md §"Forward-compat contract"). Same suite covers mode `new` output.

## 7. Documentation updates

- [x] 7.1 Add the new package to `AGENTS.md` Key Files table.
- [x] 7.2 Add an "Authoring a dashboard plugin" section to `README.md` pointing at the skill.
- [x] 7.3 Add a paragraph to `docs/architecture.md`'s plugin-architecture section noting the skill is the canonical on-ramp. (delegated to general-purpose subagent per docs/ rule)
- [x] 7.4 Cross-link from `packages/demo-plugin/README.md` to the skill (the demo is what the skill produces).

## 8. Publishing

- [x] 8.1 Confirm `packages/dashboard-plugin-skill/package.json` declares `repository`, `license`, and a populated `files` array. Files include `src/` (templates + render + scripts + bin) and `.pi/skills/` (SKILL.md + references). Test fixtures live under `src/__tests__/` which the publish step excludes via `.npmignore` if needed (npm respects `files` allowlist; only listed paths ship).
- [x] 8.2 Add the package to the publish workflow's per-package list in `.github/workflows/publish.yml` (inserted between `pi-dashboard-jj-plugin` and `pi-agent-dashboard` — sub-packages first, root metapackage last).
- [x] 8.3 First-publish gating policy: Mode `new` and `augment` flow tests (5.1-5.3, 6.1-6.3) MUST pass in CI before the package is included in a release. Manual end-to-end validation (scaffold `packages/test-<id>-plugin/`, restart, see slot render in dashboard) is the recommended pre-merge check for the first release that includes the skill. This task records the policy; the actual first publish happens via `release-cut`.
