## 1. Event Reducer — Turn Index Tracking

- [x] 1.1 Add `turnIndex?: number` field to `ChatMessage` interface
- [x] 1.2 Add turn counter to reducer state; on `stats_update` with `turnUsage`, assign `turnIndex` to the last user message and increment counter
- [x] 1.3 Write tests: turnIndex is set on user messages after stats_update, counter increments across turns

## 2. TokenStatsBar — Butterfly Chart Layout

- [x] 2.1 Refactor bar chart into two-half layout: upper (input, items-end) and lower (output, items-start) with 1px center axis
- [x] 2.2 Compute independent max per half: `maxInput = max(input + cacheRead)`, `maxOutput = max(output)`
- [x] 2.3 Render input bars with cacheRead as `blue-500/30` bottom portion and input as solid `blue-500` top portion, growing upward
- [x] 2.4 Render output bars in `purple-500`, growing downward
- [x] 2.5 Add max-value labels: `↓{maxInput}` above upper half, `↑{maxOutput}` below lower half
- [x] 2.6 Add `onTurnClick?: (turnIndex: number) => void` prop; each bar calls it with `barIndex + turnIndexOffset`
- [x] 2.7 Add `turnIndexOffset?: number` prop (default 0) for sliding window support
- [x] 2.8 Set `cursor-pointer` on bars
- [x] 2.9 Update legend to show cache-read shade, input, and output
- [x] 2.10 Update existing tests for new layout structure

## 3. ChatView — Scroll-to-Turn

- [x] 3.1 Convert ChatView to `forwardRef` and expose `scrollToTurn(turnIndex: number)` via `useImperativeHandle`
- [x] 3.2 Add `data-turn={msg.turnIndex}` attribute to user message DOM elements
- [x] 3.3 Implement `scrollToTurn`: query `[data-turn="${turnIndex}"]`, call `scrollIntoView({ behavior: 'smooth', block: 'start' })`

## 4. App Wiring

- [x] 4.1 Create a `chatViewRef` using `useRef` in App.tsx
- [x] 4.2 Pass ref to ChatView
- [x] 4.3 Compute `turnIndexOffset` from `selectedState` (total turns tracked minus turnStats.length)
- [x] 4.4 Pass `onTurnClick` and `turnIndexOffset` to TokenStatsBar, wiring click to `chatViewRef.current?.scrollToTurn()`
