## 1. Server: non-blocking config read

- [x] 1.1 Add an async `configList` variant in `packages/shared/src/platform/openspec.ts` using the existing `runAsync` path in `runner.ts` (preserve the 10s timeout and parse-or-null behavior).
- [x] 1.2 Update `GET /api/openspec/config` in `packages/server/src/routes/openspec-routes.ts` to `await` the async read; keep the 30s `configCache` hit fast-path and the defensive `OpenSpecConfig` normalization unchanged.
- [x] 1.3 Add/extend a server test: cold read returns the correct profile/workflows; a warm read serves from cache without spawning; a failed/malformed CLI still yields safe defaults (no event-loop block assertion needed beyond async-path usage).
- [x] 1.4 (discovered during verification) Make `GET /api/openspec/update-status` + the `update` signature-record path non-blocking too: `currentGlobalSignature` now uses the async read and is computed ONCE per request (profile is global — identical for every cwd), replacing N× blocking `spawnSync` that took ~11s for 11 projects and starved the concurrent config GET. Test asserts a single async read regardless of cwd count.

## 2. Service worker: pass /api/* through

- [x] 2.1 Locate the source of `sw.js` (confirm whether `packages/client/dist/sw.js` is authored directly or emitted by the build) and document it in the change.
- [x] 2.2 Scope the `catch(() => new Response("Offline", { status: 503 }))` fallback to non-`/api/` requests only; `/api/*` requests pass through and propagate rejection.
- [x] 2.3 Verify a rebuild (`npm run build`) emits the updated `sw.js` so the fix is not regenerated away.

## 3. Client: resilient profile load

- [x] 3.1 In `OpenSpecProfileSection.tsx`, replace the hardcoded `useState("core")` / `CORE_WORKFLOWS` initial selection with a `loading` status (no radio pre-selected as authoritative until config resolves).
- [x] 3.2 Add retry on transient failure (cap 1–2 attempts, short backoff) in the mount load effect; stop swallowing the error silently.
- [x] 3.3 Render a visible error state with a manual "Retry" affordance when retries are exhausted; once resolved, ensure radio + chips match `GET /api/openspec/config`.
- [x] 3.4 Add/extend client tests: section reflects saved `expanded` after load; transient failure retried then succeeds; persistent failure shows error (no hardcoded `core` shown as saved).

## 4. Verify end-to-end

- [x] 4.1 `npm test` green for server + client suites. (708 files, 7476 tests passed.)
- [x] 4.2 `npm run build` + restart; browser Settings → Advanced shows saved profile (`expanded`) consistently — verified live: loads to expanded, survives 5 rapid remounts, no stuck-loading. Confirmed update-status no longer starves the config GET (0.8s concurrent vs prior 15s).
- [x] 4.3 Update `docs/file-index-*.md` rows for any changed files per the Documentation Update Protocol (delegate doc writes to a subagent, caveman style).
