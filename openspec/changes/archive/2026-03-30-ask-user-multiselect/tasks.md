## 1. ask_user Tool Extension

- [x] 1.1 Add `multiselect` to the method enum in `.pi/extensions/ask-user.ts` and handle it in the `execute` switch (call `ctx.ui.select` with multiselect-like behavior or use input fallback, then return `{ values: string[] }`)
- [x] 1.2 Update the tool's `promptSnippet` and `promptGuidelines` to mention `multiselect` for multiple choices

## 2. UI Proxy Support

- [x] 2.1 Add `multiselect` case to `extractResult` in `src/extension/ui-proxy.ts` — return `result.values` (array) on resolve, `[]` on cancel
- [x] 2.2 Add `multiselect` method to `wrappedUi` in `src/extension/ui-proxy.ts` — forward to dashboard; for TUI fallback, call `ui.input` with numbered options prompt and parse comma-separated response into option strings

## 3. MultiselectRenderer Component

- [x] 3.1 Create `src/client/components/interactive-renderers/MultiselectRenderer.tsx` with checkbox rows, Submit, and Cancel buttons; resolved/cancelled compact states
- [x] 3.2 Register `MultiselectRenderer` for `"multiselect"` method in `src/client/components/interactive-renderers/registry.ts`

## 4. Tests

- [x] 4.1 Add unit tests for `extractResult` multiselect cases (resolved + cancelled)
- [x] 4.2 Add unit tests for TUI fallback parsing (comma-separated numbers → option strings)
- [x] 4.3 Add render tests for `MultiselectRenderer` (pending state, toggle + submit, cancel, resolved/cancelled display)
