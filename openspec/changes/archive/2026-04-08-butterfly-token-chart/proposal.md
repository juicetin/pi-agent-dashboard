# Butterfly Token Chart with Click-to-Scroll

## Problem

The current TokenStatsBar uses stacked bars (input on top of output) scaled to the combined max. Since input tokens are typically 10–50× larger than output, the output portion is a barely-visible sliver. Output trends across turns are lost.

## Solution

Replace the stacked bar chart with a **butterfly chart** (mirrored bar chart):

- **Upper half**: input tokens (input + cacheRead) grow upward as solid blue bars
- **Lower half**: output tokens grow downward as purple bars
- Each half is **independently normalized** to its own max, making both directions equally readable
- Stats panel on the left shows: scale labels (● with color), cumulative totals, cache R/W, and cost
- **Click a bar** to scroll ChatView to that turn's user message

```
  ● ↓102.8k     ┌──┐
  ● ↑905         │██│  │██│  │  │      ██ = input (blue)
  ↓9.4M ↑35.9k  ════════════════════   center axis
  R9.4M W294k    │▓▓│  │▓▓│  │▓▓│     ▓▓ = output (purple)
  $8.78                 │▓▓│
```

### Key design decisions

- **No cache in bars**: cacheRead dwarfs new input, making bars uniform. Input bars show `input + cacheRead` for normalization/scale labels but render as solid blue.
- **Cumulative ↓ includes cache**: `↓` counter = `tokensIn + cacheRead` to reflect total input volume.
- **Stats left, chart right**: compact single-row layout, no wrapping.
- **Fixed bar width cap**: bars use `flex-1` with `maxWidth: 1/50th` when < 50 bars, so they match full-chart bar width. At 50 bars they fill naturally.
- **TurnIndex on TurnStat**: each `TurnStat` carries its own `turnIndex` (-1 for tool-only turns without a user message). Bars with `turnIndex >= 0` are clickable, others aren't. This avoids gaps between bar indices and DOM `data-turn` attributes.
- **Programmatic scroll guard**: `scrollToTurn` suppresses auto-scroll via a `programmaticScroll` ref flag to prevent the auto-scroll effect from fighting the navigation.

## Scope

- Redesign TokenStatsBar chart to butterfly layout
- Stats panel with scale labels, cumulative totals, cache R/W, cost
- Click-to-scroll from bar to user message in ChatView
- Tag user messages with `data-turn` indices
- Expose `scrollToTurn()` from ChatView via `forwardRef`/`useImperativeHandle`
- Fix service worker fetch error handling

## Out of Scope

- Changing the context usage bar (stays as-is)
- Mobile layout (TokenStatsBar is already hidden on mobile)

## Files Affected

| File | Change |
|------|--------|
| `src/client/components/TokenStatsBar.tsx` | Butterfly layout, independent normalization, stats panel, `onTurnClick` using `turn.turnIndex` |
| `src/client/components/ChatView.tsx` | `forwardRef`, `data-turn` attributes, `scrollToTurn` with `programmaticScroll` guard |
| `src/client/App.tsx` | Wire `chatViewRef`, `onTurnClick` → `scrollToTurn()` |
| `src/client/lib/event-reducer.ts` | `turnIndex` on `ChatMessage` and `TurnStat`, `turnCount` on `SessionState` |
| `src/client/components/__tests__/TokenStatsBar.test.tsx` | Tests for butterfly layout, stats panel, click behavior |
| `src/client/lib/__tests__/event-reducer.test.ts` | Tests for turnIndex tracking |
| `public/sw.js` | Graceful fetch error handling |
