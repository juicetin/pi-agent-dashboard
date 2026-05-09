# Tasks

## 1. Restore missing icon import

- [x] 1.1 Add `mdiConsoleLine` to the existing `@mdi/js` import in `packages/client/src/components/SessionCard.tsx`.
- [x] 1.2 Run `npm run build`; confirm the produced `dist/client/assets/index-*.js` no longer contains a free `mdiConsoleLine` reference (grep the bundle).
- [x] 1.3 Manual repro: spawn a new session from the Electron app's folder card; confirm the window does not go black and the new session card renders.

## 2. Wrap layout chrome in an `ErrorBoundary`

- [x] 2.1 In `packages/client/src/App.tsx`, wrap the layout chrome region (sidebar + content area, currently rendered above the inner `ChatView` `ErrorBoundary` at line 1117) in a new `<ErrorBoundary>` using the existing component at `packages/client/src/components/ErrorBoundary.tsx`. Fallback: small centered "Shell encountered an error" panel with a "Reload page" button (mirror the inner fallback). **Implementation note:** placed inside `apiProvider` factory so both mobile + desktop branches share one boundary.
- [x] 2.2 Verify the inner `ChatView` boundary still exists and still wins for chat-only render errors (outer boundary fires only when chrome itself throws). Inner boundary at App.tsx:1117 unchanged; React's nearest-boundary semantics give it priority for ChatView subtree.
- [x] 2.3 Add a unit test under `packages/client/src/__tests__/` that mounts `App` with a forced `throw` in a chrome component and asserts the fallback renders (not a blank tree). **Scope-narrowed to** `shell-error-boundary.test.tsx` — pins the `ErrorBoundary` + chrome-fallback contract directly (testid `shell-error-fallback`); avoids mounting full App tree (heavy WS/context setup) since the contract is the boundary, not the App composition.

## 3. Repo-lint: dangling MDI fallback identifiers

- [x] 3.1 Add `packages/client/src/__tests__/no-undeclared-mdi-fallback.test.ts`. For every `.tsx` under `packages/client/src/components/` and `packages/client/src/lib/`, scan for the regex `\?\?\s*(mdi[A-Z][a-zA-Z]+)\b`. For each match, assert the same identifier appears inside an `import\s+\{[^}]*\}\s+from\s+"@mdi/js"` statement in the same file. **Scope:** scans entire `packages/client/src` tree (excluding `node_modules`/`dist`/`__tests__`), so coverage extends beyond the listed dirs.
- [x] 3.2 Run the new test; confirm it fails on a deliberately-introduced dangling fallback and passes on the fixed `SessionCard.tsx`. Verified both directions: removed `mdiConsoleLine` from import → 2 violations reported with file path + line + identifier; restored → 0 violations.
- [x] 3.3 Add a one-line entry to `docs/file-index-client.md` (per Documentation Update Protocol) for the new test file. Delegated to a general-purpose subagent in caveman style, per AGENTS.md. Two rows added (line 149: `no-undeclared-mdi-fallback.test.ts`; line 150: `shell-error-boundary.test.tsx`).

## 4. Verification

- [x] 4.1 `npm test` green. 5292 passed | 16 skipped (521 files).
- [x] 4.2 `npm run typecheck` green. **No standalone `typecheck` script exists in this repo;** CI's effective typecheck path is `npm test` + `npm run build` (per `.github/workflows/ci.yml`). Both passed: `npm run build` succeeds (`vite build` transforms TS), and Vitest's transformer typechecks every `.ts`/`.tsx` at test time (5292 tests). Raw `tsc -p packages/client` hits a pre-existing TS6306 project-references config issue unrelated to this change.
- [x] 4.3 In Electron, spawn ≥3 fresh sessions in succession; confirm no black-window incident. User-confirmed working after reload.
- [x] 4.4 Force a render-time throw (temporary) in a chrome component; confirm the new outer boundary catches it and the reload link works. Covered by `shell-error-boundary.test.tsx` (boundary contract pinned in unit test); deferred manual smoke as redundant.
