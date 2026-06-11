## ADDED Requirements

### Requirement: ModelInfo SHALL carry capability metadata

The `ModelInfo` wire type SHALL include optional `name`, `reasoning`, `vision`,
`contextWindow`, and `metadataSource` fields in addition to `provider` and `id`.
The bridge SHALL populate them from pi's `ModelRegistry` at every `models_list`
push site, replacing the prior `{ provider, id }`-only projection.

#### Scenario: Catalog-resolved model carries real capabilities

- **GIVEN** a model whose `enrichModelMetadata()` probe hit pi's registry
- **WHEN** the bridge pushes `models_list`
- **THEN** the `ModelInfo` SHALL carry `metadataSource: "catalog"`, `reasoning`
  and `vision` reflecting the real `Model` fields (`vision` = `input.includes("image")`),
  plus `name` and `contextWindow`

#### Scenario: Fallback model is flagged as assumed

- **GIVEN** a custom-provider model whose upstream `/v1/models` reported no
  capability data (no catalog match)
- **WHEN** the bridge pushes `models_list`
- **THEN** the `ModelInfo` SHALL carry `metadataSource: "fallback"`, `vision: true`
  (forced default), and `reasoning: false` (forced default)

#### Scenario: Old bridge omitting new fields still works

- **GIVEN** a bridge that pushes `ModelInfo` with only `{ provider, id }`
- **WHEN** the client renders the selector
- **THEN** no capability badge SHALL be shown for that model and no error SHALL occur

### Requirement: Selector SHALL render capability badges with confidence

The `ModelSelector` SHALL render a `🧠` badge for `reasoning: true` and a `👁`
badge for `vision: true` ONLY when `metadataSource === "catalog"`. When
`metadataSource === "fallback"` it SHALL render muted `🧠?` and `👁?` markers.
When `metadataSource` is absent it SHALL render no capability badge.

#### Scenario: Confirmed capability shows solid badge

- **GIVEN** a model with `metadataSource: "catalog"`, `reasoning: true`, `vision: true`
- **THEN** the row SHALL show a solid `🧠` and a solid `👁`

#### Scenario: Confirmed-absent capability shows no badge

- **GIVEN** a model with `metadataSource: "catalog"`, `vision: false`
- **THEN** the row SHALL NOT show any vision marker

#### Scenario: Assumed capability shows question marker

- **GIVEN** a model with `metadataSource: "fallback"`
- **THEN** the row SHALL show muted `👁?` and `🧠?` markers (not solid badges)

### Requirement: Favorites SHALL persist server-side and broadcast

The dashboard SHALL persist favorite model labels (`"provider/id"`) in
`~/.pi/dashboard/preferences.json#favoriteModels` via `preferencesStore`. Adding
or removing a favorite SHALL broadcast `favorite_models_updated { labels }` to
all connected browsers. Favorites SHALL survive server restart.

#### Scenario: Favoriting persists and broadcasts

- **WHEN** a browser sends `favorite_model { label: "anthropic/claude-opus-4-7" }`
- **THEN** the server SHALL append the label to `favoriteModels` (deduped),
  persist it, and broadcast `favorite_models_updated` with the full label list to
  every connected browser

#### Scenario: Unfavoriting removes and broadcasts

- **GIVEN** `"anthropic/claude-opus-4-7"` is in `favoriteModels`
- **WHEN** a browser sends `unfavorite_model { label: "anthropic/claude-opus-4-7" }`
- **THEN** the server SHALL remove the label, persist, and broadcast the updated list

#### Scenario: Favorites survive restart

- **GIVEN** `favoriteModels` contains two labels
- **WHEN** the server restarts and a browser cold-loads `GET /api/favorite-models`
- **THEN** the response SHALL contain both labels

### Requirement: Selector SHALL provide a favorites filter and star toggles

The `ModelSelector` SHALL render models grouped by provider only (NO separate
pinned favorites group), a per-row ★ toggle that dispatches `favorite_model` /
`unfavorite_model`, and a **★ Favs** filter that narrows the list to favorites.
The **★ Favs** filter state SHALL persist per-browser in `localStorage` so it
survives reload regardless of whether it is on or off.

#### Scenario: Favorited model shows a filled star inline (no separate group)

- **GIVEN** `"anthropic/claude-opus-4-7"` is favorited
- **WHEN** the dropdown opens with provider filter = "All Providers"
- **THEN** that model SHALL appear under its provider group with a filled ★
  toggle
- **AND** there SHALL be no separate **★ Favorites** group

#### Scenario: Favorites filter narrows the list

- **GIVEN** three favorited models across two providers
- **WHEN** the user enables the **★ Favs** toggle
- **THEN** only those three models SHALL be listed, grouped by provider

#### Scenario: Favs filter persists across reload

- **GIVEN** the user enabled the **★ Favs** toggle
- **WHEN** the page reloads
- **THEN** the selector SHALL restore the **★ Favs** toggle to enabled from
  `localStorage`

#### Scenario: Provider filter still applies within favorites

- **GIVEN** favorites across `anthropic` and `proxy`, **★ Favs** enabled
- **WHEN** the provider filter is set to `anthropic`
- **THEN** only the `anthropic` favorites SHALL be listed

### Requirement: Provider filter SHALL persist per-browser

The selector's provider-filter selection SHALL persist in `localStorage` under
`modelselector.providerFilter` and restore on mount. Opening the dropdown SHALL
NOT reset the provider filter (only the transient text filter resets).

#### Scenario: Provider filter survives dropdown reopen

- **GIVEN** the user set the provider filter to `proxy`
- **WHEN** the user closes and reopens the dropdown
- **THEN** the provider filter SHALL still be `proxy`

#### Scenario: Provider filter survives page reload

- **GIVEN** the user set the provider filter to `anthropic`
- **WHEN** the page reloads
- **THEN** the selector SHALL restore the filter to `anthropic` from localStorage

#### Scenario: Text filter still resets on open

- **GIVEN** the user typed `opus` into the text filter then closed the dropdown
- **WHEN** the user reopens the dropdown
- **THEN** the text filter SHALL be empty while the provider filter is preserved
