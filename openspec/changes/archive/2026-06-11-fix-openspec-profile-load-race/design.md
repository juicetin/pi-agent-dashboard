## Context

The Settings → Advanced "OpenSpec Workflow Profile" section intermittently displays `Core` while the saved global profile is `expanded`/`custom`. The data source is correct: `~/.config/openspec/config.json` holds `expanded`, and `GET /api/openspec/config` returns `expanded` reliably under `curl`. The defect is a validated three-layer race observed live:

1. **Server (blocking read).** `GET /api/openspec/config` resolves a cwd and calls `configListOr` → `configList` → `run()` → `spawnSync` (`packages/shared/src/platform/runner.ts:221`). The `openspec config list` CLI takes ~0.8–1.1s (measured). On a cold 30s-cache miss this blocks the single-threaded Node event loop for ~1s.
2. **Network/SW (masking).** During that block, the browser's reused keep-alive connection can stall and the page `fetch` rejects. The PWA service worker (`packages/client/dist/sw.js`) wraps every request: `fetch(req).catch(() => new Response("Offline", { status: 503 }))`. So the rejection becomes a fabricated `503` that looks like a real server response. (Validated: an aborted page fetch throws `AbortError`; the observed component failure was `status:503, aborted:false` — a genuine network rejection masked by the SW.)
3. **Client (silent strand).** `OpenSpecProfileSection` initializes `useState("core")` + `CORE_WORKFLOWS`, then on mount calls `fetchGlobalOpenSpecConfig()`, which throws on `!res.ok`. The component's `.catch(() => { /* keep defaults */ })` swallows it with no retry and no error UI, leaving the hardcoded `core` selection permanently until a lucky reload.

Constraints: localhost-only endpoints behind the existing network guard; `runner.ts` already exposes an async spawn path (`runAsync`/`spawn`); no protocol or persistence changes wanted; the SW exists only for PWA installability.

## Goals / Non-Goals

**Goals:**
- `GET /api/openspec/config` never blocks the event loop (async CLI spawn), preserving the 30s cache and response shape.
- The settings section reliably shows the saved profile; transient failures retry; persistent failures show a visible error — never a silent hardcoded `core`.
- The service worker stops fabricating `503` for `/api/*`; API failures surface as real fetch rejections.

**Non-Goals:**
- Changing the `delivery` field, the write path (`POST /api/openspec/config`), or `openspec update` behavior.
- Reworking PWA caching strategy beyond scoping the failure fallback away from `/api/*`.
- Changing how session-card buttons consume config (`useOpenSpecConfig` pub/sub is unaffected).

## Decisions

**1. Async config read on the server.** Add an async variant of `configList` (e.g. `configListAsync`) using the existing `runAsync` path in `runner.ts`, and `await` it in the `GET /api/openspec/config` handler. Keep the cache-hit fast path unchanged.
- *Alternative considered:* offload `spawnSync` to a worker thread — heavier, unnecessary since `runAsync` exists.
- *Alternative considered:* cache the global profile in memory and refresh on a timer — larger change, risks staleness vs the CLI source of truth.

**2. Resilient client load with explicit loading/error states.** Replace the hardcoded `core` initial state with a `loading` status. Render the radios only once config resolves; on transient failure retry once (short backoff); on persistent failure show an error with a manual "Retry" affordance. This fixes the user-visible symptom even if layers 1–2 still occasionally hiccup.
- *Alternative considered:* keep the hardcoded default but add retry — still risks briefly showing the wrong profile and re-stranding; rejected.

**3. Service worker path-scoped fallback.** Change `sw.js` so the `catch`-to-`503` fallback applies only to non-`/api/` requests; `/api/*` requests pass through and propagate rejection. Mirror the change in the SW source if one exists (only `dist/sw.js` is present today; confirm during implementation and update the source-of-truth file so a rebuild does not regress it).
- *Alternative considered:* unregister the SW entirely — loses PWA installability; rejected.

## Risks / Trade-offs

- **Async spawn changes error/timeout semantics vs `spawnSync`.** → Preserve the existing timeout and defensive normalization; cover with a test asserting cold read returns the correct profile and a malformed/failed CLI still yields safe defaults.
- **`dist/sw.js` is a build artifact; editing only `dist` regresses on rebuild.** → Locate/define the SW source and edit there; if no source exists, the build that emits `sw.js` must be updated so the path-scoped logic is the built output.
- **Loading state could flash on fast warm reads.** → Warm reads resolve in ~1ms; render loading only until first resolve, acceptable.
- **Retry could mask a real persistent server error.** → Cap retries (e.g. 1–2) and always surface a visible error state after exhaustion.

## Migration Plan

No data migration. Deploy = rebuild client (new `sw.js` + component) and restart server (async route). Rollback = revert the change; behavior returns to the prior intermittent state. Existing installed PWAs pick up the new `sw.js` on next update.

## Open Questions

- Is there a service-worker **source** file, or is `dist/sw.js` authored directly / emitted by the build? Implementation must confirm and edit the real source so the fix survives `npm run build`.
