## Why

The dashboard model selector (`ModelSelector.tsx`) renders models as flat
`provider/id` strings. The wire shape `ModelInfo` carries only `{ provider, id }`
even though the bridge's `ModelRegistry` already computes `name`, `reasoning`,
`input` (text/image), `contextWindow`, and `cost` for every model. All of it is
dropped by a lossy `.map()` at three bridge push sites.

Users want to:

- See **capabilities** at a glance — does a model support thinking (`reasoning`),
  is it vision-capable (`input.includes("image")`).
- **Favorite** models (★) and **filter to favorites** — favorites curated by the
  user, persisted server-side like pinned directories.
- Have the **provider filter persist** (today it resets to "All Providers" every
  time the dropdown opens).

Empirical finding (validated against the live `/v1/models` proxy + upstream
`llmproxy`): custom-provider models whose upstream `/v1/models` reports no
capability data are force-defaulted to `input: ["text","image"]` by
`enrichModelMetadata()` (change: `enable-image-input-custom-providers`). So a
naive 👁 badge would be a **lie** for those — e.g. `gh/gpt-3.5-turbo` is
provably text-only yet gets vision=true. The fix: carry a `metadataSource`
flag so **assumed** capabilities render `👁?` / `🧠?` instead of a confident
badge.

The selected UI direction is **Variant C** (grouped by provider, favorites
pinned to a top group). See `mock.html` at repo root for the interactive design.

## What Changes

**Wire shape (shared)**

- **MODIFY** `packages/shared/src/types.ts` — widen `ModelInfo`:
  - `name?: string` (from `Model.name`)
  - `reasoning?: boolean` (from `Model.reasoning`)
  - `vision?: boolean` (derived: `input.includes("image")`)
  - `contextWindow?: number` (from `Model.contextWindow`)
  - `metadataSource?: "catalog" | "fallback"` — `"catalog"` when
    `enrichModelMetadata()`'s probe hit pi's registry; `"fallback"` when it fell
    through to `DEFAULT_INPUT`. Gates confident-badge vs `?`-badge.
  - `cost` is OUT OF SCOPE for this change (Variant C shows no cost chip).

**Bridge (extension)**

- **MODIFY** `packages/extension/src/provider-register.ts` — `enrichModelMetadata()`
  returns an additional `metadataSource` discriminator (`"catalog"` on probe hit,
  `"fallback"` otherwise). Bridge-registered custom models propagate it.
- **MODIFY** `packages/extension/src/session-sync.ts` (2 push sites) and
  `packages/extension/src/bridge.ts` (3 push sites) — stop the lossy
  `{ provider, id }` projection; map the full enriched `ModelInfo` (name,
  reasoning, vision, contextWindow, metadataSource). Catalog models read their
  real `Model` fields; the `vision` flag derives from `input`.

**Favorites — server-persisted (mirror pinned directories)**

- **MODIFY** `packages/server/src/preferences-store.ts` — add
  `favoriteModels: string[]` to `PreferencesData` + `getFavoriteModels()`,
  `setFavoriteModels()`, `addFavoriteModel(label)`, `removeFavoriteModel(label)`.
  Debounced JSON write to `~/.pi/dashboard/preferences.json#favoriteModels`.
  Label format = `"provider/id"`.
- **MODIFY** browser protocol (`packages/shared/src/browser-protocol.ts`) — add
  `favorite_model` / `unfavorite_model` (browser→server) and
  `favorite_models_updated { labels: string[] }` (server→browser) messages,
  mirroring `pin_directory` / `pinned_dirs_updated`.
- **MODIFY** `packages/server/src/browser-handlers/directory-handler.ts` (or a
  small dedicated handler) — handle favorite/unfavorite, persist via
  `preferencesStore`, broadcast `favorite_models_updated` to all browsers.
- **MODIFY** `packages/server/src/routes/...` — `GET /api/favorite-models`
  returning `{ labels }` for cold-load (mirrors `GET /api/pinned-dirs`).

**Provider filter — localStorage (per-browser)**

- **MODIFY** `packages/client/src/components/ModelSelector.tsx` — persist
  `providerFilter` to `localStorage["modelselector.providerFilter"]`; restore on
  mount; stop resetting it to `""` on open (keep resetting the text filter only).

**Selector UI — Variant C**

- **MODIFY** `packages/client/src/components/ModelSelector.tsx`:
  - Render grouped by provider, with a pinned **★ Favorites** group on top.
  - Per-row leading ★ toggle (filled when favorited) → dispatches
    `favorite_model` / `unfavorite_model`.
  - Capability glyphs: `🧠` (reasoning, catalog-confirmed), `👁` (vision,
    catalog-confirmed), `👁?` / `🧠?` (metadataSource === "fallback", muted +
    amber `?`), context badge (`1M`, `200k`).
  - A **★ Favs** filter toggle that narrows the list to favorites only.
  - Read favorites from the new client state (hydrated from
    `favorite_models_updated` + cold `GET /api/favorite-models`).
- **MODIFY** `packages/client/src/hooks/useMessageHandler.ts` — handle
  `favorite_models_updated`; store favorite labels in App state.
- **MODIFY** `packages/client/src/App.tsx` — thread favorites + favorite/unfavorite
  senders into `StatusBar` → `ModelSelector`.

## Capabilities

### New Capabilities

- `model-selector` — model selection surface with capability badges
  (reasoning, vision, with `?` for assumed/fallback metadata), server-persisted
  favorites + favorites filter, and a persistent provider filter.

### Modified Capabilities

- (none — `ModelInfo` is a wire type, not a spec capability; the widening is
  captured under `model-selector`.)

## Impact

- Shared: `ModelInfo` +5 optional fields; 3 new protocol messages; 1 REST route.
- Bridge: `enrichModelMetadata` +1 return field; 5 push sites de-lossified.
- Server: `preferences-store` +1 list + 4 methods; 1 WS handler; 1 REST route.
- Client: `ModelSelector` rewrite to Variant C; `useMessageHandler` +1 arm;
  `App.tsx` favorites wiring; localStorage provider-filter persistence.
- No Electron / no migration: `favoriteModels` absent in old `preferences.json`
  defaults to `[]`; old bridges that send thin `ModelInfo` still work (new fields
  optional → no badge shown).

## Out of scope

- **Cost chip / $/M display** — Variant C shows no cost; deferred.
- **Thinking-level granularity** (which of min/low/.../xhigh) — `thinkingLevelMap`
  is unpopulated in pi-ai's bundled catalog and `supportsXhigh()` is not exported
  from `@earendil-works/pi-ai`. Only the binary `reasoning` flag is shippable.
- **Cross-device favorites sync beyond the server file** — favorites already sync
  across browsers via the server `preferences.json`; no extra cloud layer.
- **Sorting models by cost/context** — filtering only for now.

## Dependencies

- None. Uses existing `preferencesStore` persistence pattern, existing
  per-session `models_list` push channel, and existing pi-ai `Model` fields.
