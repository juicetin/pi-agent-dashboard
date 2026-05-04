# Tasks: overlay-url-routing

## 1. Route builders + unit tests

- [ ] 1.1 Add `packages/client/src/lib/route-builders.ts` with one builder per new route:
  - `buildOpenSpecPreviewUrl(cwd, changeName, artifactId)`
  - `buildOpenSpecArchiveUrl(cwd)`
  - `buildOpenSpecSpecsUrl(cwd)`
  - `buildReadmeUrl(cwd)`
  - `buildPiResourcesUrl(cwd)`
  - `buildPiResourceFileUrl(path, title)` (uses query string)
  - `buildSessionDiffUrl(sessionId)`
  - `buildFlowYamlUrl(sessionId)`
  - `buildFlowAgentUrl(sessionId, agentName)`
  - `buildArchitectUrl(sessionId)`
- [ ] 1.2 All builders use `encodeFolderPath` for cwd and `encodeURIComponent` for other dynamic segments.
- [ ] 1.3 Add `packages/client/src/lib/__tests__/route-builders.test.ts` covering:
  - Round-trip encode/decode for cwd
  - Special characters in changeName / artifactId / agentName / title
  - Query-string encoding for `pi-resource` (path with `?`, `&`, `#`, spaces)

## 2. Add new useRoute calls (additive, no behaviour change)

- [ ] 2.1 Add 9 new `useRoute(...)` calls in `App.tsx` for all overlay routes.
- [ ] 2.2 Add `useSearchParam`-equivalent helper for `/pi-resource` query string (verify wouter version first; write a 5-line helper if needed).
- [ ] 2.3 At this stage both state-driven and URL-driven paths can coexist — verify nothing breaks.

## 3. Migrate OpenSpec preview to URL

- [ ] 3.1 In `useOpenSpecActions.handleReadArtifact`, replace `setPreviewState({...})` with `navigate(buildOpenSpecPreviewUrl(cwd, changeName, artifactId))`. Drop the auto-close-Settings hack.
- [ ] 3.2 Replace the JSX `previewState ? <OpenSpecPreview .../>` block with `openspecPreviewMatch ? <OpenSpecPreview cwd={...} changeName={...} initialArtifact={...} /> : null`.
- [ ] 3.3 `OpenSpecPreview` reads `openspecMap[cwd]` to populate `artifacts`. If empty, show loading state. After WS settle with no change found, show "Not found" inline with a back button.
- [ ] 3.4 Remove `previewState` `useState` and `setPreviewState` from `App.tsx`.
- [ ] 3.5 Update the artifact-letter buttons (`SessionHeader`, `FolderOpenSpecSection`, attached-proposal summary) to call `navigate(buildOpenSpecPreviewUrl(...))` instead of `onReadArtifact` callback chains.
- [ ] 3.6 Test: navigate directly to `/folder/:encodedCwd/openspec/:changeName/proposal` → renders preview.
- [ ] 3.7 Test: refresh on the URL → renders preview after WS load.

## 4. Migrate OpenSpec archive browser

- [ ] 4.1 Replace `setArchiveBrowserCwd(cwd)` callsites with `navigate(buildOpenSpecArchiveUrl(cwd))`.
- [ ] 4.2 Replace JSX block with `archiveMatch ? <ArchiveBrowserView cwd={decodeFolderPath(am.encodedCwd)} /> : null`.
- [ ] 4.3 Remove `archiveBrowserCwd` `useState`.
- [ ] 4.4 Test: direct navigation + refresh.

## 5. Migrate OpenSpec specs browser

- [ ] 5.1–5.4 Same shape as task 4 for `specsBrowserCwd` → `/folder/:encodedCwd/openspec/specs`.

## 6. Migrate README preview

- [ ] 6.1 Replace `useContentViews.handleViewReadme` body with `navigate(buildReadmeUrl(cwd))`.
- [ ] 6.2 Replace JSX block with `readmeMatch ? <MarkdownPreviewView ... /> : null`. The component fetches `/api/readme?cwd=...` on mount.
- [ ] 6.3 Remove `readmePreview` from `useContentViews`.
- [ ] 6.4 Test: direct navigation + refresh.

## 7. Migrate Pi resources index

- [ ] 7.1–7.4 Same shape as task 6 for `piResourcesState` → `/folder/:encodedCwd/pi-resources`.

## 8. Migrate Pi resource file preview

- [ ] 8.1 Replace `useContentViews.handleViewPiResourceFile` body with `navigate(buildPiResourceFileUrl(path, title))`.
- [ ] 8.2 Replace JSX block with `piResourceFileMatch ? <MarkdownPreviewView title={searchParams.title} ... /> : null`. The component reads `?path=` and `?title=` from query string and fetches `/api/pi-resource-file`.
- [ ] 8.3 Remove `piResourceFilePreview` from `useContentViews`.
- [ ] 8.4 Test: direct navigation with various `path` + `title` query strings; refresh.

## 9. Migrate session file diff

- [ ] 9.1 Replace `setDiffViewSessionId(id)` with `navigate(buildSessionDiffUrl(id))`.
- [ ] 9.2 Replace JSX block with `diffMatch ? <FileDiffView sessionId={dm.id} /> : null`.
- [ ] 9.3 Remove `diffViewSessionId` `useState`.
- [ ] 9.4 Test: direct navigation + refresh.

## 10. Migrate flow YAML preview (best-effort)

- [ ] 10.1 Replace `setFlowYamlPreview({content, title})` callsites with `navigate(buildFlowYamlUrl(sessionId))`.
- [ ] 10.2 Replace JSX block with `flowYamlMatch ? <FlowYamlPreview sessionId={fym.id} /> : null`.
- [ ] 10.3 New component `FlowYamlPreview` (or extend `MarkdownPreviewView`): reads session state, renders YAML or "not available" placeholder with back button.
- [ ] 10.4 Remove `flowYamlPreview` `useState`.
- [ ] 10.5 Test: navigation when YAML is available; navigation when not; cold-load refresh.

## 11. Migrate flow agent detail

- [ ] 11.1 Replace `setFlowDetailAgent(agentName)` with `navigate(buildFlowAgentUrl(sessionId, agentName))`.
- [ ] 11.2 Replace JSX block with `flowAgentMatch ? <FlowAgentDetail .../> : null`. Component takes `sessionId` + `agentName` from URL.
- [ ] 11.3 Remove `flowDetailAgent` `useState`.
- [ ] 11.4 Test: navigation + cold-load + refresh.

## 12. Migrate flow architect detail

- [ ] 12.1 Replace `setArchitectDetailOpen(true/false)` with `navigate(buildArchitectUrl(sessionId))` and `history.back()`.
- [ ] 12.2 Replace JSX block with `architectMatch ? <FlowArchitectDetail .../> : null`.
- [ ] 12.3 Remove `architectDetailOpen` `useState`.
- [ ] 12.4 Test: navigation + back behaviour.

## 13. Simplify back arrows

- [ ] 13.1 Replace `App.tsx:821` desktop session-header `onBack` with `() => window.history.length > 1 ? window.history.back() : navigate("/")`.
- [ ] 13.2 Replace mobile `onBack` switch (`App.tsx:1370–1390`) with the same single line.
- [ ] 13.3 Replace overlay component `onBack` props that called `setXxx(null)` with the same single line — or remove the prop entirely if the page chrome's back button is sufficient.

## 14. Delete obsolete code

- [ ] 14.1 Delete `packages/client/src/lib/desktop-back.ts`.
- [ ] 14.2 Delete `packages/client/src/hooks/useDesktopBack.ts`.
- [ ] 14.3 Delete `packages/client/src/lib/__tests__/desktop-back.test.ts` (256-combination parity test).
- [ ] 14.4 Drop the `navigate` / `settingsMatch` / `tunnelSetupMatch` deps from `useOpenSpecActions.OpenSpecActionDeps`.
- [ ] 14.5 Drop the same deps from `useContentViews.UseContentViewsOptions`.
- [ ] 14.6 Delete `clearAppContentViews` and `clearAllContentViews` from `App.tsx` (no longer needed — URL switch handles cleanup).
- [ ] 14.7 Delete `clearAll: clearContentViews` from `useContentViews` return value (or simplify to no-op for now).

## 15. Update getMobileDepth

- [ ] 15.1 Rewrite `MobileDepthInput` interface in `packages/client/src/lib/mobile-depth.ts` to take route-match flags instead of state flags.
- [ ] 15.2 Update `getMobileDepth` body to use new flags.
- [ ] 15.3 Update `App.tsx` callsite to pass route-match flags.
- [ ] 15.4 Update `mobile-depth.test.ts` to use new input shape.

## 16. Regression tests

- [ ] 16.1 New test: navigate to `/settings`, simulate sidebar-click that calls `navigate(buildOpenSpecPreviewUrl(...))`, verify URL is the new preview URL, then `window.history.back()`, verify URL is back to `/settings` and SettingsPanel renders.
- [ ] 16.2 Existing cold-load test for `/session/:id` back → `/` continues to pass.
- [ ] 16.3 New test per overlay route confirming refresh on the URL works.

## 17. Spec delta

- [ ] 17.1 Write `openspec/changes/overlay-url-routing/specs/url-routing/spec.md`:
  - MODIFIED: `Back navigation button` (history-back with cold-load fallback)
  - REMOVED: `Sidebar overlays auto-close URL-route views` (no longer applicable)
  - ADDED: 9 new route requirements (one per new overlay route)
  - ADDED: `Sidebar interactions push onto history` (cross-cutting requirement)
- [ ] 17.2 Run `openspec validate overlay-url-routing --strict`.

## 18. Documentation + supersession note

- [ ] 18.1 Update `AGENTS.md`:
  - Remove rows for `desktop-back.ts` and `useDesktopBack.ts`.
  - Add row for `route-builders.ts`.
  - Update `App.tsx` row to describe URL-routed overlays.
  - Update `mobile-depth.ts` row with new input shape.
  - Update relevant component rows (OpenSpecPreview, ArchiveBrowserView, etc.) noting they now read URL params.
- [ ] 18.2 Update `docs/architecture.md` navigation section.
- [ ] 18.3 Add "Superseded by overlay-url-routing" note at the top of `openspec/changes/archive/2026-04-30-fix-desktop-back-navigation/proposal.md`. (Archive convention: small additive note only.)

## 19. Optional sub-scope: Settings sub-tabs

- [ ] 19.1 (Optional) Add `?tab=...` query string to `/settings`. Sub-tab clicks call `navigate("/settings?tab=...")`. Refresh restores tab. Back between tabs works naturally.
- [ ] 19.2 (Optional) Spec delta requirement for settings sub-tab routing.

## 20. Verification

- [ ] 20.1 `npm test` clean (or pre-existing flakes only).
- [ ] 20.2 `tsc --noEmit` clean.
- [ ] 20.3 Manual smoke (dev mode):
  - Open Settings, click sidebar P artifact → preview URL pushes; back arrow returns to `/settings`.
  - Hard-refresh on `/folder/:encodedCwd/openspec/:change/proposal` → renders preview.
  - Hard-refresh on `/session/:id/diff` → renders diff view.
  - Hard-refresh on `/session/:id/flow-yaml` with no session loaded → placeholder.
  - Open URL `/folder/:encodedCwd/readme` in a new tab → renders README.
  - Browser back/forward across multiple overlays works.
- [ ] 20.4 `curl -X POST http://localhost:8000/api/restart` and re-smoke.
