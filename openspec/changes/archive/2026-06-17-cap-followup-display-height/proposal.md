## Why

The follow-up queue display chip (`queue-chip-followup` in `QueuePanel`) renders entry text in an uncapped `flex-1` div. On large multi-line entries it grows unbounded, pushing the chat input and surrounding layout off-screen. The edit-mode textarea is already height-gated (caps at 6 rows, scrolls internally); display mode is not.

## What Changes

- Cap the follow-up display chip height and add overflow scrolling, matching the existing capped-content idiom used across tool renderers (`max-h-80 overflow-auto`).
- Edit mode is unchanged — it is already height-gated and behaves correctly.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `mid-turn-prompt-queue`: add a requirement that the follow-up display chip caps its rendered height and scrolls on overflow rather than growing unbounded.

## Impact

- `packages/client/src/components/QueuePanel.tsx` — single className addition to the `queue-chip-followup` display div.
- No protocol, server, or bridge changes. No breaking changes.
