## ADDED Requirements

### Requirement: ask_user tool description instructs agents not to add "Select all"

The `ask_user` tool description SHALL include a one-sentence footnote instructing agents not to add a "Select all" (or equivalent) option to `options` when using `method: "multiselect"`, because the dashboard UI provides one automatically.

#### Scenario: Tool description contains the footnote

- **WHEN** the `ask_user` tool is registered via `pi.registerTool(...)`
- **THEN** the `description` field SHALL contain the substring `"UI provides a Select all toggle"` (or equivalent wording conveying "the UI provides it; do not add one")

### Requirement: multiselect invocation uses the dashboard polyfill

The `ask_user` tool SHALL invoke the `multiselect` method through a dashboard-provided polyfill that does not call `ctx.ui.multiselect` directly, because `ExtensionUIContext` in `pi-coding-agent` does not expose a `multiselect` method. The polyfill SHALL be used unconditionally for every `multiselect` dispatch, including sub-questions inside a `batch` call. The polyfill SHALL return `string[]` when the user confirms a selection (possibly empty), and `undefined` when the user cancels.

#### Scenario: Single multiselect call uses the polyfill

- **WHEN** the tool is executed with `{ method: "multiselect", title: "Pick", options: ["A","B"] }`
- **THEN** the tool SHALL call `polyfillMultiselect(ctx, title, options, msgOpts)` instead of `(ctx.ui as any).multiselect(...)`

#### Scenario: Batch sub-question multiselect uses the polyfill

- **WHEN** a `batch` call contains a sub-question with `method: "multiselect"`
- **THEN** the batch loop SHALL dispatch that sub-question through the same `polyfillMultiselect` function

#### Scenario: No direct `ctx.ui.multiselect` call remains

- **WHEN** the repository is searched for `ctx.ui.multiselect` or `(ctx.ui as any).multiselect`
- **THEN** no call site SHALL remain in `packages/extension/src/` (except inside the polyfill module itself, which does not actually call a `multiselect` method on `ctx.ui`)
