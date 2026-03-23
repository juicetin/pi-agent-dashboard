## Why

LLMs frequently produce ASCII/box-drawing tables (using `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼` or `+ - |` characters) that rely on fixed-width character alignment. The dashboard renders message content in a proportional font, causing these tables' columns to drift out of alignment and become unreadable.

## What Changes

- Add a pre-processor function that detects blocks of text containing box-drawing or ASCII table characters and wraps them in fenced code blocks before passing to the markdown renderer
- This ensures they render in a monospace font where column alignment is preserved

## Capabilities

### New Capabilities
- `ascii-table-detection`: Heuristic detection and monospace wrapping of ASCII/box-drawing table blocks in markdown content

### Modified Capabilities
- `markdown-rendering`: Integrate the ASCII table pre-processor before ReactMarkdown parsing

## Impact

- **Files**: New utility function + integration in `MarkdownContent.tsx`
- **No API/protocol changes** — client-side only
- **No breaking changes** — only affects rendering of box-drawing content
