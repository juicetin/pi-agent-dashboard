## MODIFIED Requirements

### Requirement: Markdown text rendering
The MarkdownContent component SHALL accept a `content` string prop, pre-process it with `wrapAsciiTables` to ensure ASCII/box-drawing tables render in monospace, then render the result as formatted HTML using react-markdown with the `remark-gfm` plugin enabled and the `remark-math` plugin enabled. The rehype plugin chain SHALL be ordered `[rehypeRaw, rehypeKatex, stripReactRefAttributes]`. Supported elements SHALL include: paragraphs, headings, bold, italic, strikethrough, lists (ordered and unordered), links, inline code, fenced code blocks, GFM tables, task lists, autolinks, blockquotes, Mermaid diagrams, LaTeX math expressions (inline `$…$` and display `$$…$$`), and image references. Fenced code blocks with syntax highlighting SHALL use `var(--bg-code)` as their background color. Image references whose `src` begins with `pi-asset:<hash>` SHALL be resolved against the current `SessionAssetsContext` map and rendered as `<img src="data:<mimeType>;base64,<data>">`; image references with any other scheme (`data:`, `http(s):`, `blob:`, fragment, or relative) SHALL render via the default ReactMarkdown `<img>` with the original `src` unchanged.

#### Scenario: ASCII table in content
- **WHEN** the content contains box-drawing table characters
- **THEN** the component SHALL render them in a monospace code block with columns properly aligned

#### Scenario: Mixed ASCII table and markdown
- **WHEN** the content contains both an ASCII table and regular markdown
- **THEN** the ASCII table SHALL render monospaced and the markdown SHALL render normally

#### Scenario: Plain text content
- **WHEN** the content contains no markdown syntax
- **THEN** the component SHALL render it as a paragraph

#### Scenario: Fenced code block
- **WHEN** the content contains a fenced code block with a language tag (other than `mermaid`)
- **THEN** the component SHALL render the code block with syntax highlighting using react-syntax-highlighter with the appropriate language, using `var(--bg-code)` as the background

#### Scenario: Fenced code block without language
- **WHEN** the content contains a fenced code block without a language tag
- **THEN** the component SHALL render the code block with monospace font and `var(--bg-code)` background without syntax highlighting

#### Scenario: Inline code
- **WHEN** the content contains inline code (backtick-wrapped)
- **THEN** the component SHALL render it with monospace font and a subtle background

#### Scenario: Mixed markdown content
- **WHEN** the content contains headings, lists, bold, and code blocks
- **THEN** all elements SHALL be rendered with appropriate HTML elements and styling

#### Scenario: GFM table
- **WHEN** the content contains a GFM pipe-delimited table
- **THEN** the component SHALL render it as an HTML table with borders, padding, and header styling

#### Scenario: Mermaid code block
- **WHEN** the content contains a fenced code block with language `mermaid`
- **THEN** the component SHALL render it using the MermaidBlock component as an SVG diagram instead of syntax-highlighted text

#### Scenario: LaTeX math expression
- **WHEN** the content contains an inline `$…$` or display `$$…$$` math expression
- **THEN** the component SHALL render it as a KaTeX-typeset HTML node, not as literal dollar-bracketed text

#### Scenario: pi-asset image reference resolves from session map
- **WHEN** the content contains `![alt](pi-asset:abc)` and the active `SessionAssetsContext` map contains `"abc": { data, mimeType }`
- **THEN** the rendered `<img>` SHALL have `src="data:<mimeType>;base64,<data>"` and the original `alt` text

#### Scenario: External URL image reference unchanged
- **WHEN** the content contains `![logo](https://example.com/logo.png)`
- **THEN** the rendered `<img>` SHALL have `src="https://example.com/logo.png"` exactly as today's default ReactMarkdown behavior
