## 1. Shared config

- [x] 1.1 Add `KeeperLogConfig { capturePiOutput: boolean }` type and `DEFAULT_KEEPER_LOG = { capturePiOutput: false }` to `packages/shared/src/config.ts`; add `keeperLog: KeeperLogConfig` to the config type.
- [x] 1.2 In `loadConfig`, parse `keeperLog` with default fallback: absent ⇒ default, non-object ⇒ default, non-boolean `capturePiOutput` ⇒ `false`. Do not emit `keeperLog` from `ensureConfig` defaults.
- [x] 1.3 Write config tests (parse default, explicit true, non-boolean fallback) mirroring the `openspec.enabled` tests in `config-openspec.test.ts`.

## 2. Server keeper plumbing

- [x] 2.1 In `packages/server/src/rpc-keeper/keeper-manager.ts`, set `PI_KEEPER_CAPTURE_PI_OUTPUT = "1"` in `keeperEnv` when `config.keeperLog.capturePiOutput === true`; omit otherwise.
- [x] 2.2 In `packages/server/src/rpc-keeper/keeper.cjs` `spawnPi()`, read `process.env.PI_KEEPER_CAPTURE_PI_OUTPUT`; choose `stdio: ["pipe", logFd, logFd]` when it equals `"1"`, else `["pipe", "ignore", "ignore"]`. Keep the keeper's own `log()` lifecycle writes unchanged.
- [x] 2.3 Write keeper test asserting the stdio branch: capture off ⇒ `["pipe","ignore","ignore"]`, capture on ⇒ `["pipe", logFd, logFd]`; lifecycle log line present in both.

## 3. Client settings UI

- [x] 3.1 Add a `keeperLog?: { capturePiOutput?: boolean }` field to the client config type/`DEFAULT_*_UI` in `SettingsPanel.tsx` and include it in the `handleSave` diff when changed.
- [x] 3.2 Render a `ToggleField` "Capture pi session output (debug)" in the General tab next to `DiagnosticsSection` (~line 626), bound to `config.keeperLog.capturePiOutput` with debug/disk help text.

## 4. Verify

- [x] 4.1 `npm test` green — new config (8) + keeper (2) tests pass; typecheck (`npm run lint`) clean. The only 2 suite failures (image-fit JPEG, chat-input image paste) are pre-existing parallelism flakes that pass in isolation; unrelated to changed files.
- [x] 4.2 `npm run build` + `/api/restart`; confirmed `/api/config` round-trips `keeperLog.capturePiOutput` (PUT true → persisted to disk → GET true → restored false).
- [x] 4.3 Verified by keeper integration tests: real keeper + mock-pi, capture OFF discards pi stdout (marker absent) + keeps lifecycle lines; capture ON archives pi stdout (marker present) — exact `stdio` branch exercised.
- [x] 4.4 Reload not required: no bridge code changed; `keeper.cjs` is read fresh from disk per spawn, so new behavior applies to the next spawned session automatically.
