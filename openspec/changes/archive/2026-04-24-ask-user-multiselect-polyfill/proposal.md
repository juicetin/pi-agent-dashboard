## Why

The `ask_user` tool advertises a `multiselect` method in its schema but crashes at runtime with `"ctx.ui.multiselect is not a function"` because the host `ExtensionUIContext` in `pi-coding-agent` has no `multiselect` method (only `select`, `confirm`, `input`, `custom`). The dashboard's bridge extension calls `(ctx.ui as any).multiselect(...)` — an `as any` cast that hides a real contract gap. Every TUI (or adapterless) `ask_user` call with `method: "multiselect"` throws, and because `ToolCallStep` auto-expands every `ask_user` call (including failed ones), the full validation/runtime error dumps into the dashboard chat as a wall of red text. This is jarring and it trains agents to believe `multiselect` is unusable.

## What Changes

- Add a dashboard-side polyfill for `ctx.ui.multiselect` built on top of pi's existing `ctx.ui.custom<T>()` primitive. Always use the polyfill — no conditional branching based on UI availability. The polyfill instantiates a new `MultiSelectList` TUI component with standard keyboard navigation (`↑↓`, `space`, `enter`, `esc`). No "select all" binding in the TUI.
- Remove the `(ctx.ui as any).multiselect(...)` call in `packages/extension/src/ask-user-tool.ts`; replace with a call to the polyfill. The one other call site (inside the `batch` sub-question loop) uses the same polyfill.
- Add a browser-side synthetic "Select all" row to `MultiselectRenderer.tsx`. The row is UI-only: its checked state is derived from whether every real option is checked; toggling it checks-all or clears-all in the local state; it is never returned in the `values[]` payload.
- Append a short footnote to the `ask_user` tool description: *"UI provides a Select all toggle; do not add one."* Agents that still add their own "Select all" option are ignored (out of scope).
- Change `ToolCallStep` so failed `ask_user` calls are **not** auto-expanded. Pending/in-progress/completed `ask_user` calls continue to auto-expand as today. The collapsed failure row still shows the red ❌ icon and summary; the raw error is one click away.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ask-user-tool`: Runtime behavior of the `multiselect` method gains a polyfill-based implementation; tool description adds a "do not add Select all" instruction.
- `multiselect-dialog`: Tightens what the TUI polyfill provides (MultiSelectList component with defined keybindings) and specifies the dashboard "Select all" synthetic row contract.
- `agent-tool-rendering`: Adds a requirement that failed `ask_user` calls do not auto-expand in `ToolCallStep`.

## Impact

- **Code**:
  - `packages/extension/src/ask-user-tool.ts` — replace `as any` call; update tool description.
  - `packages/extension/src/multiselect-polyfill.ts` — **new**, thin wrapper around `ctx.ui.custom`.
  - `packages/extension/src/multiselect-list.ts` — **new**, `Component` implementation with render + handleInput.
  - `packages/client/src/components/interactive-renderers/MultiselectRenderer.tsx` — add synthetic "Select all" row and toggle logic.
  - `packages/client/src/components/ToolCallStep.tsx` — single-line change to default-expanded computation.
- **Tests**:
  - `packages/extension/src/__tests__/ask-user-tool.test.ts` — replace `ctx.ui.multiselect` mock with `ctx.ui.custom` mock that drives the polyfill's `done(...)` callback.
  - New unit test for `MultiSelectList.handleInput` (keyboard contract).
  - New test for `MultiselectRenderer` "Select all" behavior (toggling, derived state, absent from returned values).
- **Dependencies**: No new runtime dependencies. Uses `ctx.ui.custom<T>()` already exposed by `ExtensionUIContext`.
- **Breaking**: None. The polyfill preserves the same signature the tool was *pretending* to call; the dashboard renderer's returned payload shape is unchanged.
- **Out of scope**: Reshaping `ask_user` to match Claude Code's `AskUserQuestion` schema; upstreaming `multiselect` to `pi-coding-agent`; enabling `NATIVE_ALIASES["ask_user"] = "AskUserQuestion"` in `pi-anthropic-messages`; handling sub-multiselect inside batch specially; typed "no UI available" error fallback.
