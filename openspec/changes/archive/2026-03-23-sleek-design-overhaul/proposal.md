## Why

The current UI feels utilitarian — session cards blend together, action buttons are cramped inline with metadata, message bubbles lack visual definition, and single-session directories lose their folder context. A design refresh will improve readability, visual hierarchy, and interaction polish across the sidebar and chat view.

## What Changes

- **Session cards**: Separate action buttons (editors, source badge, hide) into a dedicated row below a thin divider line within each card
- **Folder headers always visible**: Show directory-level group header even when only one session belongs to a directory (currently skipped for single-session groups)
- **Collapsible folder groups**: Add chevron toggle on folder headers to collapse/expand session lists within, with smooth height animation. Persist collapsed state in localStorage
- **Chat message bubbles**: Add subtle borders, refine padding, and separate copy buttons below a thin divider line (matching card pattern)
- **Tool call steps**: Add subtle left accent border and cleaner spacing
- **Selected card accent**: Very subtle left border accent on selected session card
- **Token stats bar redesign**: Update vertical per-turn bars and context window bar to use Kilo Code-style color scheme — orange (cache read), yellow (cache write), blue (input), purple (output). Replace plain context window progress bar with 5-segment stacked bar. Add red warning at >90% usage. Show per-category labels.
- **Overall polish**: Softer colors, better spacing, more refined visual hierarchy

## Capabilities

### New Capabilities
- `sleek-card-design`: Refined session card layout with separated action row, thin divider, source badge in action row, subtle selected-state accent
- `collapsible-groups`: Folder group headers with animated collapse/expand toggle, localStorage persistence, always-visible directory headers
- `sleek-chat-design`: Refined chat message bubbles with subtle borders, copy button divider line, improved tool call step styling

### Modified Capabilities
- `session-sidebar`: Always show folder header for all groups (not just multi-session), integrate collapsible groups
- `session-grouping`: Directory header always rendered regardless of session count
- `chat-view`: Visual refinements to message bubbles and copy button layout
- `content-copy`: Copy buttons separated by thin divider below message content
- `token-stats-bar`: Redesigned color scheme and stacked context window bar

## Impact

- **Files**: `SessionCard.tsx`, `SessionList.tsx`, `ChatView.tsx`, `ToolCallStep.tsx`, `TokenStatsBar.tsx`, `index.css`
- **New state**: `collapsedGroups: Set<string>` in SessionList with localStorage persistence
- **No API/protocol changes** — purely visual/interaction
- **No breaking changes** — all existing functionality preserved
