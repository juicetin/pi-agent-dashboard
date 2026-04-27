## Why

Pasted images are silently lost when the user opens Settings (or any other content-area route) and returns to the chat view, and pasted images leak across sessions when the user switches sessions before sending. Drafts (typed text) were already lifted to App-level state and survive both cases; pasted images were left behind in `useImagePaste`'s local `useState` inside `<CommandInput>`, which gets unmounted by route changes and reused (not reset) on session switch. The result is two confusing failure modes that today's session JSONL evidence confirms: a user pastes images, navigates, comes back, hits Send, and the message arrives with no images attached — or worse, lands in the wrong session.

## What Changes

- Lift pending paste-image state out of `useImagePaste`'s local `useState` and into App-level state keyed by `sessionId`, mirroring how typed-text drafts are already stored.
- `<CommandInput>` becomes a controlled consumer of `images` + `onImagesChange` (just like it is for `draft` + `onDraftChange` today).
- `useImagePaste` becomes a controlled hook: it accepts the current images array and a setter, and returns only the paste handler + transient `imageError` (which can stay local — it auto-clears in 3 s).
- The OpenSpec Explore dialog continues to own its own paste state locally (its lifetime IS the dialog), so the controlled hook supports both modes.
- **BREAKING (internal)**: `useImagePaste()` signature changes from `() => UseImagePasteResult` to `(opts: { images, onImagesChange }) => Pick<UseImagePasteResult, "imageError" | "handlePaste">`. Only two callers exist (`CommandInput`, Explore dialog).
- Pending images are NOT persisted to `localStorage` (unlike drafts) — they're large base64 blobs and the persistence requirement in `chat-input-state` explicitly excludes them. This change keeps that exclusion; persistence is in-memory across route navigation only, cleared on page reload.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `chat-input-state`: pasted-image attachments SHALL survive navigation to any content-area route (Settings, terminals, editor, OpenSpec preview, file diff, etc.) just like text drafts do, and SHALL NOT leak across sessions when the user switches sessions before sending. The existing "Pasted image drafts are NOT persisted" scenario is narrowed to "across page reload" only.
- `image-paste`: the spec is amended to clarify that image-paste state SHALL be scoped per-session (not per-component) for the chat-input surface. Explore dialog behavior is unchanged.

## Impact

- Affected code:
  - `packages/client/src/hooks/useImagePaste.ts` — signature change to controlled hook
  - `packages/client/src/components/CommandInput.tsx` — read images from props, call onImagesChange instead of local state
  - `packages/client/src/App.tsx` — own a `pendingImagesMap: Map<sid, ImageContent[]>` alongside `drafts`, wire it into `<CommandInput>`, clear on successful send
  - `packages/client/src/components/OpenSpecExploreDialog.tsx` (or wherever the Explore textarea lives) — keep using the hook in uncontrolled mode (small wrapper retains old behavior, OR component now owns its own `useState` and passes it through)
- No protocol, server, or persistence changes.
- No changes to image-send semantics: the same `send_prompt { images }` payload flows out, just sourced from session-scoped state.
- Tests touched: `useImagePaste.test.ts(x)`, `CommandInput.test.tsx` paste/clear cases, plus a new App-level test covering the route-takeover and session-switch scenarios.
