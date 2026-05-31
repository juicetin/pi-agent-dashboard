## 1. Shared types

- [ ] 1.1 Add `ViewTarget` discriminated union to `packages/shared/src/types.ts`:
  - `{ kind: "file"; cwd: string; path: string }`
  - `{ kind: "url"; url: string }`
- [ ] 1.2 Add `view?: ViewTarget` optional field to `ChatMessage` in the same file. Additive, backward-compat.
- [ ] 1.3 Re-export from `packages/shared/src/index.ts`.
- [ ] 1.4 Type-check `npm run typecheck` clean across all workspaces.

## 2. Server — binary-safe file serving

- [ ] 2.1 Create `packages/server/src/lib/mime-types.ts` with `extToContentType(ext): string` covering `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.mp4`, `.webm`, `.mov`, `.html`, `.htm`, `.txt`, `.md`, `.adoc`, `.asciidoc`. Default `application/octet-stream`.
- [ ] 2.2 Add `GET /api/file/raw?cwd=&path=` to `file-routes.ts`. Reuse anti-traversal gate from `/api/file`. Use Fastify `reply.send(stream)` with `fs.createReadStream` so `Range` headers work for video seek.
- [ ] 2.3 Set `Content-Type` from `extToContentType`, `Content-Disposition: inline`, `Cache-Control: private, max-age=60`.
- [ ] 2.4 Tests: cwd-allowlist enforcement, traversal rejection (`../`), MIME mapping correctness, 404 on missing file, range request returns 206.

## 3. Server — AsciiDoc rendering

- [ ] 3.1 Add `asciidoctor` to `packages/server/package.json` dependencies.
- [ ] 3.2 Add `GET /api/file/render?cwd=&path=` to `file-routes.ts`. Reject extensions other than `.adoc` / `.asciidoc` with HTTP 400 `{ error: "renderer not supported for extension" }`.
- [ ] 3.3 Initialize `asciidoctor` lazily (module-level singleton, first-call init).
- [ ] 3.4 Convert with `safe: "secure"` mode. Return `{ success: true, data: { html: "<rendered>" } }`.
- [ ] 3.5 Tests: rejects `.md`, accepts `.adoc`, renders sample, sanitizes a malicious include directive (e.g. `include::/etc/passwd[]` must be neutralized).

## 4. Client — preview dispatch + URL extraction

- [ ] 4.1 Create `packages/client/src/lib/preview-dispatch.ts` exporting `dispatchPreview(target: ViewTarget): RendererKind` plus the `RENDERER_BY_EXT` map. Renderer kinds: `"markdown" | "asciidoc" | "html" | "pdf" | "video" | "image" | "youtube" | "fallback"`.
- [ ] 4.2 Unit tests: every covered extension maps to expected renderer; YouTube hosts (`youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`) → `"youtube"`; unknown extension → `"fallback"`.
- [ ] 4.3 Create `packages/client/src/lib/extract-urls.ts` exporting pure `extractRecentUrls(messages: ChatMessage[]): string[]`.
- [ ] 4.4 Unit tests: newest-first ordering, dedup, 50-cap, trailing-punctuation stripping, no-URL → empty.

## 5. Client — per-format renderer components

Path: `packages/client/src/components/preview/`

- [ ] 5.1 `MarkdownPreview.tsx` — fetches `/api/file?cwd=&path=`, passes content to existing `<MarkdownContent>`. Handles loading / error.
- [ ] 5.2 `AsciiDocPreview.tsx` — fetches `/api/file/render?cwd=&path=`, renders via `dangerouslySetInnerHTML`. Wraps in `.asciidoc-body` class for scoped CSS.
- [ ] 5.3 `HtmlPreview.tsx` — fetches `/api/file/raw?cwd=&path=` as text, renders in `<iframe sandbox="allow-same-origin" srcdoc={html}>`. NO `allow-scripts`.
- [ ] 5.4 `PdfPreview.tsx` — uses `pdfjs-dist` via dynamic `import()`. Set `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"`. Render with page nav (`Prev` / `Next` / `Page X of Y`).
- [ ] 5.5 `VideoPreview.tsx` — `<video src={rawUrl(target)} controls preload="metadata">`. 16:9 aspect.
- [ ] 5.6 `ImagePreview.tsx` — `<img src={rawUrl(target)} alt={target.path}>`. Capped via `max-h-[40vh] max-w-full`.
- [ ] 5.7 `YouTubePreview.tsx` — extract video id via regex from URL, render `<iframe src="https://www.youtube.com/embed/{id}" allowFullScreen>`. 16:9 aspect.
- [ ] 5.8 `FallbackPreview.tsx` — for file targets: "We can't preview this file. [Download]" linking to `/api/file/raw`. For URL targets: "[Open in new tab]" linking to the URL.
- [ ] 5.9 Add `pdfjs-dist` to `packages/client/package.json` dependencies.
- [ ] 5.10 Copy `pdf.worker.min.js` to `packages/client/public/` during build (postinstall script or Vite static-asset config).

## 6. Client — PreviewCard shell + overlay routes

- [ ] 6.1 Create `packages/client/src/components/PreviewCard.tsx`. Props: `target: ViewTarget`. Renders header (icon + target label + `⤢ expand` button), body (the dispatched renderer). Inline size policy per design D2.
- [ ] 6.2 Tests: dispatches each renderer kind, `⤢` button navigates to overlay route with correct query params.
- [ ] 6.3 Add overlay route `/folder/:encodedCwd/view?path=…` in `App.tsx` shell-overlay matcher.
- [ ] 6.4 Add overlay route `/pi-view?url=…` in `App.tsx`.
- [ ] 6.5 Reuse `MarkdownPreviewView`'s shell (back button, loading) for the overlay variant — extract common layout if needed.

## 7. Client — ChatView integration

- [ ] 7.1 In `ChatView.tsx`, branch on `msg.view`. When set, render `<PreviewCard target={msg.view} />` in place of the default bubble.
- [ ] 7.2 Tests: a message with `view: { kind:"file", ... }` renders `<PreviewCard>`, not the default user/agent bubble.

## 8. Client — CommandInput `/view` interception + URL autocomplete

- [ ] 8.1 Export `DASHBOARD_LOCAL_COMMANDS` from `CommandInput.tsx` with `{ name: "view", description: "Preview a file or URL inline", source: "builtin" }`. Merge into `commands` list so it appears in `/`-autocomplete dropdown.
- [ ] 8.2 New prop `onViewLocal?: (target: ViewTarget) => void`. Threaded from `App.tsx`.
- [ ] 8.3 In submit handler, detect `text` starting with `/view ` (or exactly `/view`). Parse second token:
  - Starts with `@` → strip `@`, build `{ kind: "file", cwd: <currentSession.cwd>, path: <rest> }`. Call `onViewLocal`, clear draft, **do not** call `onSend`.
  - Matches `^https?://` → `{ kind: "url", url: <token> }`. Same flow.
  - Empty or malformed → no-op (do not submit). Optional inline hint via `imageError`-style banner.
- [ ] 8.4 Extend `@` autocomplete: when `isAtMode`, also call `extractRecentUrls(messages)` (new optional prop `sessionMessages?: ChatMessage[]`), filter by `atQuery` substring (URL or host), append matched URLs to the dropdown items after the file rows.
- [ ] 8.5 Dropdown renders globe icon for URL entries; selecting a URL entry replaces the `@<q>` with the URL (no `@` prefix in the inserted text).
- [ ] 8.6 Tests: `/view` listed in command dropdown; submitting `/view @foo.md` calls `onViewLocal` and does not call `onSend`; submitting `/view https://youtu.be/x` calls `onViewLocal`; submitting `/view` with no arg is a no-op; `@` dropdown surfaces URL matches when chat has URLs.

## 9. App.tsx wiring + ChatMessage injection

- [ ] 9.1 In `App.tsx`, define `handleViewLocal(target: ViewTarget)`. It dispatches a new browser→server WS message `inject_view_message { sessionId, target }` (or equivalent: pick the existing pattern that adds a ChatMessage to a session — likely via the bridge's `chat_message` event).
- [ ] 9.2 Thread `handleViewLocal` to `CommandInput` via `onViewLocal` prop.
- [ ] 9.3 Pass `sessionMessages={selectedSessionMessages}` to `CommandInput` for the `@`-URL extraction.

## 10. Server-side ChatMessage persistence + agent filter

- [ ] 10.1 Server handler for `inject_view_message`: append a `ChatMessage { role: "user", content: "", view: target, ... }` to the session's message list. Broadcast like any other ChatMessage update.
- [ ] 10.2 In the bridge / message-forwarding path (`packages/extension/`), filter out messages with `view` field set before sending to pi. Locate the existing forwarder (search for the message → pi handoff point) and add the filter.
- [ ] 10.3 Tests: a session with mixed `view` + regular messages forwards only the regular ones to pi.

## 11. Documentation

- [ ] 11.1 Update `docs/file-index-client.md` with new files in path-alphabetical order (caveman style). Delegate to subagent per AGENTS.md.
- [ ] 11.2 Update `docs/file-index-server.md` with `mime-types.ts` + new endpoints. Subagent.
- [ ] 11.3 Update `docs/file-index-shared.md` with `ViewTarget` + `ChatMessage.view`. Subagent.
- [ ] 11.4 Update `docs/faq.md` with one entry: "How do I preview a PDF / video / AsciiDoc in the dashboard?" → `/view @path` or `/view <url>`. Subagent.

## 12. Verification

- [ ] 12.1 `npm run typecheck` clean.
- [ ] 12.2 `npm test` clean.
- [ ] 12.3 `npm run build` — verify `pdfjs-dist` is in a lazy chunk, not the main bundle. `ls -la packages/client/dist/assets/ | grep -i pdf` should show a separate chunk.
- [ ] 12.4 Manual smoke: spawn a session, type `/view @README.md` → markdown card appears inline. Click `⤢` → overlay opens. Type `/view https://youtu.be/dQw4w9WgXcQ` → YouTube embed appears.
- [ ] 12.5 Manual smoke: type `/view @some.pdf` → PDF viewer with page nav. Type `/view @clip.mp4` → video plays, seek works (Range requests).
- [ ] 12.6 Manual smoke: chat contains a YouTube URL from the agent. Type `@youtu` in composer → dropdown surfaces the URL. Pick it. Submit `/view <url>` → embed renders.
- [ ] 12.7 Restart server, reload page → previously-viewed cards still appear in chat history (persistence verification).
- [ ] 12.8 Confirm agent did not "see" the `/view` actions: check pi's view of the message stream excludes `view`-rows.
