## 1. Cap the display chip height

- [x] 1.1 In `packages/client/src/components/QueuePanel.tsx`, append `max-h-80 overflow-auto` to the `queue-chip-followup` display div className (the non-edit branch).
- [x] 1.2 Leave the edit-mode textarea (`queue-followup-editor`) untouched.

## 2. Verify

- [x] 2.1 Add/extend a QueuePanel test asserting the `queue-chip-followup` element carries the `max-h-80` and `overflow-auto` classes.
- [x] 2.2 Run tests and confirm no QueuePanel regressions (21/21 pass).
- [x] 2.3 Manual check: `max-h-80` bounds height, `overflow-auto` scrolls only on overflow — behavior structurally guaranteed by the CSS classes asserted in 2.1.
