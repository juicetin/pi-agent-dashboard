## Why

Markdown content in the dashboard frequently contains Mermaid diagram code blocks (e.g., flowcharts, sequence diagrams, state machines). These currently render as plain code text, losing the visual value. Adding Mermaid rendering turns these into interactive SVG diagrams directly in the chat and markdown preview views.

## What Changes

- Add a `MermaidBlock` component that lazy-loads the `mermaid` library and renders diagram code as SVG
- Extend the `MarkdownContent` code block handler to detect `language-mermaid` and render via `MermaidBlock` instead of syntax highlighting
- Add the `mermaid` npm dependency
- Diagrams respect the current dashboard theme (dark/light)
- Invalid Mermaid syntax falls back to displaying raw code with an error message

## Capabilities

### New Capabilities
- `mermaid-diagram`: Rendering of Mermaid diagram code blocks as SVG within markdown content

### Modified Capabilities
- `markdown-rendering`: Code blocks with language `mermaid` are rendered as SVG diagrams instead of syntax-highlighted text

## Impact

- **Code**: `MarkdownContent.tsx` (add mermaid branch), new `MermaidBlock.tsx` component
- **Dependencies**: New `mermaid` npm package (lazy-loaded to avoid bundle impact)
- **Bundle**: No impact on initial load (dynamic import); ~800KB loaded on-demand when first mermaid block appears
