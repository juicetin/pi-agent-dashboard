## 1. Zoom/Pan Hook

- [x] 1.1 Create `useZoomPan` hook in `src/client/hooks/useZoomPan.ts` with state for scale, translateX, translateY and refs for tracking pointer events
- [x] 1.2 Implement wheel zoom handler: adjust scale centered on cursor position, clamp between 0.5× and 4×
- [x] 1.3 Implement pointer-based pan: track pointerdown/pointermove/pointerup to drag-translate the content
- [x] 1.4 Implement pinch-to-zoom: track two-touch distance changes, zoom centered on pinch midpoint
- [x] 1.5 Implement double-click to reset (scale=1, translate=0,0)
- [x] 1.6 Expose zoomIn, zoomOut, reset control functions (fixed 1.2× step multiplier)
- [x] 1.7 Write tests for `useZoomPan` hook (zoom bounds, reset, pan state updates)

## 2. MermaidBlock Zoomable Viewport

- [x] 2.1 Wrap rendered SVG in a viewport container with `overflow: hidden`, `touch-action: none`, and a reasonable default height
- [x] 2.2 Apply CSS `transform: scale(s) translate(x, y)` from `useZoomPan` to the SVG inner wrapper
- [x] 2.3 Attach wheel, pointer, and touch event handlers from `useZoomPan` to the viewport container
- [x] 2.4 Add zoom control button overlay (zoom in, zoom out, reset) positioned in the top-right corner of the viewport
- [x] 2.5 Ensure each MermaidBlock instance has independent zoom state (multiple diagrams on same page)

## 3. Full-Width Layout

- [x] 3.1 Apply negative horizontal margins or width breakout styles to MermaidBlock so it extends beyond the chat bubble's max-width on desktop
- [x] 3.2 Skip breakout on mobile (bubble is already ~95% width)
- [x] 3.3 Update existing MermaidBlock tests to account for new wrapper structure

## 4. Polish & Verification

- [x] 4.1 Style zoom control buttons with theme-aware colors (semi-transparent background, visible on both light/dark themes)
- [x] 4.2 Verify error and loading states still render correctly within the new viewport structure
- [x] 4.3 Test with a real complex Mermaid diagram in the dashboard to verify zoom/pan/reset behavior
