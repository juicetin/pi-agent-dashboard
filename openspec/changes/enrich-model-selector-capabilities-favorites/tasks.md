# Tasks

## 1. Wire shape (shared)

- [x] 1.1 Widen `ModelInfo` in `packages/shared/src/types.ts` with optional
      `name`, `reasoning`, `vision`, `contextWindow`, `metadataSource:
      "catalog" | "fallback"`. → verify: `tsc` clean; existing `{provider,id}`
      callers still compile.
- [x] 1.2 Add protocol messages in `packages/shared/src/browser-protocol.ts`:
      `favorite_model { label }`, `unfavorite_model { label }` (browser→server),
      `favorite_models_updated { labels }` (server→browser). → verify: union
      types compile; message handlers exhaustive.

## 2. Bridge enrichment + de-lossify pushes

- [x] 2.1 `provider-register.ts` — `enrichModelMetadata()` returns
      `metadataSource: "catalog"` on probe hit, `"fallback"` otherwise. Add to
      `ModelMetadata`. → verify: extend `enrich-model-metadata.test.ts` with a
      catalog-hit case and a fallback case asserting the discriminator.
- [x] 2.2 Replace the lossy `{ provider, id }` map at all 5 push sites
      (`session-sync.ts` ×2, `bridge.ts` ×3) with full `ModelInfo` incl. `name`,
      `reasoning`, `vision` (= `input.includes("image")`), `contextWindow`,
      `metadataSource`. → verify: a unit test asserts a pushed `models_list`
      carries the new fields for a catalog model and `metadataSource:"fallback"`
      for an unmatched custom model.

## 3. Favorites persistence (server)

- [x] 3.1 `preferences-store.ts` — add `favoriteModels: string[]` to
      `PreferencesData`; implement `getFavoriteModels`, `setFavoriteModels`,
      `addFavoriteModel`, `removeFavoriteModel` (dedupe on add, no-op on absent
      remove). → verify: unit test add/remove/dedupe + debounced persist +
      default `[]` for legacy file.
- [x] 3.2 WS handler — handle `favorite_model` / `unfavorite_model`: persist via
      `preferencesStore`, broadcast `favorite_models_updated` with full list. →
      verify: handler test asserts persist + broadcast-to-all.
- [x] 3.3 REST `GET /api/favorite-models` → `{ labels }` (mirror
      `GET /api/pinned-dirs`). → verify: route test returns persisted labels.

## 4. Provider filter persistence (client)

- [x] 4.1 `ModelSelector.tsx` — read `providerFilter` + `favOnly` from
      localStorage on mount; write on change; remove the open-effect reset of
      `providerFilter` (keep resetting `filter` text only). → verify: component
      test: set filter → reopen → filter preserved; text filter still clears.

## 5. Selector UI — Variant C

- [x] 5.1 Render grouped-by-provider with a pinned **★ Favorites** group on top;
      per-row ★ toggle dispatching favorite/unfavorite. → verify: test favorited
      model appears in top group with filled ★.
- [x] 5.2 Capability rendering helper: `🧠`/`👁` solid for
      `metadataSource==="catalog"`, `🧠?`/`👁?` muted for `"fallback"`, nothing
      when absent; context badge from `contextWindow`. → verify: test all three
      confidence states + absent-metadata fallback.
- [x] 5.3 **★ Favs** filter toggle narrows to favorites; respects active provider
      filter. → verify: test favs-only narrows list; provider filter still applies.

## 6. Client wiring

- [x] 6.1 `useMessageHandler.ts` — handle `favorite_models_updated`; store labels
      in App state. → verify: handler test updates favorites state.
- [x] 6.2 `App.tsx` — cold-load `GET /api/favorite-models`; thread favorites +
      favorite/unfavorite senders through `StatusBar` → `ModelSelector`. →
      verify: favorites hydrate on load; toggling sends correct WS message.

## 7. Integration + docs

- [x] 7.1 Manual: add a custom provider whose models don't match the catalog;
      confirm `👁?` renders (not solid 👁). Favorite a model; reload; confirm it
      stays favorited. Set provider filter; reopen; confirm it persists. →
      verify: matches `mock.html` Variant C behavior.
- [x] 7.2 Add file-index rows for any NEW files; annotate modified files with
      `See change: enrich-model-selector-capabilities-favorites` (delegate
      `docs/` writes to a subagent per AGENTS.md caveman-style rule).
- [x] 7.3 Full rebuild + restart + reload per AGENTS.md (client build, server
      restart, `npm run reload`). → verify: `npm test` green; selector renders
      in a live session.
