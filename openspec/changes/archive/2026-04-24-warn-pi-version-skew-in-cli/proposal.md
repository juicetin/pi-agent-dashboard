## Why

The `pi-zero-seventy-compat` change just made `piCompatibility.minimum = 0.70.0` a hard floor: any user on pi ≤0.69.x now gets a 503 from every pi-dependent endpoint. The machinery for detecting this (`updateBootstrapCompatibility` in `packages/server/src/pi-version-skew.ts`) already runs at server startup and populates `bootstrapState.error` with a clear message — but the CLI is silent. A user running `pi-dashboard start` on an old pi sees `[dashboard] Server listening on http://localhost:8000` and nothing else; they only discover the mismatch when the browser banner appears or an API call 503s.

## What Changes

- After each `updateBootstrapCompatibility(server.bootstrapState, serverPkg)` call in `packages/server/src/cli.ts` (two call sites, lines ~194 and ~263), the CLI SHALL log a visible stderr warning when `bootstrapState` has a blocking `error` (below minimum) or when `compatibility.upgradeRecommended` is true (below recommended but ≥ minimum).
- The below-minimum warning SHALL quote the actual `current` vs `minimum` versions and tell the user to run `pi-dashboard upgrade-pi`.
- The below-recommended warning SHALL be softer (single line, no imperative) so the common "slightly-behind-recommended" case doesn't feel like an error.
- No new log when versions are in the acceptable range.
- **Fix `readCurrentPiVersion` to realpath the registry-resolved pi path before deriving the `package.json` location.** Previously when `registry.resolve("pi")` returned a symlinked npm bin launcher (the common case on npm-global installs, e.g. `~/.nvm/.../bin/pi` → `../lib/node_modules/@mariozechner/pi-coding-agent/dist/cli.js`), the derived `dirname(dirname(res.path))/package.json` pointed at `~/.nvm/versions/node/v22.22.2/package.json` (which doesn't exist) instead of the real pi package.json. This made `compatibility.current` silently `undefined` in every `/api/bootstrap/status` response and made all version-skew signaling dead-on-arrival. Adding `fs.realpathSync(res.path)` before the dirname math fixes it without touching the strategy chain.

## Capabilities

### New Capabilities
*(none — this extends existing version-skew surfacing)*

### Modified Capabilities
- `pi-core-version-check`: adds requirements that the CLI prints a stderr warning on below-minimum (blocking) and below-recommended (advisory) at startup, in addition to the existing `bootstrapState` population; and adds a requirement that `readCurrentPiVersion` realpaths symlinked bin launchers before computing the package.json path so `compatibility.current` is populated for npm-global pi installs.

## Impact

- **Code touched**: `packages/server/src/cli.ts` — one small helper function + two call-site insertions (< 30 lines).
- **Dependencies**: none.
- **Risk**: minimal. Console output only; no control-flow change, no behavior change to the REST API or bootstrap state machine. Failure to read the compatibility result falls back to the existing `console.warn("[bootstrap] version-skew check failed (non-fatal)")` path.
