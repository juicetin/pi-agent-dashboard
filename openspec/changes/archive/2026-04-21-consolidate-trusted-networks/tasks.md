## 1. Component refactor — `TrustedNetworksSection`

- [x] 1.1 Rename section title from "Trusted Networks" to the agreed final title (default: "Trusted Networks"; deferred decision — confirm in PR)
- [x] 1.2 Add a `source: "trustedNetworks" | "bypassHosts"` prop (or simplify by hard-coding `bypassHosts` since Decision 1 fixes the key) — choose the simpler path and document in the PR
- [x] 1.3 Change `onChange` to write to `config.auth.bypassHosts` instead of `config.trustedNetworks`
- [x] 1.4 Change `networks` prop source to `config.auth?.bypassHosts ?? []`
- [x] 1.5 Add a manual-entry text input below the "+ Add Local Network" button that accepts exact IP / wildcard / CIDR and appends to the list
- [x] 1.6 Render an info hint under the list when `config.trustedNetworks` is non-empty: "N entries from `config.json` → `trustedNetworks` are also active. Edit them directly in that file."

## 2. SettingsPanel wiring

- [x] 2.1 Remove the `<TrustedNetworksSection …/>` invocation from the General tab JSX block
- [x] 2.2 Remove the existing `auth.bypassHosts` textarea block from the Security tab JSX
- [x] 2.3 Add `<TrustedNetworksSection …/>` to the Security tab below "Trusted Hosts textarea" location (now removed), wired to `config.auth?.bypassHosts`
- [x] 2.4 Ensure save diff logic in `SettingsPanel` picks up `auth.bypassHosts` changes (should work already via existing auth diff path — verify)
- [x] 2.5 Verify the General tab still compiles and renders without the removed section

## 3. Tests

- [x] 3.1 Update `SettingsPanel` unit/integration tests that asserted Trusted Networks on General; update them to assert it on Security
- [x] 3.2 Add a test: clicking "+ Add Local Network" → selecting a CIDR → Save writes into `auth.bypassHosts`, NOT `trustedNetworks`
- [x] 3.3 Add a test: manual-entry accepts `10.0.0.*` and `192.168.1.50` (wildcard + exact) and saves them to `auth.bypassHosts`
- [x] 3.4 Add a test: when loaded config has `trustedNetworks: ["192.168.1.0/24"]` and empty `auth.bypassHosts`, the info hint is visible
- [x] 3.5 Add a test: removing an entry from the UI removes only from `auth.bypassHosts` and leaves top-level `trustedNetworks` untouched
- [x] 3.6 Add a test: General tab renders without any element matching "Trusted Networks" / "+ Add Local Network"
- [x] 3.7 Verify existing trusted-networks server tests (`resolvedTrustedNetworks` merge) still pass untouched

## 4. Docs

- [x] 4.1 Update `docs/architecture.md` if it documents `trustedNetworks` vs. `auth.bypassHosts` as user-facing fields — add a note that `auth.bypassHosts` is the UI write target and `trustedNetworks` is legacy-compatible
- [x] 4.2 Update `README.md` configuration-reference section if it mentions either field (no mention found — no-op)
- [x] 4.3 Update `AGENTS.md` key-files table if the `SettingsPanel.tsx` entry's description mentions Trusted Networks on General (description is tab-layout-agnostic — no-op)

## 5. Verification

- [x] 5.1 `openspec validate consolidate-trusted-networks --strict` passes
- [x] 5.2 `npm test` passes (client tests updated, server tests unchanged) — 248 files, 2625 tests green
- [x] 5.3 `npm run build` produces a working client bundle
- [x] 5.4 Manual: with a fresh config, add an entry via UI → inspect `~/.pi/dashboard/config.json` → confirm entry is under `auth.bypassHosts` only — covered by unit test `wire-up → adding a CIDR writes to auth.bypassHosts, not top-level trustedNetworks`
- [x] 5.5 Manual: with a config that has `trustedNetworks: ["192.168.1.0/24"]` pre-existing, open Settings → Security → confirm info hint is visible and entry is not editable from UI but still honored at runtime — covered by `shouldShowLegacyHint` tests + `resolvedTrustedNetworks` merge (existing server tests pass)
- [x] 5.6 Manual: confirm General tab no longer shows Trusted Networks section — covered by source-layout test asserting exactly one `<TrustedNetworksSection` invocation and zero inside the General tab block
