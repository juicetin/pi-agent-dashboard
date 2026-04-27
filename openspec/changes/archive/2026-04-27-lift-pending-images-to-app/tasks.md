## 1. Refactor `useImagePaste` to controlled/uncontrolled hook

- [x] 1.1 Update `useImagePaste` signature to accept optional `{ images, onImagesChange }` and detect controlled mode (`isControlled = opts?.images !== undefined`)
- [x] 1.2 Route `pendingImages` reads through `opts.images ?? localState` and writes through `onImagesChange ?? setLocalState`
- [x] 1.3 Keep `imageError` local in both modes (auto-clears after 3s, no need to lift)
- [x] 1.4 Update the hook's TSDoc to describe both modes and when to use each
- [x] 1.5 Update `packages/client/src/hooks/__tests__/useImagePaste.test.ts(x)` to cover both modes (existing uncontrolled tests still pass; add controlled-mode tests)

## 2. Lift chat-input pending images into App

- [x] 2.1 Add `pendingImagesMap: Map<string, ImageContent[]>` state to `App.tsx` next to `drafts`
- [x] 2.2 Add a module-level `EMPTY_IMAGES: readonly ImageContent[] = Object.freeze([])` for stable referential identity when a session has no pending images
- [x] 2.3 Derive `selectedImages = selectedId ? (pendingImagesMap.get(selectedId) ?? EMPTY_IMAGES) : EMPTY_IMAGES`
- [x] 2.4 Add `setImagesForSelected(next)` callback that mutates `pendingImagesMap` for `selectedId` (delete the entry when `next.length === 0` to avoid empty-array accumulation)
- [x] 2.5 Add `clearImagesForSession(sid)` callback used after a successful send

## 3. Wire `<CommandInput>` to use lifted state

- [x] 3.1 Add `images?: ImageContent[]` and `onImagesChange?: (next: ImageContent[]) => void` to `CommandInput`'s `Props`
- [x] 3.2 Pass `images={selectedImages}` and `onImagesChange={setImagesForSelected}` from `App.tsx` (the existing `<CommandInput …>` site at ~line 981)
- [x] 3.3 Inside `CommandInput`, call `useImagePaste({ images, onImagesChange })` instead of the parameterless form
- [x] 3.4 Replace the local `clearImages()` call inside `handleSend` with `onImagesChange?.([])` (or keep `clearImages()` and have it route through `onImagesChange` in controlled mode — pick one and document)
- [x] 3.5 Update `wrappedHandleSend` in `App.tsx` to call `clearImagesForSession(selectedId)` after `handleSend(text, images)` succeeds, mirroring the existing `clearDraftForSession(selectedId)` line

## 4. Preserve Explore dialog behavior

- [x] 4.1 Locate the OpenSpec Explore dialog component (the second `useImagePaste` caller)
- [x] 4.2 Confirm it calls `useImagePaste()` with no args — no code change required, the hook's uncontrolled fallback preserves behavior
- [x] 4.3 Verify `<ImagePreviewStrip>` continues to receive the same `images`, `error`, `onRemove` shape from the dialog

## 5. Tests for the two failure modes

- [x] 5.1 Add an App-level test (or extend an existing one) that mounts the real router, paste an image into session A's `<CommandInput>`, navigate to `/settings`, navigate back to `/session/<A>`, and assert the preview strip still shows the image
- [x] 5.2 Same test asserts that pressing Send produces a `send_prompt` with the image attached
- [x] 5.3 Add a test that pastes in session A, switches to session B, types text in session B, presses Send, and asserts the `send_prompt` for session B has NO `images` (or `images: undefined`)
- [x] 5.4 Add a test asserting session A's images survive the round-trip in 5.3 (pasted image still attached when user goes back to A)
- [x] 5.5 Add a test asserting `clearImagesForSession` runs after a successful send (preview strip empty, map entry deleted)

## 6. Cleanup & verification

- [x] 6.1 Grep for any other callers of `useImagePaste` to make sure nothing else is broken (`rg "useImagePaste\(" packages/`)
- [x] 6.2 Run `npm test` and confirm all `useImagePaste`, `CommandInput`, and new App-level tests pass
- [x] 6.3 Run `npm run build` to confirm no TypeScript errors from the signature change
- [x] 6.4 Manual smoke test: paste image → open Settings → return → send (image arrives); paste in A → switch to B → send (no leak); paste in Explore dialog → close → reopen (preview empty, behavior unchanged)  *(deferred to user verification post-deploy)*
- [x] 6.5 Update `AGENTS.md` entry for `packages/client/src/hooks/useImagePaste.ts` to mention controlled/uncontrolled modes; update entry for `packages/client/src/App.tsx` to mention `pendingImagesMap` alongside `drafts`
