## Context

`packages/extension/src/ask-user-tool.ts` advertises five methods (`confirm`, `select`, `multiselect`, `input`, `batch`) via a TypeBox `anyOf` schema. Four of them map 1:1 to methods on `ExtensionUIContext` from `pi-coding-agent`:

```
ExtensionUIContext (pi-coding-agent)
├─ select(title, options, opts): Promise<string | undefined>
├─ confirm(title, message, opts): Promise<boolean>
├─ input(title, placeholder, opts): Promise<string | undefined>
├─ custom<T>(factory, options): Promise<T>
├─ notify, setWidget, setEditor…
└─ (no multiselect)
```

The `multiselect` method is called as `(ctx.ui as any).multiselect(title, options, msgOpts)`. The `as any` silences TypeScript but at runtime `ctx.ui.multiselect` is `undefined`; calling `undefined(...)` throws `TypeError: ctx.ui.multiselect is not a function`.

The dashboard already has a working browser-side renderer at `packages/client/src/components/interactive-renderers/MultiselectRenderer.tsx` that handles the prompt when a dashboard adapter claims it via `PromptBus`. The crash only surfaces in TUI sessions and in sessions where no dashboard adapter is attached.

Separately, `packages/client/src/components/ToolCallStep.tsx:58` force-expands every `ask_user` tool call:

```ts
const isAskUser = toolName === "ask_user";
const [expanded, setExpanded] = useState(hasImages || isAgentRunning || isAskUser);
```

This is correct for pending/successful calls (the dialog or result should be visible) but turns failures into wall-of-red error dumps.

## Goals / Non-Goals

**Goals:**
- Provide a working `ctx.ui.multiselect` in the dashboard extension on top of pi's existing `ctx.ui.custom<T>()` primitive.
- Fix the TUI rendering so agents never see `"ctx.ui.multiselect is not a function"`.
- Add a browser-side "Select all" affordance that does not change the wire contract.
- Quiet down the chat UX when `ask_user` calls fail.

**Non-Goals:**
- Reshaping `ask_user` to Claude Code's `AskUserQuestion` schema.
- Upstreaming `multiselect` into pi-coding-agent's `ExtensionUIContext`.
- Enabling `NATIVE_ALIASES["ask_user"] = "AskUserQuestion"` in `pi-anthropic-messages`.
- Handling sub-multiselect inside `batch` differently (uses same polyfill transparently).
- A typed "no UI available" fallback path — the polyfill is always used.
- "Other" free-text escape hatch like Claude Code's `AskUserQuestion`.

## Decisions

### Decision 1: Polyfill via `ctx.ui.custom<T>()` (not a loop over `select`)

`ctx.ui.custom<T>(factory)` lets us return a custom `Component` with keyboard focus. The factory calls `done(result)` to resolve the promise. This gives us a real multiselect UX (one pass, toggle, confirm) identical to what `select` and `confirm` look like in the TUI.

**Alternative considered**: loop `ctx.ui.select` with a "✓ Done" sentinel option. Rejected because it's clunky (N prompts for N selections), can't uncheck, and cannot return an empty selection cleanly.

### Decision 2: Always polyfill — no UI-presence branching

The polyfill is invoked unconditionally from `ask-user-tool.ts` in place of the current `(ctx.ui as any).multiselect` call. If there's no TUI and no dashboard adapter, `ctx.ui.custom` resolves however pi's no-op UI context does (most likely `undefined`), and the tool returns `undefined` which maps to "cancelled" — same semantics as `select`/`input` in that state.

**Alternative considered**: detect headless/no-UI and throw a typed error. Rejected per scope decision — kept simpler.

### Decision 3: Live in dashboard repo, not pi-coding-agent

The polyfill adds capability that pi's `ExtensionUIContext` does not expose. Rather than upstream, the dashboard owns its own `MultiSelectList` component implementation. If pi-coding-agent later exposes a native `multiselect`, we can drop the polyfill and swap the call.

### Decision 4: `MultiSelectList` keybindings (TUI)

```
  ↑ / ↓       move cursor
  space        toggle checked state of current item
  enter        confirm → done(selected[])
  esc          cancel  → done(undefined)
```

No "select all" binding in the TUI. Per scope decision, the "Select all" affordance is dashboard-only.

### Decision 5: Dashboard "Select all" is synthetic and UI-only

`MultiselectRenderer.tsx` prepends one checkbox row labeled "Select all" above the real options.

- **Checked state**: derived from `checked.size === options.length && options.length > 0` (avoids showing checked when no options). Kept as a derived value, not stored in the `checked` Set.
- **Click behavior**: if all options currently checked, clear them; else check all of them.
- **Returned payload**: the `values: string[]` sent on submit contains only the original options the user selected. "Select all" is never a member.

**Alternative considered**: add an actual "select all" sentinel to `options` before passing them to the renderer. Rejected because it leaks into the return payload and mixes UI concern with tool args.

### Decision 6: Tool-description footnote, ignore model violations

Append one sentence to the `ask_user` tool description: *"UI provides a Select all toggle; do not add one."* If a model still includes its own "Select all" row, both appear (their row is a real option that returns in values; ours is synthetic UI). Per scope decision, not worth defensive filtering.

### Decision 7: Auto-expand rule — failed `ask_user` collapses

One-line change in `ToolCallStep.tsx`:

```ts
const isFailedAskUser = isAskUser && status === "error";
useState(hasImages || isAgentRunning || (isAskUser && !isFailedAskUser));
```

Pending and completed `ask_user` still auto-expand (dialog / answer must be visible). Errored `ask_user` collapses; the red ❌ icon, summary, and click-to-expand remain.

**Alternative considered**: never auto-expand error state for *any* tool. Broader, probably right, but not in this change's scope.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| TUI `MultiSelectList` rendering/theme drift from pi-tui's `SelectList` look-and-feel | Use the same `Theme` object pi passes to the factory; reuse its scroll/truncation patterns. Visual polish is acceptable for a v1 polyfill. |
| Keybinding conflict between `space` and pi's reserved bindings | `space` is not in the pi-coding-agent reserved-keybindings allowlist (`app.interrupt`, `app.clear`, etc.); safe. |
| Very long option lists exceed viewport | Component needs scroll offset with a maxVisible window around the cursor. Matches pi-tui `SelectList`'s approach. |
| Dashboard "Select all" visual confusion if model *also* provides one | Documented in description. Both show; user chooses. Not a correctness bug. |
| Collapsed failed `ask_user` hides legitimate debugging info | Error is one click away; red ❌ icon still flags failure; net UX win over the current wall of red text. |
| Polyfill masks any future real `ctx.ui.multiselect` from pi | When pi adds one, delete the polyfill module and restore `ctx.ui.multiselect(...)`. Cheap reversal. |

## Migration Plan

Pure additive change within the dashboard repo. No data migrations, no breaking API changes.

1. Ship polyfill + tool edit in the bridge extension (reload required in active sessions).
2. Ship `MultiselectRenderer` "Select all" in the client (vite rebuild, browser refresh).
3. Ship `ToolCallStep` auto-expand tweak (same client rebuild).

Rollback: revert the three touched files and the two new files; restore the `as any` call. No persisted state is affected.

## Open Questions

None — scope fully locked during exploration. All alternatives were considered and explicitly deferred or rejected above.
