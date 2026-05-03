# TUI → Dashboard Mapping (canonical)

The mapping table the skill uses in **augment** mode to propose ports for each TUI callsite. Same table informs **new** mode users when picking which slots to claim.

## Rules of thumb

- **Already-dashboard-aware** = the call works in dashboard sessions today via the bridge's PromptBus → DashboardDefaultAdapter routing. No port needed.
- **Required port** = the call is a no-op in dashboard sessions; you MUST port it via a slot claim or your feature is dashboard-invisible.
- **Optional port** = the call works in the dashboard with default rendering, but a custom slot claim gives a richer UX.

## Mapping table

| TUI surface | Status today | Action | Suggested slot |
|---|---|---|---|
| `ctx.ui.select(...)` | Already-dashboard-aware (PromptBus → DashboardDefaultAdapter renders as a chat dialog) | None | — |
| `ctx.ui.input(...)` | Already-dashboard-aware | None | — |
| `ctx.ui.confirm(...)` | Already-dashboard-aware | None | — |
| `ctx.ui.editor(...)` | Already-dashboard-aware | None | — |
| `ctx.ui.multiselect(...)` | Already-dashboard-aware (bridge-patched via `multiselect-polyfill.ts`) | None | — |
| `ctx.ui.custom<T>(...)` | **No-op in pi 0.70 RPC mode** | **Required port** | `content-view` (full-screen) or `anchored-popover` (floating) — pick by context heuristic: if the custom UI owns the screen, content-view; if it's a transient popup, anchored-popover. Pair content-view with a `command-route` claim. |
| `pi.registerTool({ name: X, ... })` | Tool registers; default tool card renders | **Optional port** | `tool-renderer` claim with `toolName: "X"` for richer rendering of `tool_call` events. Use the `<DashboardDemo>`-shaped pattern from `packages/demo-plugin/src/client.tsx`. |
| `pi.events.on("ui:list-modules", ...)` (extension-UI probe handler) | Already covered by `extension-ui-system` Phase 1+2 if the extension implements it correctly | None — but verify the extension returns descriptors of every relevant kind (`management-modal`, `footer-segment`, `agent-metric`, `breadcrumb`, `gate`, `toast`, `rjsf-form`, `settings-section`) | — |
| Direct reads of `~/.pi/agent/settings.json` for plugin-shaped config | No reactivity, no schema validation | **Required port for migration** | `settings-section` slot + `usePluginConfig<T>()` hook + `configSchema.json`. Migrate keys from `<extension-id>.*` (top-level) into `plugins.<extension-id>.*`. |
| Custom long-running TUI loops or non-prompt-bus visual rendering | Pure-TUI only | **Required port** | `content-view` or `content-inline-footer` depending on placement. |
| `ctx.fork(...)`, `pi.newSession(...)`, `ctx.switchSession(...)` | **Banned** in dashboard sessions (bridge invariant) | Surface warning; do not port | — |

## Heuristics for the analyzer (augment mode)

When inspecting a `ctx.ui.custom<T>()` callsite:

1. Read ±20 lines for the surrounding flow.
2. If the call is awaited inside a `for` loop or run-to-completion subroutine and the result is consumed once → likely an **anchored-popover**.
3. If the call is the entry point of a long-lived view that the user navigates to → likely a **content-view** (paired with a `command-route` keyed off the slash command the user invokes to open it).
4. If the call returns settings/preferences → migrate to `settings-section` instead.

When inspecting `pi.registerTool({ name: X })`:

1. Find the tool's invocation sites in chat events (`tool_call.name === X`).
2. If the tool emits structured output the default card flattens awkwardly → recommend `tool-renderer`.
3. If the tool's output is a simple string/JSON the default card renders fine → mark as `optional-port`.

When inspecting direct reads of `~/.pi/agent/settings.json`:

1. Identify the keys read (`grep` the file for path strings into the JSON).
2. Recommend a `configSchema.json` derived from those keys (best-guess JSON Schema 7).
3. Recommend a `settings-section` claim with a form rendering each key.

## When a callsite doesn't fit any row

Mark `mappedSlot: null, status: "needs-design"` in the proposal and surface to the user with a note. Don't auto-port.
