# Tasks

## 1. Reproduce (failing test first)
- [ ] 1.1 Add a click-level test in `MarkdownContent.test.tsx`: render a table
  via `MarkdownContent` (memoized, single render), click "Copy as Markdown",
  assert `navigator.clipboard.writeText` received the real markdown table
  string (not `""`). Repeat for "Copy as TSV". → verify: test FAILS on current
  code (copies `""`).

## 2. Change the CopyButton contract
- [ ] 2.1 `packages/client/src/components/CopyButton.tsx`: replace prop
  `text: string` with `getText: () => string`; call `getText()` inside
  `handleClick`; update `useCallback` deps to `[getText]`. → verify: `tsc`
  errors point at every stale call site.

## 3. Migrate call sites (`text=` → `getText=`)
- [ ] 3.1 `MarkdownContent.tsx` TableWrapper: `getText={copyMarkdown}` /
  `getText={copyTsv}` (pass the memoized callbacks directly).
- [ ] 3.2 `MarkdownContent.tsx` CodeBlockWrapper: `getText={() => codeString}`.
- [ ] 3.3 `ChatView.tsx` MessageBubble: `getText={() => content}` and
  `getText={getPlainText}` (fixes the plain-text→markdown degradation too).
- [ ] 3.4 `SkillInvocationCard.tsx` (4 sites) and `SessionBanner.tsx`: wrap each
  `text={X}` as `getText={() => X}`.
- [ ] 3.5 Grep to confirm zero remaining `<CopyButton ... text=` usages.
  → verify: `grep -rn "CopyButton" packages/**/src | grep "text="` empty;
  `tsc --noEmit` clean.

## 4. Verify
- [ ] 4.1 New click-level tests pass (table md + TSV copy real content).
- [ ] 4.2 `npm test 2>&1 | tee /tmp/pi-test.log` green (existing
  content-copy / MarkdownContent / ChatView suites).
- [ ] 4.3 `npm run quality:changed` clean.

## 5. Manual QA (tested later)
- [ ] 5.1 In a live chat session, render an assistant message containing a
  markdown table; click "Copy as Markdown" and "Copy as TSV"; paste and confirm
  full content. Also confirm code-block copy and message "Copy as plain text".
