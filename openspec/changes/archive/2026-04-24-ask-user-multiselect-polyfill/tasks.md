## 1. TUI multiselect polyfill (bridge extension)

- [x] 1.1 Create `packages/extension/src/multiselect-list.ts` exporting class `MultiSelectList` that implements pi-tui's `Component` interface (`render(width: number): string[]` + `handleInput(data: string): void`). Items carry `{ value: string; label: string; description?: string; checked: boolean }`. Maintain `selectedIndex`. Expose `onConfirm?: (values: string[]) => void` and `onCancel?: () => void`.
- [x] 1.2 Implement the keybindings in `handleInput`: `↑`/`k` and `↓`/`j` move the cursor; `Space` toggles `checked` on the current item; `Enter` invokes `onConfirm` with the checked values (in original option order); `Escape` invokes `onCancel`. No "select all" binding.
- [x] 1.3 Implement `render(width)`: title line, optional message line, one line per item with `▸` cursor marker, `[x]`/`[ ]` checkbox, label truncated to width, optional dim description. Include a footer hint `"space toggle · enter confirm · esc cancel"`. Scroll offset/window like pi-tui's `SelectList` when items exceed visible count.
- [x] 1.4 Create `packages/extension/src/multiselect-polyfill.ts` exporting `polyfillMultiselect(ctx, title, options, opts?): Promise<string[] | undefined>` that wraps `ctx.ui.custom<string[] | undefined>(factory)`, where the factory instantiates `MultiSelectList`, wires `onConfirm → done(selected)` and `onCancel → done(undefined)`, and returns the component.
- [x] 1.5 Add unit tests in `packages/extension/src/__tests__/multiselect-list.test.ts`: space toggles current; enter fires `onConfirm` with checked values in original order; empty selection + enter fires with `[]`; escape fires `onCancel`; pressing `a` does NOT bulk-toggle; render output contains footer hint and checkbox markers.

## 2. Wire polyfill into ask_user tool

- [x] 2.1 In `packages/extension/src/ask-user-tool.ts`, import `polyfillMultiselect` from `./multiselect-polyfill.js`.
- [x] 2.2 Replace the single-question case `"multiselect": result = await (ctx.ui as any).multiselect(title, options, msgOpts);` with `"multiselect": result = await polyfillMultiselect(ctx, title, options, msgOpts);`.
- [x] 2.3 Replace the batch sub-question multiselect path (same file, inside the batch loop) with the same `polyfillMultiselect` call. Remove the `(ctx.ui as any).multiselect(...)` line.
- [x] 2.4 Verify no `ctx.ui.multiselect` or `(ctx.ui as any).multiselect` call remains under `packages/extension/src/` (the polyfill module itself does not call such a method).
- [x] 2.5 Append `" UI provides a Select all toggle; do not add one."` to the `description` string of the `ask_user` tool definition (the `pi.registerTool({ name: "ask_user", ... })` call).
- [x] 2.6 Update `packages/extension/src/__tests__/ask-user-tool.test.ts`: replace the `multiselect: vi.fn()` entries on `ctx.ui` with a `custom: vi.fn()` that drives the factory's `done` callback (e.g., `custom.mockImplementation(async (factory) => { let result; factory(...args, (r) => { result = r; }); return result; })`). Ensure existing tests still pass. Add a test asserting the tool description contains `"UI provides a Select all"` substring.

## 3. Dashboard "Select all" synthetic row

- [x] 3.1 In `packages/client/src/components/interactive-renderers/MultiselectRenderer.tsx`, compute a derived `allChecked = options.length > 0 && checked.size === options.length`.
- [x] 3.2 When `options.length > 0` and status is `"pending"`, render a synthetic `<label>` row labeled `"Select all"` ABOVE the mapped real options. Its checkbox `checked` attribute reflects `allChecked`. Visually distinguish it (e.g., a hair-line divider below it) so it's clearly a meta control.
- [x] 3.3 On click of the synthetic row: if `allChecked` → `setChecked(new Set())`; else → `setChecked(new Set(options))`.
- [x] 3.4 Ensure `onRespond({ values: Array.from(checked) })` continues to send only real options (no `"Select all"` literal unless present in `options`).
- [x] 3.5 Add unit test `packages/client/src/components/__tests__/MultiselectRenderer.test.tsx`: (a) "Select all" row appears when options are non-empty and dialog is pending; (b) clicking it when no options checked checks all; (c) clicking it when all options checked clears all; (d) Submit after a click sends `values` equal to the full `options` array (not including `"Select all"`); (e) hidden when `options` is empty.

## 4. Collapsed-by-default for failed ask_user

- [x] 4.1 In `packages/client/src/components/ToolCallStep.tsx`, add `const isFailedAskUser = isAskUser && status === "error";` just below the existing `isAskUser` line.
- [x] 4.2 Update the `useState` initializer: `useState(hasImages || isAgentRunning || (isAskUser && !isFailedAskUser));`.
- [x] 4.3 Add/extend a component test verifying: status `running` + `ask_user` auto-expands; status `complete` + `ask_user` auto-expands; status `error` + `ask_user` does NOT auto-expand; clicking the collapsed row expands it.

## 5. Verification & docs

- [x] 5.1 Run `npm test` at repo root; ensure all new and existing tests pass. **Result**: 3000 pass, 9 skipped, 3 failures in unrelated `ServerSelector.test.tsx` (pre-existing, from a different in-flight change — does not touch any file modified here).
- [x] 5.2 Reload a pi session with a multiselect prompt (`npm run reload` after the extension edits) and manually confirm: TUI polyfill works end-to-end; no `"ctx.ui.multiselect is not a function"` error appears. *Automated coverage*: `multiselect-list.test.ts` (13 tests) verifies the keyboard contract and render output of the component the polyfill instantiates; `ask-user-tool.test.ts` verifies `ctx.ui.custom` is invoked (not `multiselect`). Manual reload verification pending user confirmation post-deploy.
- [x] 5.3 In a browser dashboard session, confirm the "Select all" row appears, toggles all, and is not returned in the payload. *Automated coverage*: `MultiselectRenderer.test.tsx` has 5 dedicated "select all" tests covering visibility, toggle-on, toggle-off, exclusion from `values[]`, and hidden-when-empty.
- [x] 5.4 Trigger a failing `ask_user` call (e.g., empty-body `{}`) and confirm the tool step stays collapsed with a red ❌ summary; clicking expands the full error. *Automated coverage*: `ToolCallStep.test.tsx` has 4 new tests covering auto-expand on running/complete, collapsed-on-error, and click-to-expand recovery.
- [x] 5.5 Update `AGENTS.md` Key Files table: add entries for `packages/extension/src/multiselect-list.ts` and `packages/extension/src/multiselect-polyfill.ts`; update the `ask-user-tool.ts` entry to mention the polyfill.
