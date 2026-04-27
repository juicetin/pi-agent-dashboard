## Context

The dashboard's chat input (`<CommandInput>`) is rendered inside the `sessionDetail` JSX tree in `App.tsx`. That tree is conditionally rendered on a route guard (line ~1355 desktop, line ~1232 mobile): when the user navigates to `/settings`, `/folder/:cwd/terminals`, `/folder/:cwd/editor`, OpenSpec preview, archive browser, file diff view, etc., the `sessionDetail` branch is skipped and `<CommandInput>` is **unmounted**. On return, a fresh instance mounts with fresh `useState`.

Drafts (typed text) anticipated this by being lifted to App-level state:

- `App.tsx` owns `drafts: Map<sid, string>` and a debounced `localStorage` writer keyed `chat-draft:<sid>`.
- `<CommandInput draft={selectedDraft} onDraftChange={setDraftForSelected}>` renders in controlled mode.
- A reset effect inside CommandInput (`useEffect(…, [sessionId])`) resets internal navigation state on session switch.

Images followed a different path. `useImagePaste()` owns its own `useState<ImageContent[]>` for `pendingImages`, lives inside `<CommandInput>`, and is therefore destroyed on every route takeover and reused (not reset) on every session switch — producing the two failure modes documented in `proposal.md`. JSONL evidence from `~/.pi/agent/sessions/--home-skrot1-BB-pi-packages-pi-agent-dashboard--/2026-04-27T07-32-46-933Z_*.jsonl` confirms a today-session sequence of paste → settings → return → send produced a text-only `send_prompt`.

`useImagePaste` is also reused by the OpenSpec Explore dialog. That surface's lifetime equals the dialog's lifetime, so its current uncontrolled behavior is correct — any controlled-mode refactor must preserve a working uncontrolled fallback (or move uncontrolled storage one level out).

## Goals / Non-Goals

**Goals:**
- Pasted images in the chat input survive navigation to any content-area route, identical to draft text.
- Pasted images in the chat input do not leak across sessions when the user switches before sending.
- Single source of truth: the App owns per-session image attachments alongside per-session drafts.
- The Explore dialog keeps working with no behavior change.
- Tests cover both failure modes.

**Non-Goals:**
- Persisting pending images across page reload (rejected — base64 blobs are large, the existing `chat-input-state` spec excludes this on purpose, and the failure mode is acceptable).
- Changing the `send_prompt` wire protocol or the `ImageContent` shape.
- Changing image size limits, MIME-type gates, error messages, or the `<ImagePreviewStrip>` component.
- Refactoring `useImagePaste`'s FileReader/base64 conversion logic.

## Decisions

### Decision 1: Lift `pendingImages` to App, leave `imageError` local

`pendingImages` is the only piece of state that needs to survive component unmount/remount. `imageError` auto-clears after 3 seconds and only matters during the paste event itself — there is no value in persisting it. Splitting them keeps the controlled hook surface small.

**Alternatives considered:**

- *Lift everything to App.* Rejected — `imageError` would gain a session key, a clear timeout, and complicate the Explore dialog reuse for zero user benefit.
- *Use `key={sessionId}` on `<CommandInput>` to remount on switch.* Rejected — fixes the leak but not the route-takeover wipe (route takeover is the bigger problem), and remounting destroys textarea focus, cursor position, and IME composition.
- *`useEffect(() => clearImages(), [sessionId])` inside CommandInput.* Rejected — fixes only the leak case, not the route-takeover wipe (CommandInput is unmounted across that boundary, the effect never runs).

### Decision 2: `useImagePaste` becomes controlled with an uncontrolled fallback

Signature evolves from:

```ts
useImagePaste(): { pendingImages, imageError, handlePaste, removeImage, clearImages }
```

to:

```ts
useImagePaste(opts?: {
  images?: ImageContent[];
  onImagesChange?: (next: ImageContent[]) => void;
}): { pendingImages, imageError, handlePaste, removeImage, clearImages }
```

When `opts.images` is provided, the hook treats it as the source of truth and routes mutations through `onImagesChange`. When `opts` is omitted (Explore dialog), the hook falls back to internal `useState` — the old behavior verbatim. This pattern matches the controlled/uncontrolled split already used in `<CommandInput>` for `text` (`isControlled = draft !== undefined`), so the codebase already has a tested precedent.

**Alternatives considered:**

- *Two hooks: `useControlledImagePaste` + `useImagePaste`.* Rejected — duplicates the FileReader/MIME-gate logic.
- *Always controlled, force the Explore dialog to provide its own state.* Acceptable but adds churn at the second call site for no benefit. The fallback keeps the diff small.

### Decision 3: App-side storage shape mirrors `drafts`

```ts
const [pendingImagesMap, setPendingImagesMap] =
  useState<Map<string, ImageContent[]>>(new Map());

const selectedImages = selectedId
  ? pendingImagesMap.get(selectedId) ?? EMPTY_ARRAY
  : EMPTY_ARRAY;

const setImagesForSelected = useCallback((next: ImageContent[]) => {
  if (!selectedId) return;
  setPendingImagesMap((prev) => {
    const m = new Map(prev);
    if (next.length === 0) m.delete(selectedId); else m.set(selectedId, next);
    return m;
  });
}, [selectedId]);

const clearImagesForSession = useCallback((sid: string) => {
  setPendingImagesMap((prev) => {
    if (!prev.has(sid)) return prev;
    const m = new Map(prev); m.delete(sid); return m;
  });
}, []);
```

`EMPTY_ARRAY` is a module-level frozen `[]` so referential identity is stable when no images are pending — avoids re-rendering `<CommandInput>` on every App render.

`wrappedHandleSend` (already exists for `/flows` interception and draft clearing at `App.tsx:494`) gains one line: `clearImagesForSession(selectedId)` after `handleSend(text, images)` succeeds. This keeps the post-send clear behavior identical to today.

### Decision 4: Do not persist to `localStorage`

Drafts are persisted because they're cheap (text). Images are not — base64 PNGs from clipboard easily hit hundreds of KB each, and `localStorage` has a 5–10 MB per-origin quota that would compete with everything else the dashboard stores. The user's expectation across page reload is much weaker than across a navigation click; the existing `chat-input-state` spec already calls this out. We narrow that scenario to "across page reload only" rather than removing it.

### Decision 5: Don't touch the wire protocol

`send_prompt` already carries `images: ImageContent[]`. Optimistic state in `pendingPrompt.images` (rendered by `ChatView`) is unchanged. The fix is purely a client-side state-location change.

## Risks / Trade-offs

- **[Risk] Memory growth across many sessions.** A user could paste images into 20 sessions without sending any. → Mitigation: same risk class as drafts (and far smaller magnitude than `sessionStates` itself, which holds full message history). No mitigation beyond the existing per-session-cleanup-on-send. Future change can add a "clear images on session removal" cleanup if needed.
- **[Risk] Double-render churn on every paste.** Lifting state higher means the App tree re-renders when images change instead of just `<CommandInput>`. → Mitigation: paste events are rare (user-initiated), and the state update is small (a Map mutation). Stable `EMPTY_ARRAY` keeps no-images sessions from triggering child re-renders. React's bail-out on identical state covers the rest.
- **[Risk] `pendingImages` and `state.pendingPrompt.images` look similar but mean different things.** → Mitigation: name App state `pendingImagesMap` clearly; document in design that `pendingImagesMap` = "in input, not yet sent" and `state.pendingPrompt.images` = "sent, awaiting server ack". No code structure conflates them today.
- **[Trade-off] Explore dialog stays uncontrolled.** Some readers will expect symmetry. → Accepted: the dialog's lifetime IS the input's lifetime, so per-session keying would be meaningless.
- **[Risk] Tests need a routing-aware harness.** The route-takeover scenario can't be reproduced with `<CommandInput>` in isolation. → Mitigation: add an App-level test that mounts the real router, navigates `/session/:id` → `/settings` → back, and asserts the preview thumbnails and the `send_prompt` payload.

## Migration Plan

This is a pure client-side refactor. No persistence migration, no protocol change, no version bump beyond the next normal release.

1. Land the controlled-hook refactor with the existing test suite passing.
2. Ship as part of a normal client build (`npm run build` + restart).
3. Rollback: revert the App.tsx + CommandInput.tsx + useImagePaste.ts edits in one revert. No data on disk to clean up.

## Open Questions

(none — the design space here is small and the user behavior expectations match the existing draft model exactly)
