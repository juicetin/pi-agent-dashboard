## 1. Tokenizer (pure, TDD)

- [ ] 1.1 Add `packages/client/src/lib/__tests__/linkify-tool-output.test.ts` covering: URL detection (bare URL, trailing punctuation, scheme rejection for `javascript:` / `data:` / `vbscript:` / `file:`); file path-with-line(-col) detection (grep, tsc-like, stack-trace-shaped); bare-path-with-extension detection (with separator, leading `./`, leading `../`); negative cases (`version 1.0.0`, `and/or`, `math.PI`, `1.2.3`); precedence (URL beats path; path-with-line beats path-with-ext; URL whose tail looks like a path stays a single token); coverage assertion (concatenating token texts MUST equal original input verbatim); overflow cap (6000 matches → 5000 links + suppression count).
- [ ] 1.2 Implement `packages/client/src/lib/linkify-tool-output.ts` exporting `tokenize(text: string): Token[]` where `Token = { kind: 'text' | 'url' | 'file', text: string, path?: string, line?: number, col?: number }`. Single linear pass. Recognised extension set per spec.
- [ ] 1.3 Add an adversarial fuzz-style test (≥ 50 random prose strings drawn from a corpus of common bash/grep/tsc/lint outputs) asserting zero false-positive file links on prose without code extensions.
- [ ] 1.4 Add a perf smoke test asserting tokenisation of a synthetic 2 MB grep-style result completes in < 250 ms (generous CI ceiling; design budget is 50 ms locally).
- [ ] 1.5 Verify: `npm test -- linkify-tool-output` green.

## 2. Link components

- [ ] 2.1 Add `packages/client/src/components/tool-renderers/UrlLink.tsx` — `<a target="_blank" rel="noopener noreferrer">` wrapper, blue underline-on-hover styling matching existing markdown link, reuses `isExternalHref` from `MarkdownContent` (export it if not already exported).
- [ ] 2.2 Add `packages/client/src/components/tool-renderers/FileLink.tsx` — receives `{ path, line?, col?, context: ToolContext }`. Click handler branches on `isLocalhost() && editors.length > 0`: localhost path calls `openEditor(cwd, editors[0].id, path, line)`; otherwise opens `FilePreviewOverlay`. Resolves relative path against `context.cwd` only at click time (logged into the link's `title` attribute so the resolved absolute path is visible on hover).
- [ ] 2.3 Add `packages/client/src/components/FilePreviewOverlay.tsx` — modal that fetches file content via the existing file-read endpoint, routes by extension (`.md` / `.mdx` → `MarkdownPreviewView`, image extensions → `ImageLightbox`, otherwise plain `<pre>` with line-numbered display jumping to `line` if provided). Read-only. Escape / backdrop click dismisses.
- [ ] 2.4 Add `packages/client/src/components/tool-renderers/LinkifiedText.tsx` — accepts `{ text, context }`, memoises `tokenize(text)`, maps tokens to `<UrlLink>` / `<FileLink>` / plain spans, renders inside an `ErrorBoundary` that falls back to `<pre>{text}</pre>` on throw. Inline-only layout, no padding / margin / `user-select` overrides, to preserve selection per spec.
- [ ] 2.5 Component tests: `LinkifiedText.test.tsx` (mixed URL + file + plain text snapshot, selection preservation via clipboard fixture), `FileLink.test.tsx` (localhost vs remote branch, `openEditor` mock, overlay mount), `UrlLink.test.tsx` (attrs + rejected schemes never reach this component).
- [ ] 2.6 Verify: `npm test -- LinkifiedText FileLink UrlLink` green.

## 3. Renderer integration

- [ ] 3.1 `GenericToolRenderer.tsx` — replace `<pre className="whitespace-pre-wrap ...">{result}</pre>` with `<LinkifiedText text={result} context={context}/>`. The args JSON block above is untouched. Add test asserting two-link rendering for a grep-style sample result and zero-link rendering for a `version 1.0.0` sample.
- [ ] 3.2 `BashToolRenderer.tsx` — wrap each stdout / stderr block in `LinkifiedText` so detection runs per-block (no cross-block matches). Add test for stderr-with-file-ref + stdout-with-URL.
- [ ] 3.3 Snapshot existing `ChatView` / `ToolCallStep` tests; update only those whose DOM intentionally changes (the linkified `<pre>` becomes a span tree). All other tests must remain untouched.

## 4. Cross-cutting

- [ ] 4.1 Export `isExternalHref` from `MarkdownContent.tsx` (or its util module) so `UrlLink` reuses the same gate. Add a test asserting `UrlLink` rejects a forged `javascript:` href even if tokenizer were bypassed.
- [ ] 4.2 Confirm `FilePreviewOverlay` file-read calls use the existing `cwd`-scoped read endpoint; add a test that a path containing `..` traversal outside `cwd` is rejected by the endpoint (existing behaviour — test guards regression).
- [ ] 4.3 Manual QA matrix: (a) localhost + VS Code detected → click `src/foo.ts:42` in a `bash` result opens VS Code at line 42; (b) localhost + no editor → opens preview overlay; (c) remote (non-localhost origin) → opens preview overlay; (d) mobile viewport → tap target reachable, overlay scrolls. Record results in PR description.

## 5. Docs & ship

- [ ] 5.1 Add row(s) for new files (`linkify-tool-output.ts`, `LinkifiedText.tsx`, `FileLink.tsx`, `UrlLink.tsx`, `FilePreviewOverlay.tsx`) to the matching `docs/file-index-client.md` and `docs/file-index-shared.md` splits in path-alphabetical order. Caveman style. Delegate to a subagent per AGENTS.md protocol.
- [ ] 5.2 Add a `CHANGELOG.md` entry under `## [Unreleased]` summarising the new linkified tool-output behavior.
- [ ] 5.3 `npm run build` then `curl -X POST http://localhost:8000/api/restart` then `npm run reload` per the OpenSpec-apply rebuild rule in AGENTS.md.
- [ ] 5.4 `npm test` full suite green.
- [ ] 5.5 `openspec verify --change linkify-tool-output` clean.
