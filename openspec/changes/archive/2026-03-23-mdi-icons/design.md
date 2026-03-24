## Context

The web client uses emoji characters as icons in 8 component files. Emojis cannot be styled with CSS and render inconsistently across platforms. We need a proper icon system.

## Goals / Non-Goals

**Goals:**
- Replace all emoji icons with MDI SVG icons
- Consistent, styleable icons across all components
- Tree-shaken bundle (only used icons included)

**Non-Goals:**
- Creating a generic icon abstraction layer
- Replacing any non-icon visual elements
- Changing component behavior or layout

## Decisions

### Use `@mdi/js` + `@mdi/react` (not web font, not other icon libraries)

**Rationale**: Tree-shakeable SVG paths. Only bundled icons ship (~25KB vs ~200KB+ for full font). React component `<Icon path={mdiCheck} />` integrates naturally with JSX and Tailwind. MDI has 7000+ icons covering all our needs.

**Alternatives considered**:
- **MDI web font**: Simpler markup but loads entire font, no tree-shaking
- **Lucide/Heroicons**: Smaller sets, may lack some icons we need
- **Inline SVG**: No dependency but verbose and hard to maintain

### Change `CopyButton.icon` prop from `string` to `ReactNode`

**Rationale**: MDI icons are JSX elements, not strings. `ReactNode` is the simplest type that accepts both `<Icon />` components and fallback text. Icon lookup maps (`statusIcons`, `sourceIcons`, `editorIcons`) also become `Record<string, ReactNode>`.

### Standard icon size: 16px (size={0.7}) for inline, 20px (size={0.85}) for standalone

**Rationale**: Matches current emoji visual size in the UI. MDI's `<Icon>` component uses `size` prop in multiples of 24px.

## Risks / Trade-offs

- [Test assertions change] → Tests that checked `textContent` for emojis will need to query by `role`, `title`, or test-id instead. Straightforward but touches 3 test files.
- [Bundle size +25KB] → Acceptable for professional icon rendering. Tree-shaking keeps it minimal.
