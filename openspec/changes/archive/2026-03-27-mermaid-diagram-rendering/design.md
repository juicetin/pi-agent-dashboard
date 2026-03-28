## Context

The `MarkdownContent` component renders markdown via `react-markdown` with `remark-gfm`. Code blocks with a language tag are routed to `react-syntax-highlighter`. Mermaid diagram blocks (```` ```mermaid ````) currently render as syntax-highlighted text, losing their visual value.

## Goals / Non-Goals

**Goals:**
- Render Mermaid code blocks as SVG diagrams inline in markdown
- Zero impact on initial bundle size (lazy-load mermaid library)
- Graceful degradation on invalid syntax (show raw code + error)
- Theme-aware diagrams (dark/light)

**Non-Goals:**
- Interactive/editable diagrams
- Server-side rendering of Mermaid
- Supporting other diagram languages (PlantUML, etc.)

## Decisions

### Decision 1: Lazy-load mermaid via dynamic import

**Choice**: `const mermaid = (await import('mermaid')).default` on first encounter of a mermaid block.

**Alternatives considered**:
- Static import: Adds ~800KB to initial bundle for a feature most page loads won't use. Rejected.
- External service/CDN: Adds network dependency, latency, privacy concerns. Rejected.

**Rationale**: The mermaid library is large. Dynamic import keeps the initial bundle unchanged and loads the library only when needed. A loading placeholder is shown during the import.

### Decision 2: New MermaidBlock component

**Choice**: A self-contained `MermaidBlock` component that receives the diagram code string, calls `mermaid.render()`, and displays the resulting SVG.

**Details**:
- Uses `mermaid.render(id, code)` which returns `{ svg: string }`
- SVG is set via `dangerouslySetInnerHTML` (mermaid output is trusted library-generated SVG)
- Unique IDs generated via React `useId()` with counter suffix for multiple diagrams
- Component handles its own loading/error states

### Decision 3: Integration point in MarkdownContent code handler

**Choice**: Add a branch in the existing `code` component handler: when `match[1] === 'mermaid'`, render `<MermaidBlock>` instead of `<SyntaxHighlighter>`.

**Rationale**: Minimal change — one conditional branch in the existing code path. No changes to the ReactMarkdown pipeline or plugins needed.

### Decision 4: Theme mapping

**Choice**: Map dashboard theme to mermaid's built-in `theme` option using `useThemeContext()`. Dark themes → `'dark'`, light themes → `'default'`.

**Rationale**: Mermaid has built-in theme support. Simple mapping avoids custom CSS. Re-initialize mermaid config when theme changes.

## Risks / Trade-offs

- **[Large dependency]** → Mitigated by lazy loading; only loaded when a mermaid block appears
- **[Render is async + side-effecty]** → Mitigated by handling unmount during render (abort/ignore stale results via useEffect cleanup)
- **[Unique ID collisions]** → Mitigated by `useId()` + counter pattern
- **[Theme mismatch on fast toggle]** → Mitigated by re-rendering on theme change; acceptable flash during re-render
