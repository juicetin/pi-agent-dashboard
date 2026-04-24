## 1. Fix readCurrentPiVersion realpath

- [x] 1.1 In `packages/server/src/pi-version-skew.ts::readCurrentPiVersion`, wrap the `res.path` in a `fs.realpathSync(res.path)` call (with a try/catch falling through to `undefined`) before `path.dirname(path.dirname(...))` so symlinked bin launchers resolve to the real module location
- [x] 1.2 Add a unit test under `packages/server/src/__tests__/pi-version-skew.test.ts` using a symlink fixture in a temp dir: symlink `bin/pi` → `../lib/node_modules/@mariozechner/pi-coding-agent/dist/cli.js`, stub registry to return the symlink path, assert `readCurrentPiVersion` returns the expected version
- [x] 1.3 Run `npm test -- pi-version-skew` and confirm all scenarios (including the new symlink test) pass

## 2. Implement CLI warning

- [x] 2.1 In `packages/server/src/cli.ts`, add a `logCompatibilityWarning(state: BootstrapStateStore)` helper near the `updateBootstrapCompatibility` import; helper reads `state.get()` and emits zero or one warning per the severity rules in `specs/pi-core-version-check/spec.md`
- [x] 2.2 Call `logCompatibilityWarning(server.bootstrapState)` immediately after the existing `updateBootstrapCompatibility(...)` at the "pi already resolved" site (~line 194)
- [x] 2.3 Call `logCompatibilityWarning(server.bootstrapState)` immediately after the existing `updateBootstrapCompatibility(...)` at the "post-bootstrapInstall" site (~line 263)

## 3. Verify

- [x] 3.1 Run `npm test` — full suite must still pass
- [x] 3.2 Run `npm run build` — must succeed
- [x] 3.3 Restart server via `curl -X POST http://localhost:8000/api/restart`; confirm `/api/bootstrap/status` now includes `compatibility.current` with a real version string (was previously `undefined`)
- [x] 3.4 If current pi ≥ 0.70.0, confirm NO compatibility warning appears in `~/.pi/dashboard/server.log`
- [x] 3.5 Temporarily edit `packages/server/package.json` `piCompatibility.minimum` to `"99.0.0"`; restart; confirm the red below-minimum warning appears in the log; revert the package.json edit
- [x] 3.6 Temporarily edit `piCompatibility.recommended` to above-installed with `minimum` below-installed; restart; confirm the softer below-recommended single-line warning appears; revert
- [x] 3.7 Run `openspec validate warn-pi-version-skew-in-cli --strict`

## 4. Documentation

- [x] 4.1 Update `AGENTS.md` `packages/server/src/pi-version-skew.ts` row to note (a) the CLI now surfaces the skew via stderr, and (b) `readCurrentPiVersion` realpaths symlinked bin launchers. Cross-reference change `warn-pi-version-skew-in-cli`
- [x] 4.2 Add a short note to the `docs/architecture.md` version-skew section ("CLI also logs a stderr warning on below-minimum/below-recommended …")
