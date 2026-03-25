## 1. Config

- [x] 1.1 Add `devBuildOnReload: boolean` to `DashboardConfig` interface in `src/shared/config.ts` with default `false`
- [x] 1.2 Update `loadConfig()` to read `devBuildOnReload` from JSON with fallback to `false`
- [x] 1.3 Update `ensureConfig()` defaults to include `devBuildOnReload: false`
- [x] 1.4 Add/update tests for config loading with `devBuildOnReload`

## 2. Server shutdown endpoint

- [x] 2.1 Add `POST /api/shutdown` route to `src/server/server.ts` that responds `{ ok: true }` then calls `stop()` and `process.exit(0)`
- [x] 2.2 Add test for the shutdown endpoint

## 3. Bridge cleanup hook

- [x] 3.1 Add dev-build-on-reload logic to the cleanup function in `src/extension/bridge.ts`: resolve package root, run `execSync("npm run build")`, send `POST /api/shutdown`, with console.log progress
- [x] 3.2 Add test for the dev-build cleanup behavior

## 4. Documentation

- [x] 4.1 Update AGENTS.md and README.md to document `devBuildOnReload` config option
