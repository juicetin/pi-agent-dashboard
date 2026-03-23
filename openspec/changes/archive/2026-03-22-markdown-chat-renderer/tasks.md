## 1. Dependencies

- [x] 1.1 Install `react-markdown`, `react-syntax-highlighter`, and `@types/react-syntax-highlighter`

## 2. MarkdownContent Component

- [x] 2.1 Create `src/client/components/MarkdownContent.tsx` with react-markdown and custom code block renderer using react-syntax-highlighter (oneDark theme)
- [x] 2.2 Add basic styling for markdown elements (inline code background, code block container, list/heading spacing)
- [x] 2.3 Write tests for MarkdownContent rendering (plain text, code blocks, inline code, mixed content)

## 3. ChatView Integration

- [x] 3.1 Replace `<p>` wrappers with `<div>` + `<MarkdownContent>` for user messages, assistant messages, and streaming text in ChatView.tsx
- [x] 3.2 Verify no nested `<p>` elements in rendered output
