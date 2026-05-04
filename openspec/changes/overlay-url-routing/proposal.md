# overlay-url-routing

## Why

The dashboard has eleven full-content-area "windows" but only six of them have URLs. The other five live in `App.tsx` `useState`, invisible to the browser's history stack. Consequence:

1. **Back from a sidebar-opened overlay does not return to where you came from.** If you are on `/settings`, click a sidebar P/D/T/S artifact, then click back, you land on `/` — not on `/settings`. The previously-archived `fix-desktop-back-navigation` change patched this with an "auto-close Settings before opening overlay" hack, which means the back arrow lands on `/` *intentionally*, but the user expected to return to Settings.
2. **No deep-linking, no shareable URLs.** Refreshing while reading a proposal artifact loses your position. You cannot send a teammate a link to "the proposal artifact for change X in repo Y."
3. **Three different back-button mechanisms.** URL-routed views use `navigate("/")`. Overlay views use `setXxx(null)`. The session header uses a custom priority chain (`useDesktopBack`). Mobile uses a separate inline switch (`App.tsx:1370–1390`). Drift between them is the original source of every navigation bug.
4. **Browser back / forward / open-in-new-tab / bookmarks do not work** for overlays.

The right fix is to lift every full-screen view into a wouter route. Browser history becomes the single source of truth for "what is on screen," and `window.history.back()` Just Works because the URL stack reflects the actual user journey — including transitions between Settings, sessions, and overlays.

This proposal supersedes the navigation portion of `fix-desktop-back-navigation` (now archived at `2026-04-30-fix-desktop-back-navigation`). The pure helper, hook, parity test, and "auto-close URL view before opening overlay" plumbing all become unnecessary and are removed by this change.

## What Changes

### 1. URL surface — every full-screen view gets a route

Complete inventory of every "window" and the URL it gets:

| View | Component | Today | Proposed URL |
|------|-----------|-------|--------------|
| Landing page | `LandingPage` | `/` | `/` (unchanged) |
| Session detail | `ChatView` + `SessionHeader` | `/session/:id` | `/session/:id` (unchanged) |
| Settings | `SettingsPanel` | `/settings` | `/settings` (unchanged) |
| Tunnel install guide | `ZrokInstallGuide` | `/tunnel-setup` | `/tunnel-setup` (unchanged) |
| Folder terminals | `TerminalsView` | `/folder/:encodedCwd/terminals` | `/folder/:encodedCwd/terminals` (unchanged) |
| Folder editor | `EditorView` | `/folder/:encodedCwd/editor` | `/folder/:encodedCwd/editor` (unchanged) |
| Legacy single terminal | `TerminalView` | `/terminal/:id` | `/terminal/:id` (kept, deprecated) |
| **OpenSpec proposal preview** | `OpenSpecPreview` | `previewState` (state) | `/folder/:encodedCwd/openspec/:changeName/:artifactId` |
| **OpenSpec archive browser** | `ArchiveBrowserView` | `archiveBrowserCwd` (state) | `/folder/:encodedCwd/openspec/archive` |
| **OpenSpec specs browser** | `SpecsBrowserView` | `specsBrowserCwd` (state) | `/folder/:encodedCwd/openspec/specs` |
| **README preview** | `MarkdownPreviewView` | `readmePreview` (state) | `/folder/:encodedCwd/readme` |
| **Pi resources index** | `PiResourcesView` | `piResourcesState` (state) | `/folder/:encodedCwd/pi-resources` |
| **Pi resource file preview** | `MarkdownPreviewView` | `piResourceFilePreview` (state) | `/pi-resource?path=<urlencoded>&title=<urlencoded>` |
| **Session file diff view** | `FileDiffView` | `diffViewSessionId` (state) | `/session/:id/diff` |
| **Flow YAML preview** | `MarkdownPreviewView` | `flowYamlPreview` (state) | `/session/:id/flow-yaml` (best-effort, see below) |
| **Flow agent detail** | `FlowAgentDetail` | `flowDetailAgent` (state) | `/session/:id/flow/:agentName` |
| **Flow architect detail** | `FlowArchitectDetail` | `architectDetailOpen` (state) | `/session/:id/architect` |

`encodedCwd` uses the existing `encodeFolderPath` / `decodeFolderPath` helpers (`packages/client/src/lib/folder-encoding.ts`).

### 2. Modals and dialogs — NOT URL-routed

The following remain in-component state because they are ephemeral, modal, or sub-component concerns. URL-routing them would add noise without value:

- `pinDialogOpen` — pin directory dialog (transient)
- `flowPickerOpen`, `flowNewOpen`, `flowEditPickerOpen`, `flowDeletePickerOpen` — flow management dialogs
- `flowEditFlowName`, `flowDeleteFlowName`, `flowLaunchTarget` — flow dialog sub-state
- `extensionModulePickerOpen`, `extensionModuleOpen` — extension UI modals
- `mobileOpen` — mobile sidebar overlay
- `architectDetailOpen` — *was* in the URL-routed list above, see §3
- `sourceOpenAgent` — toggle inside FlowDashboard, not a full takeover

Settings-page sub-tabs (`general`, `pi-ecosystem`, `network`, etc.) become query params: `/settings?tab=pi-ecosystem`. (Optional sub-scope; can be deferred without blocking the main change.)

### 3. Decisions baked in

- **Path style over query string.** Consistent with existing `/folder/:encodedCwd/...` convention. Cleaner, more shareable. Only `pi-resource` uses query because its `path` is an absolute filesystem path that may live outside any pinned folder.
- **`flowYamlPreview` is URL-routed but content is best-effort.** The YAML is computed from `state.architectState.flowYamlContent` or fetched from `flowSource`. On cold load, if the session is not yet loaded or has no YAML state, the route renders a "Flow YAML not available — return to session" placeholder. Acceptable tradeoff — overrides on this overlay are rare and the URL still gives users a back-button-friendly anchor.
- **`flowDetailAgent` and `architectDetailOpen` get URLs.** Originally I called them out as "in-component state" because they are sub-views inside FlowDashboard. But on reflection: they ARE full content-area takeovers (they replace ChatView), they survive sidebar interaction, and the user explicitly asked for "every window" to have a URL. They get one.
- **Overlays become mutually exclusive.** Today, `previewState` and `flowYamlPreview` could be set simultaneously (the JSX priority chain at App.tsx:884–895 picks the higher-priority one to render). With URL-routed overlays, only one route matches at a time. This matches what users perceive anyway and removes the priority chain and its parity test entirely.
- **Mobile uses the same routes.** `getMobileDepth` is rewritten to derive depth from `useRoute` matches instead of state flags — no logic change, just a different input source.

### 4. Code that is DELETED by this change

The previously-archived `fix-desktop-back-navigation` introduced:
- `packages/client/src/lib/desktop-back.ts` (pure helper + 256-combination parity test)
- `packages/client/src/hooks/useDesktopBack.ts` (priority-chain dispatcher)
- `navigate` / `settingsMatch` / `tunnelSetupMatch` plumbing through `useOpenSpecActions` and `useContentViews` to auto-close URL views before opening overlays

All of it becomes obsolete. The session-header back button reduces to:

```ts
onBack={() => {
  if (window.history.length > 1) window.history.back();
  else navigate("/");
}}
```

This single fallback behaviour replaces the helper, hook, priority chain, parity test, and auto-close hack. The mobile inline switch (`App.tsx:1370–1390`) collapses to the same two-line check.

### 5. Bonus: deep-link refresh resilience

Each new route handles cold-load gracefully:

- `/folder/:encodedCwd/openspec/:changeName/:artifactId` — `OpenSpecPreview` reads `openspecMap[cwd]` from the WS replay; if missing, renders a loading spinner; if cwd has no such change after WS settles, redirects to `/`.
- `/folder/:encodedCwd/readme` — fetches via existing `/api/readme?cwd=` (already cwd-driven).
- `/folder/:encodedCwd/pi-resources` — fetches via existing pi-resources API.
- `/pi-resource?path=...` — fetches via existing `/api/pi-resource-file`.
- `/session/:id/diff` — fetches via existing `/api/session-diff`.
- `/session/:id/flow-yaml` — best-effort placeholder if no state.
- `/session/:id/flow/:agentName` — placeholder if session/agent not present.

## Capabilities

### Modified Capabilities

- `url-routing`: massively expanded. The two `MODIFIED` requirements from the just-archived fix-desktop-back-navigation are themselves modified (back button is no longer a priority-chain dispatcher; it's a plain history-back with cold-load fallback). Eight `ADDED` requirements cover the new routes. The "Sidebar overlays auto-close URL-route views" requirement from fix-desktop-back-navigation is **REMOVED** (no longer applicable — sidebar opens push a new URL on top, browser back returns to the previous URL).

## Impact

### Modified files

- `packages/client/src/App.tsx`:
  - Add 9 new `useRoute(...)` calls (one per new route).
  - Replace overlay state declarations with route-derived values.
  - Convert overlay rendering from `state ? <X/> : null` to `match ? <X cwd={params.cwd} ... /> : null`.
  - Replace every `setPreviewState({...})`, `setReadmePreview(...)`, etc. with `navigate(<route>)`.
  - Replace every `setPreviewState(null)` etc. with `() => window.history.back()` (or remove — overlay's own back button now works naturally).
  - Delete `clearAppContentViews` / `clearAllContentViews` / `clearContentViews` plumbing.
  - Simplify mobile `onBack` switch and desktop session-header `onBack` to single-line `history.back()` + cold-load fallback.
  - Rewrite `getMobileDepth` input shape: takes route-match flags instead of state flags.

- `packages/client/src/hooks/useOpenSpecActions.ts`: drop `navigate`/`settingsMatch`/`tunnelSetupMatch` deps; `handleReadArtifact` no longer mutates state — it calls `navigate(\`/folder/${encodeFolderPath(cwd)}/openspec/${changeName}/${artifactId}\`)`. Or simpler: callers do the navigation themselves; the hook becomes a no-op for that handler (consider removing).

- `packages/client/src/hooks/useContentViews.ts`: same shape — `handleOpenPiResources` / `handleViewPiResourceFile` / `handleViewReadme` become navigation calls. Local `useState` for `piResourcesState` / `piResourceFilePreview` / `readmePreview` is removed; data is derived from route params + API fetch on mount.

- `packages/client/src/lib/mobile-depth.ts`: input interface renamed from state-flags to route-match flags.

### Deleted files

- `packages/client/src/lib/desktop-back.ts`
- `packages/client/src/hooks/useDesktopBack.ts`
- `packages/client/src/lib/__tests__/desktop-back.test.ts` (256-combination parity test)
- `packages/client/src/hooks/__tests__/useDesktopBack.test.tsx` (if present)

### New files

- `packages/client/src/lib/route-builders.ts` — small utility module with one builder per new route (e.g. `buildOpenSpecPreviewUrl(cwd, change, artifact)`). Keeps callsites consistent and refactor-safe.
- `packages/client/src/lib/__tests__/route-builders.test.ts`.

### New tests

- One unit test per route builder (URL escaping, encoded-cwd round-trip, special chars in artifact IDs).
- One integration test per new route confirming:
  - Direct navigation to the URL renders the right component
  - Refresh on the URL renders the right component once data loads
  - Back from the URL returns to the previous URL
  - Sidebar action that opens the overlay pushes onto history (does not replace)
- One regression test for "open Settings → click sidebar artifact → back → return to Settings" (the user's repro).

### Spec deltas

- `openspec/changes/overlay-url-routing/specs/url-routing/spec.md`:
  - MODIFIED: `Back navigation button` (now plain history-back with cold-load fallback)
  - REMOVED: `Sidebar overlays auto-close URL-route views` (no longer applicable)
  - ADDED: 8 new route requirements (one per new route)
  - ADDED: one cross-cutting requirement that opening any content-area view from the sidebar SHALL push onto history (not replace), so back returns to the prior view.

### Migration notes for `fix-desktop-back-navigation` (archived)

Add a "Superseded by" note at the top of `openspec/changes/archive/2026-04-30-fix-desktop-back-navigation/proposal.md` pointing to this change. Archives are otherwise immutable. The supersession is documented inside this proposal's §4.

### Non-impacts

- No protocol/server changes. All new routes are pure client-side.
- No `index.html` / SPA fallback changes. Server already returns `index.html` for unmatched paths.
- No persistence / WebSocket / extension changes.
- No new dependencies. Wouter already supports nested + parameterised routes; everything else (`encodeFolderPath`, fetch APIs) exists.
- No mobile-specific work beyond the `getMobileDepth` rename.
