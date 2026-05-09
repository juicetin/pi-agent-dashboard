## Why

Spawning a new session in the Electron app blanks the entire window (incl. titlebar area, app feels frozen) until the user reloads. DevTools console shows:

```
Uncaught ReferenceError: mdiConsoleLine is not defined
    at KP2 (SessionCard render)
    at react-vendor … commitRoot
```

Root cause is a regression from commit `26cc9ee7` ("feat(folder-openspec): show session status + selection on linked-session pills"). That commit lifted the `sourceIcons` map into `packages/client/src/lib/session-status-visuals.ts` and removed `mdiConsoleLine` from the `@mdi/js` import list in `packages/client/src/components/SessionCard.tsx` — but **left two `?? mdiConsoleLine` fallback references at lines 363 and 462**:

```tsx
<Icon path={sourceIcons[session.source] ?? mdiConsoleLine} size={0.5} />
```

`mdiConsoleLine` is only evaluated when `sourceIcons[session.source]` is nullish. Existing sessions all carry known sources (`tui`, `zed`, `terminal`, …), so the dangling reference stays cold during normal rendering. A freshly-spawned session can briefly arrive with a `source` value not yet in the map → fallback evaluates → `ReferenceError` thrown during render.

The throw bubbles past `ContentHeaderStickySlot`, the layout chrome, and the sidebar — none of which sit inside an `ErrorBoundary` — and unmounts the entire React tree. The Electron renderer is still alive but rendering nothing, hence the "black window + frozen" symptom. A reload re-runs the bundle and usually skips the nullish branch on subsequent spawns.

This is two faults in one:

1. **Trivial bug**: a refactor removed an import without removing its last two referents. One-line fix.
2. **Latent class of bug**: any first-party React component rendered above the inner `ErrorBoundary` at `App.tsx:1117` (which only wraps `ChatView`) can blank the entire window if it throws. The plugin-slot system already isolates per-claim failures via `SlotErrorBoundary`; the gap is the first-party layout chrome itself (sidebar, session cards, content header). A second user-visible blank-window incident from any future symbol typo, optional-chaining miss, or undefined map lookup is one render away.

## What Changes

### 1. Restore the missing import (`packages/client/src/components/SessionCard.tsx`)

Re-add `mdiConsoleLine` to the existing `@mdi/js` import:

```diff
-import { mdiFlash, …, mdiPaperclip } from "@mdi/js";
+import { mdiFlash, …, mdiPaperclip, mdiConsoleLine } from "@mdi/js";
```

No other code change required. The two `?? mdiConsoleLine` fallbacks become live again.

### 2. Wrap layout chrome in an `ErrorBoundary`

Add a top-level `<ErrorBoundary>` in `App.tsx` around the **layout chrome region** (sidebar + session list + content area frame), reusing the existing `packages/client/src/components/ErrorBoundary.tsx`. Fallback UI mirrors the existing inner boundary (small message + "Reload page" link). The inner boundary around `ChatView` stays — it provides finer-grained recovery for chat-only crashes.

This is **defense-in-depth**, not a rewrite: a single boundary placement so that a render-time `ReferenceError` / `TypeError` in any first-party shell component degrades to a recoverable in-window message instead of a blank Electron window.

### 3. Repo-lint: catch dangling icon imports

Add `packages/client/src/__tests__/no-undeclared-mdi-fallback.test.ts` — a static text scan that, for every `?? mdi[A-Z][a-zA-Z]+` fallback in `.tsx` files under `packages/client/src/components/`, verifies the same identifier appears in an `import … from "@mdi/js"` line in the same file. Mirrors the style of existing repo-lints (`no-bare-external-anchor.test.ts`, `no-jsx-slot-nullish-fallback.test.ts`).

## Impact

- **Affected specs**: new `client-shell-error-isolation` capability — `ADDED Requirements` for shell-level error boundary placement. (Plugin-slot per-claim boundary requirement under `dashboard-shell-slots` is unchanged.)
- **Affected code**:
  - `packages/client/src/components/SessionCard.tsx` — import restoration only.
  - `packages/client/src/App.tsx` — one new `<ErrorBoundary>` wrap around layout chrome.
  - `packages/client/src/__tests__/no-undeclared-mdi-fallback.test.ts` — new repo-lint.
- **No protocol, server, or extension changes.** No new dependencies.
- **No user-visible behavior change** in the happy path. Failure path: blank window → small "Shell encountered an error" panel + reload link.

## Out of scope

- Auditing every other client component for missing imports. Repo-lint catches the icon-fallback shape; broader symbol-typo detection is the TypeScript compiler's job (and the bug only escapes type-checking when the build pipeline ships an existing dist that was compiled before the regression — see "Why this slipped past TS" below).
- Re-architecting the layout to per-region boundaries (header / sidebar / content separately). One boundary at the chrome root is sufficient to prevent the blank-window symptom; finer granularity can come later if a real recovery UX requires it.
- Adding a `render-process-gone` listener in `packages/electron/src/main.ts`. The current bug is **not** an Electron renderer process crash — the renderer stays alive — so reload-on-crash logic is orthogonal. Worth its own change if real renderer crashes are observed.

## Why this slipped past TypeScript

`SessionCard.tsx` is type-checked, and `mdiConsoleLine` is referenced as a free identifier. `tsc` *would* flag this as `Cannot find name 'mdiConsoleLine'`. The regression shipped because the user is running a **local production build** (`npm run build`) where the compiled `dist/client/assets/index-*.js` was produced from a working tree that passed type-check on a previous commit, then the import was removed in `26cc9ee7` and a fresh `npm run build` succeeded only because Vite's transform pipeline does not enforce `tsc`'s `noUnusedLocals` / undeclared-name errors at bundle time. The repo-lint in §3 closes that gap for the specific `?? mdi*` fallback shape; running `npm run typecheck` (or its equivalent in CI) would have caught it as well — that's a separate hygiene question.
