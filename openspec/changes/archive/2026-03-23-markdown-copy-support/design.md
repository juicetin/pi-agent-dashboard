## Context

The dashboard renders markdown via `react-markdown` in `MarkdownContent.tsx`. GFM tables don't render because the `remark-gfm` plugin is missing. There are no copy-to-clipboard features anywhere. The `ChatView` renders message bubbles with `MarkdownContent` inside them.

## Goals / Non-Goals

**Goals:**
- Render GFM tables properly
- Provide always-visible copy buttons on code blocks, tables, and messages
- Support format selection (markdown vs plain text for messages, markdown vs TSV for tables)
- Minimal ✓ feedback on copy

**Non-Goals:**
- Copy buttons on tool results or thinking blocks
- Rich text (HTML) clipboard format
- Customizable copy formats or user preferences
- Mobile-specific copy UX (standard touch-to-copy is sufficient)

## Decisions

### 1. Add `remark-gfm` plugin
**Decision**: Install `remark-gfm` and pass it to `ReactMarkdown` via the `remarkPlugins` prop.
**Rationale**: This is the standard approach recommended by `react-markdown` docs. It enables tables, strikethrough, autolinks, and task lists. No alternative — this is the only path for GFM support.

### 2. Reusable `CopyButton` component
**Decision**: Create a single `CopyButton` component that accepts `text`, `icon`, and `title` props. Uses `navigator.clipboard.writeText()`. Shows ✓ for 1.5s after click.
**Rationale**: DRY — the same copy-with-feedback pattern is used in three places (code blocks, tables, messages). A shared component keeps behavior consistent.

### 3. Copy button positioning
**Decision**: Copy buttons render inside a `relative` wrapper around the content. Buttons are `absolute` positioned top-right. Always visible (no hover-to-reveal).
**Rationale**: User explicitly requested always-visible. Absolute positioning keeps buttons out of content flow.

### 4. Table copy formats
**Decision**: Two buttons — 📋 copies the original markdown source, 📊 copies TSV (tab-separated values).
**Rationale**: Markdown is useful for pasting into other markdown contexts. TSV pastes cleanly into spreadsheets (Google Sheets, Excel). TSV chosen over CSV because commas appear in data more frequently than tabs.

**TSV extraction**: Parse the rendered `<table>` DOM element — iterate rows and cells, join cells with `\t`, join rows with `\n`. This avoids re-parsing the markdown source.

**Markdown source**: Extract the original markdown table from the `content` prop. The `table` component override receives children (the rendered table), but we need the source. Solution: pass the full markdown `content` string as React context, then extract the table substring by matching header text against the markdown source.

Alternative considered: Store a map of rendered tables to source markdown. Rejected — fragile with duplicate tables.

Simpler alternative: Since `react-markdown` renders tables from AST, we can use a remark plugin to annotate table nodes with their source positions, then pass that through. However, this adds complexity.

**Chosen approach**: Use `remarkGfm` with `rehypeRaw` isn't needed. Instead, create a custom component for `table` that reconstructs markdown from the DOM (iterate `<th>` and `<td>` to rebuild the `| col | col |` format). This is simple and always accurate for the rendered content.

### 5. Message copy formats
**Decision**: Two buttons — 📋 copies original markdown source, 📝 copies plain text (strip formatting).
**Rationale**: Messages already have access to the raw `content` string. Plain text extraction uses the rendered DOM's `innerText` property.

### 6. Code block copy
**Decision**: Single 📋 button, copies the raw code string (no fences, no language tag).
**Rationale**: Standard pattern used by GitHub, VS Code, etc. The code string is already available as the `children` prop in the custom `code` component.

## Risks / Trade-offs

- **[Table markdown reconstruction]** → Building markdown from DOM cells may not perfectly reproduce the original source formatting (alignment, extra spaces). Acceptable — the content is accurate even if whitespace differs.
- **[Visual clutter]** → Always-visible buttons on every code block, table, and message add visual noise. Mitigated by using small, muted icons that don't distract from content.
- **[Clipboard API availability]** → `navigator.clipboard.writeText()` requires secure context (HTTPS or localhost). Dashboard runs on localhost so this is fine. Falls back silently if unavailable.
