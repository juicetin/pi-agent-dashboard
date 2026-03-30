## Context

Mermaid diagrams are rendered by `MermaidBlock.tsx`, which produces an SVG and wraps it in a `<div className="mermaid-diagram my-2 overflow-x-auto">`. This div sits inside a chat bubble constrained to `max-w-[80%]` (desktop) or `max-w-[95%]` (mobile). Complex diagrams are hard to read at this size with no way to zoom.

## Goals / Non-Goals

**Goals:**
- Make Mermaid diagrams zoomable and pannable with mouse wheel, drag, and pinch-to-zoom
- Provide zoom control buttons (zoom in, zoom out, reset/fit)
- Use the full content area width for diagrams to give more room when zooming
- Keep it lightweight — pure CSS transforms + pointer events, no external library

**Non-Goals:**
- Minimap or overview panel
- Zoom persistence across re-renders or sessions
- Changing how non-Mermaid content is laid out

## Decisions

### 1. CSS `transform` for zoom/pan (no library)

Use `transform: scale(s) translate(x, y)` on the SVG container. Track `scale`, `translateX`, `translateY` in React state/refs.

**Rationale**: SVG zoom is well-suited to CSS transforms. Adding a library like `panzoom` or `d3-zoom` for a single component is unnecessary overhead. The math is simple: wheel events adjust scale, pointer events adjust translate.

**Alternative considered**: `svg-pan-zoom` library — rejected because it adds a dependency for straightforward transform math.

### 2. Click-to-activate interaction model

Diagram must be clicked to enter focused/interactive mode. When focused:
- **Wheel**: Zoom in/out centered on cursor position
- **Click-drag**: Pan
- **Pinch**: Two-finger zoom on touch devices
- **Double-click**: Reset to fit
- Buttons overlay in top-right corner: `+`, `−`, `⟳` (reset)
- **Deactivate**: Click outside or press Escape

When unfocused, all events pass through to the page (normal scrolling). A hover hint ("Click to zoom & pan") guides discovery.

**Rationale**: Standard map/image-viewer interactions users already know. Click-to-activate avoids scroll-hijacking — wheel zoom must not interfere with page scrolling.

### 3. Wide bubble via `hasMermaid()` detection in ChatView

ChatView detects mermaid code blocks in message content (`/```mermaid\b/`) and applies `w-[95%]` (forced width) instead of `max-w-[80%]` to the chat bubble. This makes the bubble fill 95% of the content area when it contains a diagram.

**Rationale**: Using `max-w` alone doesn't help — the bubble shrinks to fit text content. Forcing `w-[95%]` ensures diagrams always get ample space. This is simpler than negative-margin breakout and keeps MermaidBlock self-contained.

**Alternative considered**: Negative margins on MermaidBlock to break out of the bubble — rejected because it required parent-aware CSS and looked inconsistent with the bubble border.

### 4. Zoom bounds

Min scale: 0.5× (zoom out to see full diagram small). Max scale: 4×. Default: fit diagram to container width (scale ≤ 1).

### 5. Custom hook `useZoomPan`

Extract zoom/pan logic into a reusable hook that returns `{ containerRef, transform, handlers, zoomIn, zoomOut, reset }`. This keeps MermaidBlock's render clean and makes the logic testable.

## Risks / Trade-offs

- [Risk] Wheel zoom conflicts with page scrolling → Mitigation: Click-to-activate model — zoom/pan only active when diagram is focused. Unfocused diagrams pass all events through to the page.
- [Risk] Mobile pinch-zoom conflicts with page zoom → Mitigation: `touch-action: none` only applied when diagram is focused; reverts to `auto` when unfocused.
- [Risk] User may not discover zoom capability → Mitigation: Hover hint ("Click to zoom & pan") appears on unfocused diagrams.
