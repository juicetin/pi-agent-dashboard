## 1. Tests (TDD)

- [x] 1.1 In `packages/client/src/components/__tests__/CommandInput.test.tsx`, add a failing test: pressing `ArrowUp` on a single-line non-empty draft does NOT replace the draft (no history recall).
- [x] 1.2 Add a failing test: pressing `ArrowUp` on the first line of a multi-line draft does NOT trigger history recall (native cursor movement is preserved / the draft is not overwritten).
- [x] 1.3 Add a failing test: pressing `ArrowUp` on an empty input DOES trigger history recall (most recent prompt populates the input).
- [x] 1.4 Add a failing test: pressing `ArrowUp` when the textarea text is empty but a pending image is attached does NOT trigger history recall (input remains empty, image stays).
- [x] 1.5 Add a failing test: pressing `Ctrl+ArrowUp` with non-empty text recalls the most recent prompt and preserves the prior text as the in-progress draft (verifiable via subsequent `Escape` restoring it).
- [x] 1.6 Add a failing test: pressing `Cmd+ArrowUp` (metaKey) with non-empty text behaves the same as `Ctrl+ArrowUp`.
- [x] 1.7 Add a failing test: `Ctrl+ArrowDown` walks forward in history and walking past the newest entry restores the in-progress draft.
- [x] 1.8 Add a failing test: `Ctrl+ArrowUp` while the `/`-command dropdown is open does NOT trigger history recall (autocomplete still wins).
- [x] 1.9 Add a failing test: `Ctrl+ArrowUp` while a prompt is pending does NOT trigger history recall.
- [x] 1.10 Add a failing test: `Ctrl+ArrowUp` with empty text but a pending image attached recalls history AND preserves the pending image attachment.

## 2. Implementation

- [x] 2.1 In `packages/client/src/components/CommandInput.tsx`, replace the bare-arrow gating in the history block: change condition from `isCaretOnFirstLine`/`isCaretOnLastLine` to `text === "" && images.length === 0` (with images defaulting to `[]` when undefined).
- [x] 2.2 Add a force-history branch: if `(e.key === "ArrowUp" || e.key === "ArrowDown") && (e.ctrlKey || e.metaKey)` and the autocomplete-not-open + no-pending-prompt gates pass, run the existing recall path regardless of text/images content. Capture in-progress draft on first activation as today.
- [x] 2.3 Ensure the force-history path preserves pending images (do NOT clear `images` when overwriting `text` with a recalled entry).
- [x] 2.4 Remove `isCaretOnFirstLine` and `isCaretOnLastLine` and any now-unused imports / refs if no remaining call sites exist; otherwise keep them and note why.
- [x] 2.5 Run `npm test 2>&1 | tee /tmp/pi-test.log` and confirm all tests from §1 now pass.

## 3. Spec sync & verification

- [x] 3.1 Re-read `openspec/changes/history-nav-only-when-empty/specs/chat-input-state/spec.md` and confirm every scenario maps to a test in §1.
- [x] 3.2 Run `openspec validate history-nav-only-when-empty --strict` and resolve any warnings.
- [ ] 3.3 Manual smoke test: in the running dashboard, type a multi-line draft, press `↑` from line 1 — caret should stay on line 1 (no recall). Empty the input, press `↑` — most recent prompt appears. Type text again, press `Ctrl+↑` — recall fires; press `Esc` — typed text is restored. _(Deferred: user-side verification.)_

## 4. Docs

- [x] 4.1 Update the relevant row in `docs/file-index-client.md` for `CommandInput.tsx` if the change-history annotation policy applies (caveman style, one line).
- [x] 4.2 No `AGENTS.md` change (behavior change is internal to a single component).
