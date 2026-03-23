## ADDED Requirements

### Requirement: Markdown text rendering
The MarkdownContent component SHALL accept a `content` string prop and render it as formatted HTML using react-markdown. Supported elements SHALL include: paragraphs, headings, bold, italic, lists (ordered and unordered), links, inline code, fenced code blocks, tables, and blockquotes.

#### Scenario: Plain text content
- **WHEN** the content contains no markdown syntax
- **THEN** the component SHALL render it as a paragraph

#### Scenario: Fenced code block
- **WHEN** the content contains a fenced code block with a language tag
- **THEN** the component SHALL render the code block with syntax highlighting using react-syntax-highlighter with the appropriate language

#### Scenario: Fenced code block without language
- **WHEN** the content contains a fenced code block without a language tag
- **THEN** the component SHALL render the code block with monospace font and dark background without syntax highlighting

#### Scenario: Inline code
- **WHEN** the content contains inline code (backtick-wrapped)
- **THEN** the component SHALL render it with monospace font and a subtle background

#### Scenario: Mixed markdown content
- **WHEN** the content contains headings, lists, bold, and code blocks
- **THEN** all elements SHALL be rendered with appropriate HTML elements and styling
