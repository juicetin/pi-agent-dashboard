# Design

## Context

Two registries exist and must not be conflated:

- **Bridge registry** (pi process `ModelRegistry`) — source of the dashboard's
  per-session `models_list`. Includes built-in catalog providers AND custom
  providers registered from `~/.pi/agent/providers.json`. This is what the
  selector shows.
- **Server model-proxy registry** (`/v1/models`) — the dashboard's own pi-ai
  registry for the proxy endpoint. NOT the selector's source. Out of scope here
  except as the place the `x-pi` metadata shape was prototyped.

The selector consumes `ModelInfo[]` keyed per session in the client `modelsMap`.
Pushes are self-healing: `subscription-handler.ts` re-requests
`request_models` on every browser subscribe, and `credentials_updated` triggers
a fresh per-session push. The list re-renders live (the dropdown's `filtered`
is derived, not stateful).

## Decision 1 — `metadataSource` discriminator drives badge confidence

`enrichModelMetadata()` already branches: probe-hit (real catalog data) vs
fallback (`DEFAULT_INPUT = ["text","image"]`, `reasoning: false`). We surface
that branch as `metadataSource: "catalog" | "fallback"` on `ModelMetadata`, then
on `ModelInfo`.

Rendering rule:

| metadataSource | reasoning | vision | render |
|----------------|-----------|--------|--------|
| catalog | true | — | `🧠` solid |
| catalog | — | true | `👁` solid |
| catalog | false | false | (no badge) |
| fallback | (forced false) | (forced true) | `🧠?` + `👁?` muted |

Rationale: the fallback's `vision: true` is a *plumbing default to avoid
stripping pasted images*, not a capability assertion. Showing a confident 👁
would mislead (`gh/gpt-3.5-turbo` proves the false-positive). The `?` encodes
"assumed, unverified."

## Decision 2 — favorites persist in `preferences.json`, NOT localStorage

Favorites are user-curated model selections that should survive restart and sync
across browsers/devices hitting the same dashboard. This is exactly the
`pinnedDirectories` pattern in `preferences-store.ts`:

- Stored as `favoriteModels: string[]` (labels `"provider/id"`).
- Mutated via WS `favorite_model` / `unfavorite_model`, persisted with the
  existing debounced `scheduleSave()`, broadcast as `favorite_models_updated`.
- Cold-loaded via `GET /api/favorite-models` (mirrors `GET /api/pinned-dirs`).

No canonicalization needed (unlike pinned paths) — labels are opaque strings.
Dedupe on add (mirror `pinDirectory`'s `includes()` guard).

## Decision 3 — provider filter persists in localStorage, NOT server

The provider filter is **ephemeral per-browser view state**, not curated data.
It should not sync across devices (a phone and a desktop may want different
default filters). localStorage is the right scope. Key:
`modelselector.providerFilter`. The favorites filter toggle (`favOnly`) is the
same class → also localStorage (`modelselector.favOnly`).

This asymmetry (favorites=server, filter=localStorage) is intentional and was
the explicit user decision.

## Decision 4 — Variant C layout

Grouped by provider with a pinned **★ Favorites** group on top:

```
[ All Providers ▾ ] [ ★ Favs ]
[ Filter models…              ]
★ FAVORITES
  ⭐ Claude Sonnet 4.7      🧠 👁 1M
  ⭐ cc/claude-opus-4-7     🧠 👁 1M
ANTHROPIC
  ☆ Claude Opus 4.7        🧠 👁 1M
  ☆ Claude Haiku 4.5       🧠 👁 200k
PROXY
  ☆ glm/glm-5.1            👁? 🧠? 128k
  ☆ gh/gpt-3.5-turbo       👁? 🧠? 128k
```

Favorites still respect the active provider filter. The `★ Favs` toggle narrows
to favorites only (across all providers).

## Decision 5 — backward compatibility

- Old bridges push thin `ModelInfo` (`{provider,id}`). New optional fields are
  `undefined` → no badge, no `?`. Selector degrades to today's behavior.
- Old `preferences.json` without `favoriteModels` → `readJsonFile` default `[]`.
- New `metadataSource` on `ModelInfo` is optional; when absent, treat as
  "unknown" → render no capability badge (NOT `?`, because absence means "old
  bridge didn't tell us anything", distinct from "fallback assumed").

## Open questions

- Should the `★ Favs` filter state (localStorage) reset on dropdown open like the
  text filter, or persist? Decision: **persist** (it's a sticky view mode, unlike
  the transient search text).
- Favorite ordering: insertion order vs alphabetical? Decision: **insertion
  order** (matches how pinned dirs work); reordering is a future change.
