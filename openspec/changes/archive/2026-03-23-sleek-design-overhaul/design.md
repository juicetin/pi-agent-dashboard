## Context

The dashboard UI currently has a functional but utilitarian design. Session cards pack metadata and action buttons together on the same lines, making them feel cramped. Single-session directory groups skip the folder header entirely, losing directory context. Chat message bubbles use plain backgrounds without borders, and copy buttons float without clear visual separation. There's no way to collapse folder groups.

## Goals / Non-Goals

**Goals:**
- Cleaner visual hierarchy in session cards by separating info from actions
- Always show directory context via folder headers for all groups
- Allow users to collapse/expand folder groups with smooth animation
- More polished chat bubbles with subtle borders and separated copy actions
- Consistent "thin divider + action row" pattern across cards and messages

**Non-Goals:**
- No changes to layout structure (sidebar width, chat area proportions)
- No new features or API changes — purely visual/interaction
- No changes to mobile drawer behavior
- No color theme system or dark/light mode toggle

## Decisions

### 1. Session card action row separation
**Decision**: Add a thin `border-t border-gray-700/30` divider inside each session card, below the info rows. Editor buttons, source badge, and hide/unhide button move to this action row.

**Rationale**: Separating actions from metadata creates clear visual hierarchy. The thin divider is subtle enough not to add visual noise but clear enough to distinguish zones. The action row is always visible (not hover-gated) for discoverability.

**Alternative considered**: Hover-only action row — rejected because it hides functionality and doesn't work well on mobile.

### 2. Always-visible folder headers
**Decision**: Remove the `isMulti` conditional in `SessionList.tsx`. All groups — including single-session ones — render a folder header with directory name, session count, git info, and editor buttons.

**Rationale**: Consistent visual structure. Users always see which directory a session belongs to, regardless of how many sessions are in that directory.

**Alternative considered**: Show directory name inline on the card itself — rejected because it duplicates info and breaks the consistent group pattern.

### 3. Collapsible folder groups with animation
**Decision**: Add a chevron toggle (▸/▾) on folder headers. Collapsed state stored in `collapsedGroups: Set<string>` keyed by `cwd`, persisted to localStorage via a helper similar to existing `session-filter-storage.ts`. Animation uses CSS `max-height` transition with `overflow: hidden`.

**Rationale**: CSS transitions are simpler and more performant than JS-based animation. `max-height` with a generous upper bound (e.g., `max-height: 1000px`) provides smooth expand/collapse without measuring DOM elements.

**Alternative considered**: `requestAnimationFrame`-based height animation — rejected for complexity; React state-driven `max-height` transition is sufficient.

### 4. Selected card accent
**Decision**: Add `border-l-2 border-blue-500/40` to the selected session card. Very subtle — just enough to indicate selection alongside the existing `bg-gray-800` highlight.

**Rationale**: Accent borders are a common sleek UI pattern. Using `/40` opacity keeps it understated.

### 5. Chat message bubble refinement
**Decision**: Add subtle borders to message bubbles: user messages get `border border-blue-500/20`, assistant messages get `border border-gray-700/40`. Copy buttons separated from content by `border-t border-gray-700/30` divider, matching the card pattern.

**Rationale**: Borders add definition without heaviness. The divider pattern is consistent with session cards, creating a unified visual language.

### 6. Tool call step refinement
**Decision**: Add `border-l-2 border-gray-700/50` left accent to tool call steps. Slightly more padding.

**Rationale**: Left border accent distinguishes tool calls from messages in the conversation flow.

### 7. Token stats bar color redesign
**Decision**: Replace current colors (green/blue/gray) with Kilo Code-inspired scheme: orange (`bg-orange-400`) for cache read, yellow (`bg-yellow-400`) for cache write, blue (`bg-blue-500`) for input, purple (`bg-purple-500`) for output. Apply to both vertical per-turn bars and context window bar.

**Rationale**: The current scheme doesn't differentiate cache read from cache write, and green/gray are less distinctive. The orange/yellow/blue/purple scheme provides 4 clearly distinguishable categories.

### 8. Stacked context window bar
**Decision**: Replace the plain single-color context window progress bar with a 5-segment stacked bar: cache read + cache write + input + output (from latest turn proportions) + unused (dark gray). Add red warning at >90%, keep yellow warning at >80%.

**Rationale**: A segmented bar gives immediate visual feedback about what's consuming the context window. Using the latest turn's token breakdown as proportions for the segments is a reasonable approximation since that reflects the current conversation state.

**Implementation**: The segments are proportioned using the latest `TurnStat` entry. The total filled width comes from `contextUsage.tokens / contextUsage.contextWindow`. Within that filled portion, each segment is sized by its ratio in the latest turn.

## Risks / Trade-offs

- **CSS max-height animation**: The transition requires a fixed `max-height` value. Setting it too high means the animation speed varies with content length. Setting it too low clips content. Using `1000px` as upper bound is a reasonable compromise for typical group sizes.
  → Mitigation: If groups get very large, the animation will be fast but still functional.

- **Always-visible folder headers increase vertical space**: Single-session groups now take slightly more vertical space.
  → Mitigation: The collapse feature compensates — users can collapse groups they don't need.

- **localStorage state for collapsed groups**: If `cwd` paths change (e.g., repo moved), stale keys accumulate.
  → Mitigation: Same pruning pattern as existing `pruneStaleHiddenIds` — clean up keys not matching current sessions.
