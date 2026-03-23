## MODIFIED Requirements

### Requirement: Markdown text rendering
The MarkdownContent component SHALL accept a `content` string prop, pre-process it with `wrapAsciiTables` to ensure ASCII/box-drawing tables render in monospace, then render the result as formatted HTML using react-markdown with the `remark-gfm` plugin enabled. Supported elements SHALL include: paragraphs, headings, bold, italic, strikethrough, lists (ordered and unordered), links, inline code, fenced code blocks, GFM tables, task lists, autolinks, and blockquotes.

#### Scenario: ASCII table in content
- **WHEN** the content contains box-drawing table characters
- **THEN** the component SHALL render them in a monospace code block with columns properly aligned

#### Scenario: Mixed ASCII table and markdown
- **WHEN** the content contains both an ASCII table and regular markdown
- **THEN** the ASCII table SHALL render monospaced and the markdown SHALL render normally
