## Why

The current mobile experience uses a hamburger menu overlay for the session list, which is a bolted-on afterthought rather than a designed mobile experience. Users must find a small hamburger button, open a narrow (w-72) overlay, select a session, then have no natural way to navigate back. Session cards are packed with tiny buttons that are unusable on touch devices. The layout needs a proper two-step master-detail navigation pattern that feels native on mobile.

## What Changes

- **Replace hamburger+overlay with full-screen two-step navigation on mobile (<768px)**: Session list is the home screen at full width; tapping a card slides to the session detail at full width
- **Add slide transition between list and detail views**: CSS transform-based left/right slide, both views stay mounted to preserve scroll position
- **Add swipe-back gesture**: Left-edge swipe (20px zone) to navigate back — from session detail to list, from OpenSpec preview to session detail
- **Create simplified mobile session card**: Shows only status dot, name, age, model, activity indicator, OpenSpec badge, context bar, and cost — no action buttons
- **Add kebab menu (⋮) dropdown in mobile session detail header**: Relocates all session actions (rename, hide, resume, fork, editor, OpenSpec attach, exit, git info) into a dropdown
- **Remove TokenStatsBar on mobile**: Not shown in mobile session detail view
- **Increase touch targets throughout**: All interactive elements meet 44px minimum on mobile — session cards, tool call toggles, copy buttons, dropdowns, selectors
- **Add responsive padding/sizing to ChatView**: Wider message bubbles, tighter padding on mobile
- **Fix DnD on touch devices**: Add TouchSensor with 250ms delay to prevent scroll interference
- **Remove HamburgerButton and MobileOverlay components on mobile path**: Replaced by the two-step navigation

## Capabilities

### New Capabilities
- `mobile-navigation`: Two-step master-detail navigation with slide transitions and swipe-back gesture for mobile viewports
- `mobile-session-card`: Simplified session card variant for mobile list view with essential info only
- `mobile-action-menu`: Kebab dropdown menu in mobile session detail header containing relocated session actions

### Modified Capabilities
- `mobile-resilience`: Update touch target requirements and layout breakpoints to reflect two-step navigation instead of hamburger overlay
- `resizable-sidebar`: Desktop-only; mobile uses full-screen list instead
- `chat-view`: Responsive padding and message bubble widths for mobile
- `token-stats-bar`: Hidden on mobile viewports
- `session-ordering`: DnD touch sensor with delay for mobile compatibility

## Impact

- **Client components**: App.tsx layout branching, new mobile-specific components, responsive adjustments across ChatView, CommandInput, StatusBar, ToolCallStep, ModelSelector, ThinkingLevelSelector
- **Removed components (mobile path)**: HamburgerButton, MobileOverlay no longer used on mobile
- **New hooks**: useMediaQuery, useMobile context, useSwipeBack gesture handler
- **CSS**: New transition/transform styles for slide animation, responsive touch target sizes
- **No server changes**: Purely client-side
- **No protocol changes**: No new messages or API endpoints
- **New dependency**: None (pure CSS transitions + vanilla touch events)
