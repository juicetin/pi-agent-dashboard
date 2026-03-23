## 1. Collapsible Groups Infrastructure

- [x] 1.1 Add localStorage helpers for collapsed group state (`getCollapsedGroups`, `setCollapsedGroups`, `pruneStaleCollapsedGroups`) in `session-filter-storage.ts`
- [x] 1.2 Add collapse animation CSS class to `index.css` (max-height transition with overflow hidden, ~250ms)

## 2. Session List — Always Show Folder Headers + Collapse

- [x] 2.1 Remove `isMulti` conditional in `SessionList.tsx` — all groups render folder header with directory name, session count, git info, and editor buttons
- [x] 2.2 Add chevron toggle (▸/▾) to folder group headers with collapse/expand on click
- [x] 2.3 Wire up `collapsedGroups` state with localStorage persistence and stale key pruning
- [x] 2.4 Wrap session cards in animated container (CSS max-height transition)

## 3. Session Card — Action Row with Divider

- [x] 3.1 Move source badge from first line to a new action row below a thin divider (`border-t border-gray-700/30`)
- [x] 3.2 Move editor buttons into the action row (left side)
- [x] 3.3 Move hide/unhide button into the action row (right side)
- [x] 3.4 Add selected card left accent (`border-l-2 border-blue-500/40`)

## 4. Chat View — Sleek Message Bubbles

- [x] 4.1 Add subtle border to user message bubbles (`border border-blue-500/20`)
- [x] 4.2 Add subtle border to assistant message bubbles (`border border-gray-700/40`)
- [x] 4.3 Add thin divider (`border-t border-gray-700/30`) between message content and copy buttons in `MessageBubble`

## 5. Tool Call Step — Accent

- [x] 5.1 Add left accent border (`border-l-2 border-gray-700/50`) and increased left padding to `ToolCallStep`

## 6. Token Stats Bar Redesign

- [x] 6.1 Update vertical bar colors: orange (cache read), yellow (cache write), blue (input), purple (output) in `TokenStatsBar.tsx`
- [x] 6.2 Replace context window progress bar with 5-segment stacked bar using latest turn proportions
- [x] 6.3 Add red warning at >90% context usage (keep yellow at >80%)
- [x] 6.4 Add color-coded legend row showing per-category counts from latest turn

## 7. Tests

- [x] 7.1 Update `SessionCard` tests for new action row layout and selected accent
- [x] 7.2 Add tests for collapsible group toggle and persistence
- [x] 7.3 Update `ChatView` tests for new border classes and copy button divider
- [x] 7.4 Add tests for TokenStatsBar new color scheme and stacked context bar
