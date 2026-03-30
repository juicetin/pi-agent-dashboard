## Context

The `ask_user` tool supports `confirm`, `select`, and `input` methods. The `select` method allows picking exactly one option. The UI proxy forwards dialog requests from the bridge extension to the dashboard server and then to the browser. The protocol uses a generic `method: string` field, so adding new methods requires no protocol schema changes.

Pi's native TUI has no built-in multiselect dialog — only `confirm`, `select`, and `input` are available on `ctx.ui`.

## Goals / Non-Goals

**Goals:**
- Add a `multiselect` method that lets the LLM present a list of options where the user can select zero or more
- Return an array of selected option strings
- Provide a checkbox-style renderer in the dashboard UI
- Support TUI fallback for non-headless sessions

**Non-Goals:**
- Min/max selection constraints (keep it simple — the LLM can validate in follow-up)
- Grouped or hierarchical options
- Search/filter within options

## Decisions

### 1. New method name: `multiselect`
Add `multiselect` to the method enum in the `ask_user` tool. Params: `{ title, options }` (same shape as `select`). Result: `{ values: string[] }` (array instead of single value).

**Rationale**: Consistent naming with `select`. Using `values` (plural) in the result distinguishes it clearly from `select`'s `{ value: string }`.

### 2. MultiselectRenderer with checkboxes + submit
A new `MultiselectRenderer.tsx` component renders each option as a toggleable checkbox row. A "Submit" button confirms the selection. The user can select zero or more options before submitting.

**Rationale**: Checkbox UX is the standard pattern for multi-selection. A submit button is needed because unlike single-select, clicking an option shouldn't immediately resolve.

### 3. TUI fallback via `ctx.ui.input`
For TUI sessions, the multiselect proxy will call `ctx.ui.input` with a prompt listing the options numbered, asking the user to type comma-separated numbers. The proxy parses the response into the selected option strings.

**Alternative considered**: Loop with multiple `select` calls — rejected because it's awkward (need a "done" sentinel option) and blocks on each pick.

**Rationale**: Input with comma-separated numbers is a familiar terminal pattern and requires only one interaction.

### 4. No protocol changes needed
`ExtensionUiRequestMessage.method` is already `string`, and `params`/`result` are `Record<string, unknown>`. The new method flows through the existing pipeline without any wire format changes.

## Risks / Trade-offs

- [No native TUI multiselect] → Mitigated by input fallback with numbered options. Slightly less polished than a native picker but functional.
- [Zero selections allowed] → The LLM can instruct "select at least one" in the title and validate the response. Keeping the UI simple avoids over-engineering.
