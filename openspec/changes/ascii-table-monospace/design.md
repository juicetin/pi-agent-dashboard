## Context

LLM outputs frequently contain ASCII art tables using box-drawing characters (e.g. `┌─┬─┐`, `│`, `├─┼─┤`) or plain ASCII (`+--+--+`, `|`). These rely on monospace font alignment. The dashboard's `MarkdownContent` component renders in a proportional font, breaking alignment.

## Goals / Non-Goals

**Goals:**
- Detect ASCII/box-drawing table blocks in markdown content
- Wrap them in fenced code blocks so they render monospaced
- Handle edge cases: don't double-wrap content already inside code fences

**Non-Goals:**
- Don't parse or restructure the ASCII tables — just ensure monospace rendering
- Don't handle every possible ASCII art — focus on table patterns

## Decisions

### 1. Pre-processor approach
**Decision**: Create a pure function `wrapAsciiTables(content: string): string` that scans the raw markdown string and wraps detected ASCII table blocks in triple-backtick fences. Called before passing content to `ReactMarkdown`.

**Rationale**: Pre-processing is simpler than custom remark plugins or post-DOM manipulation. A pure string→string function is easy to test.

**Alternative considered**: CSS `font-family: monospace` on detected elements post-render — rejected because ReactMarkdown renders these as plain paragraphs, losing whitespace.

### 2. Detection heuristic
**Decision**: A line is considered an ASCII table line if it contains 2+ box-drawing characters (`─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋═║╔╗╚╝╠╣╦╩╬`) OR matches the pattern of a plain ASCII table line (`+---+` or `|...|` with at least 2 pipes). A block of 2+ consecutive such lines is wrapped.

**Rationale**: Requiring 2+ box-drawing chars per line avoids false positives on single decorative characters. Requiring 2+ consecutive lines avoids wrapping standalone dividers.

### 3. Skip existing code fences
**Decision**: Track whether we're inside a fenced code block (``` or ~~~). Lines inside fences are never processed.

**Rationale**: Avoids double-wrapping content that's already correctly rendered as code.

## Risks / Trade-offs

- **False positives**: Lines with `|` characters (like markdown tables) could be misdetected. Mitigation: require box-drawing chars OR the `+---+` pattern specifically, not bare pipes alone (markdown tables are already handled by remarkGfm).
- **False negatives**: Unusual ASCII table styles might not be detected. Acceptable — we cover the common patterns.
