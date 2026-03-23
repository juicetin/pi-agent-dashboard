## 1. Setup

- [x] 1.1 Install `@mdi/js` and `@mdi/react` dependencies
- [x] 1.2 Verify imports work and build succeeds

## 2. Core Component Changes

- [x] 2.1 Update `CopyButton` — change `icon` prop from `string` to `ReactNode`, use `<Icon path={mdiCheck} />` for copied state
- [x] 2.2 Update `ToolCallStep` — replace `statusIcons` map with MDI icons (mdiLoading, mdiCheck), replace ▶/▼ with mdiChevronRight/mdiChevronDown
- [x] 2.3 Update `SessionSidebar` — replace `sourceIcons` map with MDI icons, replace ⚙ with mdiCog
- [x] 2.4 Update `SessionCard` — replace ⚡ current tool icon, update `editorIcons` map with MDI icons
- [x] 2.5 Update `CommandInput` — replace `sourceIcons` map with MDI icons
- [x] 2.6 Update `ExtensionUI` — replace ✅/❌/⏳ with MDI icons
- [x] 2.7 Update `MarkdownContent` — pass MDI icon components to CopyButton
- [x] 2.8 Update `ChatView` — pass MDI icon components to CopyButton

## 3. Tests

- [x] 3.1 Update `CopyButton.test` — adjust assertions for MDI icon rendering
- [x] 3.2 Update `MarkdownContent.test` — adjust assertions for MDI icon rendering
- [x] 3.3 Update `ChatView.test` — adjust assertions for MDI icon rendering
- [x] 3.4 Run full test suite and fix any remaining failures
