## 1. GFM Table Rendering

- [x] 1.1 Install `remark-gfm` dependency
- [x] 1.2 Add `remarkGfm` plugin to `ReactMarkdown` in `MarkdownContent.tsx`
- [x] 1.3 Add test: GFM table renders as `<table>` HTML element

## 2. CopyButton Component

- [x] 2.1 Create `src/client/components/CopyButton.tsx` — accepts `text`, `icon`, `title` props; copies to clipboard on click; shows ✓ for 1.5s
- [x] 2.2 Add tests: renders icon, copies text on click, shows ✓ feedback, handles missing clipboard API

## 3. Code Block Copy

- [x] 3.1 Wrap fenced code blocks in a relative container with a CopyButton (📋) positioned top-right in `MarkdownContent.tsx`
- [x] 3.2 Ensure inline code does not get a copy button
- [x] 3.3 Add test: fenced code block renders with copy button, inline code does not

## 4. Table Copy

- [x] 4.1 Add custom `table` component override in `MarkdownContent.tsx` that wraps rendered tables in a relative container with two CopyButtons (📋 markdown, 📊 TSV)
- [x] 4.2 Implement `tableToMarkdown` utility — reconstruct markdown from table DOM element (iterate th/td cells)
- [x] 4.3 Implement `tableToTsv` utility — extract tab-separated values from table DOM element
- [x] 4.4 Add tests: table renders with both copy buttons, markdown and TSV output is correct

## 5. Message Copy

- [x] 5.1 Add copy icon bar (📋 markdown, 📝 plain text) to each message bubble in `ChatView.tsx`
- [x] 5.2 For markdown copy, pass the raw `content` string to CopyButton
- [x] 5.3 For plain text copy, extract `innerText` from the rendered message DOM via a ref
- [x] 5.4 Add test: message bubbles render with copy buttons
