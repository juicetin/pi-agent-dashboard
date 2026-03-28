## 1. Dependencies

- [x] 1.1 Add `mermaid` npm package to dependencies

## 2. MermaidBlock Component

- [x] 2.1 Write tests for MermaidBlock: valid diagram renders SVG, loading state, invalid syntax shows error with raw code, unique IDs for multiple instances, theme mapping (dark/light)
- [x] 2.2 Create `MermaidBlock.tsx` component with lazy-load via dynamic import, `mermaid.render()`, loading placeholder, error fallback, useEffect cleanup for unmount safety
- [x] 2.3 Add theme integration: read `useThemeContext()`, map to mermaid theme config, re-render on theme change

## 3. MarkdownContent Integration

- [x] 3.1 Write test for MarkdownContent: mermaid code block renders MermaidBlock instead of SyntaxHighlighter
- [x] 3.2 Add mermaid branch in `MarkdownContent.tsx` code handler: when `match[1] === 'mermaid'`, render `<MermaidBlock>` instead of `<SyntaxHighlighter>`
