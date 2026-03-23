## Context

`ChatView.tsx` renders all message content as raw text inside `<p className="whitespace-pre-wrap">`. The chat-view spec already requires markdown rendering and syntax-highlighted code blocks, but they're not implemented. Messages from the assistant contain markdown (code blocks, headings, lists, bold/italic) which display as raw syntax.

## Goals / Non-Goals

**Goals:**
- Render markdown in user, assistant, and streaming messages
- Syntax-highlight fenced code blocks by language tag
- Avoid invalid HTML (no nested `<p>` elements)
- Keep the component reusable for any markdown text in the app

**Non-Goals:**
- Custom theme for syntax highlighter (use a built-in dark theme)
- Copy-to-clipboard button on code blocks (future enhancement)
- LaTeX/math rendering

## Decisions

### 1. Use `react-markdown` for markdown parsing
**Rationale**: Standard React library for rendering markdown. Handles streaming text gracefully (partial markdown won't crash). Tree-shakeable, well-maintained.
**Alternative**: `marked` + `dangerouslySetInnerHTML` — requires manual sanitization, less React-idiomatic.

### 2. Use `react-syntax-highlighter` with Prism for code blocks
**Rationale**: Works as a custom `code` component in react-markdown. Prism covers all common languages. Use `oneDark` theme to match the dark UI.
**Alternative**: `shiki` — more accurate highlighting but heavier and async, complicates streaming.

### 3. Replace outer `<p>` with `<div>` in ChatView
**Rationale**: `react-markdown` generates `<p>`, `<pre>`, `<ul>`, etc. internally. Wrapping in `<p>` creates invalid HTML (`<p>` cannot contain block elements) and breaks layout. A `<div>` with the same text styling is the fix.

### 4. Single `<MarkdownContent>` component
**Rationale**: DRY — used in three places (user msg, assistant msg, streaming text). Encapsulates react-markdown + syntax highlighter config. Takes a `content: string` prop.

## Risks / Trade-offs

- **Bundle size** → `react-markdown` ~30KB + `react-syntax-highlighter` ~40KB gzipped. Acceptable for a dashboard app. Can lazy-load Prism languages later if needed.
- **Streaming partial markdown** → react-markdown handles unclosed fences gracefully (renders as text until closed). No action needed.
- **CSS conflicts** → Markdown-generated elements (h1, ul, table) may inherit unexpected styles from Tailwind's reset. Mitigation: apply `prose` class from `@tailwindcss/typography` or add targeted styles in the component.
