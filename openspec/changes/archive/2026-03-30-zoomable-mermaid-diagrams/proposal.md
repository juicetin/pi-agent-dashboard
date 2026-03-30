## Why

Mermaid diagrams rendered in the dashboard are often complex (architecture flows, sequence diagrams) and difficult to read at their default size. Users cannot zoom in to inspect details or pan around large diagrams. Additionally, diagrams are constrained within the markdown content column width, wasting available screen space that would be useful when zooming.

## What Changes

- Add click-to-activate zoom/pan interaction on Mermaid diagrams — diagram must be clicked first to enter zoom mode, avoiding scroll-hijacking conflicts with page scrolling
- When activated: mouse wheel zoom (centered on cursor), click-drag pan, pinch-to-zoom on touch, double-click to reset
- When not activated: diagram renders normally, page scroll passes through, subtle "Click to zoom & pan" hover hint shown
- Deactivate via click outside the diagram or Escape key
- Add zoom control button overlay (zoom in/out, reset) visible only when diagram is focused
- Widen chat bubbles containing Mermaid diagrams to 95% of content area (forced width, not just max-width) so diagrams have more room
- Implement using a lightweight CSS transform approach via reusable `useZoomPan` hook (no heavy library dependency)

## Capabilities

### New Capabilities
- `zoomable-mermaid`: Click-to-activate zoom/pan interaction, focus management, and wider layout for Mermaid diagram blocks

### Modified Capabilities
- `mermaid-diagram`: The rendered diagram container changes from a simple overflow-x wrapper to a focus-gated zoomable viewport with visual activation state

## Impact

- `src/client/components/MermaidBlock.tsx` — Major changes: focused state, zoom/pan via `useZoomPan` hook, control buttons, click-outside/Escape deactivation, visual focus indicator (blue border)
- `src/client/components/ChatView.tsx` — Minor: detect mermaid blocks in messages and force bubble to `w-[95%]` instead of `max-w-[80%]`
- `src/client/hooks/useZoomPan.ts` — New reusable hook: CSS transform zoom/pan with wheel, pointer, pinch, and button controls
- No new dependencies (CSS transform + pointer events approach)
- No server or extension changes
