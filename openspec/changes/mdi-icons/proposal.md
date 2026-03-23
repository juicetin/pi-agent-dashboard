## Why

The web client uses emoji characters (📋, ⏳, ✅, ❌, etc.) as icons throughout all components. Emojis render inconsistently across platforms and browsers, look unprofessional, and cannot be styled (color, size) with CSS. Replacing them with Material Design Icons (MDI) via `@mdi/js` + `@mdi/react` provides consistent, scalable, styleable SVG icons.

## What Changes

- Add `@mdi/js` and `@mdi/react` as dependencies
- Replace all emoji/text icons in 8 component files with MDI SVG icon components
- Change `CopyButton.icon` prop from `string` (emoji) to `ReactNode` (JSX element)
- Convert icon lookup maps (`statusIcons`, `sourceIcons`, `editorIcons`) from `Record<string, string>` to `Record<string, ReactNode>`
- Update 3 test files to match new icon rendering

## Capabilities

### New Capabilities

- `mdi-icon-system`: Standard icon system using `@mdi/js` + `@mdi/react` for consistent SVG icons across all client components

### Modified Capabilities

_None — this is a visual/implementation change only; no spec-level behavior changes._

## Impact

- **Dependencies**: New packages `@mdi/js`, `@mdi/react`
- **Components affected**: `CopyButton`, `MarkdownContent`, `ChatView`, `ToolCallStep`, `SessionSidebar`, `SessionCard`, `CommandInput`, `ExtensionUI`
- **Tests affected**: `CopyButton.test`, `MarkdownContent.test`, `ChatView.test`
- **Bundle size**: ~25KB added (tree-shaken, only used icons bundled)
- **No API or protocol changes**
