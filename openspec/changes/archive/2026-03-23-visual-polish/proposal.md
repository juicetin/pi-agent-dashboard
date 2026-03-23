## Why

The dashboard's current visual style uses flat elements and a saturated blue for user messages that clashes with the overall dark aesthetic. Session cards and message bubbles lack depth, making the UI feel two-dimensional. The context progress bar uses abrupt color thresholds instead of a smooth gradient, missing an opportunity for intuitive at-a-glance feedback. These small refinements will make the dashboard feel more polished and modern without structural changes.

## What Changes

- **User message color**: Replace the solid `bg-blue-600` user bubble with a subtler tint (e.g., `bg-blue-600/15` with a `border-l-2 border-blue-400` accent) so user and assistant messages look similar but distinguishable.
- **3D card styling**: Add `shadow-md`, slight `hover:shadow-lg hover:-translate-y-0.5` transitions, `rounded-xl`, and subtle border glow to session cards, message bubbles, tool call steps, and command dropdown.
- **Context bar gradient**: Replace the threshold-based color logic (green → yellow at 80% → red at 90%) with a smooth CSS gradient that transitions green → yellow → red as token usage increases from 0% → 100%.

## Capabilities

### New Capabilities

_(none — all changes are visual refinements to existing components)_

### Modified Capabilities

- `chat-view`: User message visual style changes from solid blue background to subtle tint with accent border; assistant bubble gets shadow/rounded treatment.
- `token-stats-bar`: Context window progress bar color changes from threshold-based to smooth green→yellow→red gradient.
- `session-sidebar`: Session cards gain 3D depth (shadow, rounded corners, hover elevation).

## Impact

- **Files**: `ChatView.tsx`, `TokenStatsBar.tsx`, `SessionCard.tsx`, `ToolCallStep.tsx`, `CommandInput.tsx` (dropdown), `index.css` (minor)
- **Tests**: `TokenStatsBar.test.tsx` threshold assertions may need updating; snapshot-style checks in `ChatView.test.tsx` and `SessionCard.test.tsx` may need class updates.
- **No API/protocol changes**. Pure CSS/Tailwind class adjustments.
