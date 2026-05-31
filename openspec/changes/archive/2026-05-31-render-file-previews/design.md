## Decisions

### D1. `/view` is dashboard-local, not a real pi command

Two paths considered: (a) intercept `/view` in `CommandInput` before send, never round-trip through the bridge; (b) register `/view` as a real pi slash command that round-trips through `command-handler.ts` and renders a special event back to the client.

**Chosen: (a) intercept in composer.** Rationale:
- The agent has no use for "the user is looking at a PDF". This is purely a human-UI concern.
- Path (b) would force a new event type, a new dashboard-only render variant, and a new bridge round-trip for what is fundamentally a UI navigation. Wasted plumbing.
- Path (a) cost: one new `onViewLocal` prop on `CommandInput`, threaded to `App.tsx` which injects a `view`-kind `ChatMessage` into the session's message list (server-persisted so it survives reload — see D2).

**Tradeoff:** dashboard-local commands can drift from real pi commands (different parse rules, different autocomplete behaviour). Mitigated by keeping the `/view` interception cohesive in one place (a `DASHBOARD_LOCAL_COMMANDS` map exported alongside `BUILTIN_COMMANDS`).

### D2. Inline render + expand-to-overlay (not overlay-only)

The card renders inline in `ChatView` as a chat-message row. A small `⤢` icon button in the card's top-right corner navigates to the same renderer in a full-screen overlay route. Both surfaces share the per-format renderer components — overlay is just the same component in a different shell.

**Why inline by default:** users want quick previews ("show me the PDF") without losing context of the conversation. Overlay-only would force a navigate-away-and-back round trip for every glance.

**Why both:** PDFs and videos are real-estate-hungry; the chat column is narrow. The overlay variant gives the renderer the full viewport.

**Size policy for inline:**
- Markdown / AsciiDoc / HTML — natural height, capped at `max-h-[60vh]` with internal scroll
- PDF — fixed `h-[60vh]`, internal page navigation
- Video / YouTube — 16:9 aspect ratio, `max-w-full` width
- Image — natural size, capped at `max-h-[40vh] max-w-full`

### D3. Persisted as a ChatMessage variant, not ephemeral

Two options for "where does the preview live":
- (a) Pure client-side ephemeral state — lost on reload, lost when component unmounts.
- (b) Persisted as a `ChatMessage` with `view?: ViewTarget` field — stored on the server like any other message.

**Chosen: (b).** Rationale:
- Matches the existing `SkillInvocationCard` pattern (user-typed `/skill:foo` becomes a persisted ChatMessage that the client renders specially).
- Survives reload — "I /viewed that PDF an hour ago" doesn't vanish.
- Cross-device — if you view the same session on phone + laptop, both see the same preview row.

**Filtering before pi:** the bridge already forwards a curated message stream to pi. We add a single filter rule: messages with `view` field set are stripped (or have their `content` field stripped to empty) before forwarding. The agent never sees them. This filter lives in the existing message-forwarding code in `packages/extension/`.

### D4. `@` autocomplete pool extended to URLs, current-session only

The existing `@` autocomplete fires `onListFiles(query)` which round-trips to the bridge for file enumeration. We extend the dropdown to *also* show URLs extracted from the current session's chat history, surfaced purely client-side from `ChatMessage[]` already loaded in memory.

**Why client-side:** zero new server work; the messages are already there; URL extraction is a pure function over an array. No persistence concerns.

**Why current session only:** cross-session would require either a server-side index or loading every session's messages on the client. Both are disproportionate to the value ("scroll to find URL").

**Pool composition rule:**
```
extractRecentUrls(messages):
  • Iterate newest → oldest
  • For each msg: extract all `https?://\S+` (greedy, stop at whitespace/`)`/`"`)
  • Push into result if not already present
  • Stop after 50 unique URLs
  • Return result (newest-first)
```

**Dropdown ranking when `@<q>` matches both files and URLs:**
- Files first (existing flow), URLs after
- Within URLs, newest-first
- Substring match on URL or its host

**Open question (deferred):** "no @ prefix, just a bare URL" — `/view https://…` works because the composer parses the second token. The dropdown helps complete partial URLs (`/view @youtu`), at which point both file matches and URL matches appear.

### D5. Server-side AsciiDoc rendering

AsciiDoc has two viable JS implementations:
- `asciidoctor` (npm) — pure-JS port of the Ruby reference impl. Full-featured. ~600 KB.
- `@asciidoctor/core` — same engine, slightly leaner API surface.

**Chosen: server-side, `asciidoctor`.** Rationale:
- Keeps ~600 KB out of the web client bundle. Same reasoning as why Mermaid is rendered in-browser (it's optional + chunked) but heavyweight transformations live on the server.
- Sanitization is easier server-side (run in `safe: "secure"` mode which already strips includes / dangerous attributes).
- Endpoint: `GET /api/file/render?cwd=&path=` returns `{ html }`. Client `<AsciiDocPreview>` fetches once, renders with `dangerouslySetInnerHTML` — safe because the server guarantees sanitization.

**Caching:** none in v1. Re-render on every mount. AsciiDoc files are small; the latency is bounded; cache invalidation on file change is its own ticket.

### D6. PDF: `pdfjs-dist`, lazy-loaded

User asked for `pdfjs-dist` over native `<iframe>` or `react-pdf`. Rationale (matches their reasoning):
- Consistent UX across browsers (Firefox's pdf.js viewer ≠ Chrome's ≠ Safari's)
- Dark-mode CSS controllable
- Page navigation we control
- Programmatic zoom / search later if wanted

**Bundle cost mitigation:** `React.lazy(() => import('./PdfPreview'))` — pdfjs only loads when a PDF preview actually mounts. Cold paint of the dashboard pays nothing.

**Worker policy:** pdfjs requires a worker. We ship the worker as a static asset under `packages/client/public/pdf.worker.min.js` (matching how other static assets are served) and set `GlobalWorkerOptions.workerSrc` to that path.

### D7. HTML preview: local files only, sandboxed iframe

T9 split HTML into two threat models:
- (i) Local `.html` files from the workspace — trusted source (your disk)
- (ii) HTML in chat content — untrusted, distinct sanitization story

**Chosen: (i) only.** `<HtmlPreview>` fetches `/api/file/raw?...` and renders via `<iframe sandbox="allow-same-origin" srcdoc={html}>`. The sandbox attribute disables scripts, forms, top-level navigation, and popups by default — only `allow-same-origin` is granted so relative URLs to assets in the same workspace work. No `allow-scripts`.

**Why not DOMPurify:** sanitizers fight an arms race with bypass tricks. `<iframe sandbox>` is the browser-native isolation primitive — strictly stronger guarantee than any DOM-level sanitizer.

**(ii) explicitly out of scope.** If we later want to render HTML from chat content (e.g. agent output), that's a separate proposal with its own threat model.

### D8. Binary-safe file serving: new endpoint, not extension of `/api/file`

`/api/file` returns `{type: "file", content: <utf-8 string>}` today. Changing that shape would break every existing caller. New endpoint `/api/file/raw` returns the bytes directly with proper `Content-Type`. The two coexist:
- `/api/file` — text content for caller-side rendering (markdown, code, etc.)
- `/api/file/raw` — bytes for `<img>` / `<video>` / `<iframe>` / pdfjs `getDocument`

**Anti-traversal:** identical gate to `/api/file` — `cwd` must match a known session cwd, `path.resolve(cwd, relPath)` must stay inside `cwd`. Reuse `resolveSafePath` (extract if not already extracted).

**MIME mapping:** small `ext → Content-Type` table in a new `packages/server/src/lib/mime-types.ts`. Default `application/octet-stream` for unknowns.

**Range requests:** Fastify's `sendFile` (via `@fastify/static`) handles `Range` headers natively. Use that for the streaming path. Required for video seek-bar to work.

### D9. Renderer dispatch: extension + URL pattern, no MIME sniffing

`dispatchPreview(target): RendererKind` is purely shape-based:
- File target → switch on `path.extname(target.path).toLowerCase()`
- URL target → switch on host first (`youtube.com` / `youtu.be` / `m.youtube.com`), fall back to URL extension, fall back to "open in new tab"

**Why no MIME sniffing:** would require a server round-trip just to choose a renderer. Extensions cover ~99% of real cases; the fallback ("we don't know how to render this") is acceptable.

**Future-proofing:** the dispatch table is a single exported `RENDERER_BY_EXT` map. Adding `.epub` later is one line.

### D10. Composer parse rule for `/view`

`/view` arg parsing is deliberately tiny:
```
Input:  "/view @docs/foo.md"          → ViewTarget { kind: "file", cwd: <session.cwd>, path: "docs/foo.md" }
Input:  "/view https://youtu.be/xyz"  → ViewTarget { kind: "url",  url: "https://youtu.be/xyz" }
Input:  "/view"  (no arg)             → no-op (don't submit; show inline hint "needs a target")
Input:  "/view <whitespace-only>"     → same as no-arg
Input:  "/view foo bar"               → no-op + hint (must be @-file or URL, single token)
```

Rationale: keep the dashboard-local parser minimal. No globs, no multi-target, no flags. If we need those later they're additive.

## Open questions

- **Q1**: YouTube title resolution. The card shows `<title>` when known. Cheapest path: server endpoint that fetches the YouTube oEmbed JSON (`https://www.youtube.com/oembed?url=…&format=json`) and returns title + thumbnail. v1 ships **without** this — card shows raw URL. Title resolution is its own follow-up if wanted.
- **Q2**: Per-session preview density limit. Could a malicious agent flood the chat with `/view`-equivalent ChatMessages? `/view` is human-typed, never agent-typed (the agent has no message channel that injects `view?:` field — only the dashboard-local `onViewLocal` path does). Safe by construction.
- **Q3**: Cache for `/api/file/render` (AsciiDoc). Deferred. AsciiDoc files are small; the rendering is bounded; if it becomes a problem, add ETag based on file mtime + size.

## Risks

- **R1**: `pdfjs-dist` bundle size. Mitigated by `React.lazy`. Verify via `npm run build` + look at the chunk graph — the PDF chunk must NOT appear in the main `index-*.js` bundle.
- **R2**: `asciidoctor` server-side compile time. The first `require('asciidoctor')()` call is heavy (Opal runtime init). Acceptable as a one-time per-process cost; the server is long-running.
- **R3**: `view`-ChatMessage filter regression. If the filter is missed in any forwarding path, the agent sees `view` rows as zero-content messages. Mitigation: filter at the single source-of-truth point (bridge message-forwarding), with a test.
- **R4**: `@`-autocomplete URL extraction performance. `extractRecentUrls` runs on every `@`-trigger keystroke. With 1000+ messages this could lag. Mitigation: `useMemo` over `messages` so the result recomputes only when message list changes, not on every keystroke.
