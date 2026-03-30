## 1. Inline Markdown Component

- [x] 1.1 Create `InlineMarkdown` component in `src/client/components/interactive-renderers/InlineMarkdown.tsx` using `ReactMarkdown` with `allowedElements` restricted to `strong`, `em`, `code`, `a` and `unwrapDisallowed` set to `true`
- [x] 1.2 Add tests for `InlineMarkdown` verifying bold, code, and block-element stripping

## 2. Markdown in Interactive Renderers

- [x] 2.1 Update `ConfirmRenderer` to use `MarkdownContent` for message in pending state and `InlineMarkdown` for title in both pending and resolved states
- [x] 2.2 Update `SelectRenderer` to use `InlineMarkdown` for title in both pending and resolved states
- [x] 2.3 Update `InputRenderer` to use `InlineMarkdown` for title in both pending and resolved states
- [x] 2.4 Update `MultiselectRenderer` to use `InlineMarkdown` for title in both pending and resolved states

## 3. Bridge ask_user Registration

- [x] 3.1 Add `ask_user` tool registration in `src/extension/bridge.ts` with `PI_DASHBOARD_SPAWNED`-aware collision logic: always register when dashboard-spawned, check `pi.getAllTools()` when user-launched
- [x] 3.2 Add tests for collision logic (dashboard-spawned overrides, user-launched skips if exists, user-launched registers if absent)

## 4. Cleanup

- [x] 4.1 Remove `.pi/extensions/ask-user.ts`
- [x] 4.2 Update AGENTS.md key files table (remove ask-user.ts entry, note ask_user is in bridge)
