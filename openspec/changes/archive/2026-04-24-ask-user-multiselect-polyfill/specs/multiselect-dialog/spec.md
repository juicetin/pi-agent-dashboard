## ADDED Requirements

### Requirement: TUI polyfill via `ctx.ui.custom<T>()`

The dashboard bridge extension SHALL provide a `polyfillMultiselect(ctx, title, options, opts)` helper that returns a `Promise<string[] | undefined>`. The helper SHALL be implemented by calling `ctx.ui.custom<string[] | undefined>(factory)` where `factory` constructs a `MultiSelectList` component. The helper SHALL NOT call `ctx.ui.multiselect` directly. The helper SHALL be used for every dispatch of the `multiselect` method in the `ask_user` tool (single and batch).

#### Scenario: Polyfill uses custom

- **WHEN** `polyfillMultiselect` is called
- **THEN** it SHALL invoke `ctx.ui.custom` with a factory function

#### Scenario: Factory resolves with selected values

- **WHEN** the inner `MultiSelectList` emits `onConfirm(selected)`
- **THEN** the factory SHALL invoke `done(selected)` and the polyfill's promise SHALL resolve to `selected`

#### Scenario: Factory resolves with undefined on cancel

- **WHEN** the inner `MultiSelectList` emits `onCancel()`
- **THEN** the factory SHALL invoke `done(undefined)` and the polyfill's promise SHALL resolve to `undefined`

### Requirement: MultiSelectList TUI component keybindings

The `MultiSelectList` component SHALL implement the `Component` interface from `pi-tui` (`render(width): string[]` and `handleInput(data: string): void`). It SHALL support the following keyboard contract and no other "select all" binding:

- `ArrowUp` / `ArrowDown` (or `k` / `j`): move the cursor among items.
- `Space`: toggle the checked state of the current item.
- `Enter`: confirm — invoke `onConfirm(selected: string[])`, where `selected` contains the values of currently checked items in original option order.
- `Escape`: cancel — invoke `onCancel()`.

The component SHALL NOT bind any "select all" key in the TUI.

#### Scenario: Space toggles current item

- **WHEN** the cursor is on item `i` and `Space` is pressed
- **THEN** the checked state of item `i` SHALL flip; no other items change

#### Scenario: Enter with no items checked confirms empty

- **WHEN** no items are checked and `Enter` is pressed
- **THEN** `onConfirm` SHALL fire with `[]`

#### Scenario: Escape cancels

- **WHEN** `Escape` is pressed at any point
- **THEN** `onCancel` SHALL fire and no `onConfirm` SHALL fire

#### Scenario: No "select all" keybinding in TUI

- **WHEN** any single printable key (including `a`) is pressed other than space
- **THEN** the component SHALL NOT perform a bulk check/uncheck action

### Requirement: Dashboard "Select all" synthetic row

`MultiselectRenderer.tsx` SHALL prepend a synthetic checkbox row labeled "Select all" above the real options when the dialog is pending. The row SHALL be UI-only and SHALL NOT appear in the returned `values[]` payload.

#### Scenario: Synthetic row shown in pending state

- **WHEN** a multiselect dialog is pending with `options.length > 0`
- **THEN** the renderer SHALL display a "Select all" checkbox row ABOVE the real option rows

#### Scenario: Derived checked state

- **WHEN** the count of checked real options equals `options.length` and `options.length > 0`
- **THEN** the "Select all" checkbox SHALL render as checked

#### Scenario: Click toggles all options

- **WHEN** the user clicks the "Select all" row while it is currently unchecked
- **THEN** all real options SHALL be checked

#### Scenario: Click clears all options when all checked

- **WHEN** the user clicks the "Select all" row while all real options are currently checked
- **THEN** all real options SHALL be unchecked

#### Scenario: "Select all" not in returned values

- **WHEN** the user clicks Submit after using the "Select all" toggle
- **THEN** `onRespond` SHALL be called with `{ values: <only the original option strings that are checked> }` and the returned array SHALL NOT contain the literal string `"Select all"` unless it was also present in the original `options` input

#### Scenario: Empty options hides the synthetic row

- **WHEN** `options.length === 0`
- **THEN** the renderer SHALL NOT show a "Select all" row
