## Context

The TokenStatsBar previously rendered a stacked bar chart where input (blue) sat on top of output (purple), both scaled to `max(input + output)`. Because input tokens are typically 10–50× larger than output, the output portion was nearly invisible, and per-turn output trends were lost.

The bar chart sits above ChatView in the desktop content area. ChatView renders messages in a scroll container.

## Goals / Non-Goals

**Goals:**
- Replace stacked bars with a butterfly (mirrored) chart — input grows up, output grows down
- Each half independently normalized to its own max
- Stats panel on the left with scale labels, cumulative totals, cache R/W, cost
- Click a bar to scroll ChatView to that turn's user message
- Compact layout fitting the existing height budget

**Non-Goals:**
- Changing the context usage progress bar
- Mobile support (TokenStatsBar is hidden on mobile)

## Decisions

### 1. Butterfly layout with per-bar columns

Each bar is a single flex column containing both halves internally: an upper `justify-end` div (input, grows up), a 1px center axis, and a lower `justify-start` div (output, grows down). All bar columns sit in a shared `flex gap-px` container.

**Why**: Per-bar columns are simpler than two separate containers that must stay aligned. Each half computes its own height percentage independently.

### 2. Independent normalization per half

```
maxInput  = max(turn.input + turn.cacheRead)  for all turns
maxOutput = max(turn.output)                   for all turns
```

Each bar's height is `value / maxForHalf * 100%`. Both halves always have at least one bar at full height.

**Why**: Makes output trends visible even when input is 50× larger.

### 3. Solid bars (no cache shade)

Input bars render as solid blue (`bg-blue-500`). The bar height uses `input + cacheRead` for the scale, but no visual distinction is made between cached and new input within the bar.

**Why**: Cache read tokens dwarf new input tokens (often 1000:1), making bars uniformly colored with an invisible sliver for new input. Removing the shade keeps bars visually clean. Cache totals are shown numerically in the stats panel instead.

### 4. TurnIndex stored per TurnStat

Each `TurnStat` carries a `turnIndex` field (-1 for tool-only turns without a new user message, >= 0 for turns that follow a user message). `turnCount` on `SessionState` only increments when a `turnIndex` is actually assigned to a user message.

Bars with `turnIndex >= 0` get `cursor-pointer` and are clickable. Bars with `turnIndex === -1` (tool-use turns) are not clickable.

**Why**: Avoids gaps between bar indices and DOM `data-turn` attributes. The previous approach (bar index + offset) broke when multiple `stats_update` events occurred between user messages, creating turnIndex values that didn't exist in the DOM.

### 5. Programmatic scroll guard

`scrollToTurn` uses a `programmaticScroll` ref flag to suppress the auto-scroll effect (which scrolls to bottom on new content). The flag is set before scrolling and cleared after 200ms.

Uses `getBoundingClientRect` + `container.scrollTo` with `behavior: "instant"` instead of `scrollIntoView`, which was unreliable in nested scroll containers.

**Why**: Without the guard, the auto-scroll effect immediately overrides the programmatic scroll. `scrollIntoView` with smooth behavior was cancelled by competing scroll events.

### 6. Fixed bar width cap

Bars use `flex-1` with `maxWidth: 1/50th` when fewer than 50 bars are present. At 50 bars (MAX_TURN_STATS), they fill naturally without a cap.

**Why**: Prevents bars from becoming oversized with few turns while maintaining consistent bar width as turns accumulate.

## Risks / Trade-offs

- **[13px per half is tight]** → Bars are small but show relative trends. Min-height of 4% ensures visibility.
- **[Cache not visible in bars]** → Trade-off for readability. Cache values are shown numerically in the stats panel.
- **[Instant scroll]** → No smooth animation, but reliable. Smooth scroll was cancelled by competing events.
