/**
 * Polyfill for `ctx.ui.multiselect(...)` — a method the dashboard bridge's
 * `ask_user` tool advertises but which `pi-coding-agent`'s
 * `ExtensionUIContext` does not expose. Without this, any TUI dispatch of
 * `method: "multiselect"` crashes with `"ctx.ui.multiselect is not a function"`.
 *
 * Implementation strategy: always delegate to the already-exposed
 * `ctx.ui.custom<T>()` primitive, which takes a factory that returns a
 * focused pi-tui `Component`. We instantiate a `MultiSelectList`, wire
 * `onConfirm` → `done(selected)` and `onCancel` → `done(undefined)`, and
 * return the component.
 *
 * The result contract matches what the current (broken) call expects:
 *   - resolves to `string[]` when the user confirms a selection
 *     (possibly empty if nothing is checked)
 *   - resolves to `undefined` when the user cancels (Escape)
 */
import { MultiSelectList } from "./multiselect-list.js";

// Intentionally loose: `ctx` shape varies slightly across pi versions; the
// polyfill only needs `ctx.ui.custom`.
export interface PolyfillCtx {
  ui: {
    custom<T>(
      factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown,
      options?: unknown,
    ): Promise<T>;
  };
}

export function polyfillMultiselect(
  ctx: PolyfillCtx,
  title: string,
  options: string[],
  opts?: { message?: string },
): Promise<string[] | undefined> {
  return ctx.ui.custom<string[] | undefined>((_tui, _theme, _keybindings, done) => {
    const list = new MultiSelectList(title, options, opts?.message);
    list.onConfirm = (selected) => done(selected);
    list.onCancel = () => done(undefined);
    return list as unknown;
  });
}
