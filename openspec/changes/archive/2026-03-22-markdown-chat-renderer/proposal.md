## Why

Chat messages (user and assistant) currently render as raw text via `<p className="whitespace-pre-wrap">`. When the assistant sends markdown (code blocks, headings, lists, bold), it appears as raw syntax. Code blocks need monospace rendering with syntax highlighting.

## What Changes

- Add `react-markdown` and `react-syntax-highlighter` as dependencies
- Create a reusable `<MarkdownContent>` component that renders markdown with syntax-highlighted code blocks
- Replace raw `<p>` text wrappers in `ChatView.tsx` with `<MarkdownContent>` for user messages, assistant messages, and streaming text
- Replace outer `<p>` tags with `<div>` to avoid invalid nested `<p>` elements (react-markdown generates `<p>` tags internally)

## Capabilities

### New Capabilities
- `markdown-rendering`: Reusable markdown rendering component with syntax highlighting for chat messages

### Modified Capabilities
- `chat-view`: Implementing the existing "Markdown rendering" and "Syntax-highlighted code blocks" requirements that are already specified but not yet implemented

## Impact

- **Dependencies**: New npm packages `react-markdown`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`
- **Code**: `src/client/components/ChatView.tsx` — replace `<p>` wrappers with `<MarkdownContent>`
- **Code**: New `src/client/components/MarkdownContent.tsx`
- **DOM**: Output changes from plain text to rendered HTML — existing CSS may need minor adjustments for markdown elements (headings, lists, tables, etc.)
