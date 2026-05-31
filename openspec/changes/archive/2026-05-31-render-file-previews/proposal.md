## Why

The dashboard's only first-class preview surface today is markdown. `MarkdownContent` renders chat / READMEs / pi-resources; `MarkdownPreviewView` provides a reusable preview shell. Everything else — PDFs, videos, AsciiDoc, raw HTML, YouTube links — has no rendering path. `/api/file` even mangles binary by force-decoding UTF-8, so a curious user who types a path expecting a PDF gets a wall of bytes.

The composer already has the right input shape: `CommandInput.tsx` ships both `/`-command autocomplete and `@`-file autocomplete (via `extractAtQuery` + `DropdownMode`). What's missing is (a) a `/view` command that maps a target — file path, YouTube link, arbitrary URL — to a renderer, (b) a dispatch shell that picks the right renderer by extension / MIME / URL pattern, (c) the per-format renderer components, and (d) a binary-safe file-serving endpoint.

This change adds all four, plus extends the `@` autocomplete pool with URLs scraped from the current session's chat so YouTube/PDF links surfaced by the agent are one keystroke away.

## What Changes

- **NEW**: `/view` dashboard-local slash command. Intercepted in `CommandInput` before the send pipeline — never reaches the bridge, never reaches the agent. Syntax: `/view <target>` where `<target>` is either an `@`-completed file reference or a bare URL. Renders inline in `ChatView` as a `PreviewCard` (see below), with an `⤢ expand` icon that opens the same renderer in a full-screen overlay route.
- **NEW**: `PreviewCard` chat-message variant. New `ChatMessage.view?: ViewTarget` field on the shared `ChatMessage` type (discriminated union: `{ kind: "file"; cwd; path }` or `{ kind: "url"; url }`). Persisted by the server like any other ChatMessage so previews survive reload and follow the session across devices. Filtered out of the message stream forwarded to pi/the agent — this is a UI artifact, not chat content.
- **NEW**: Per-format renderer components under `packages/client/src/components/preview/`:
  - `MarkdownPreview.tsx` — thin wrapper over existing `MarkdownContent`
  - `AsciiDocPreview.tsx` — fetches server-rendered HTML, renders sanitized
  - `HtmlPreview.tsx` — local `.html` files only; renders in `<iframe sandbox="allow-same-origin">`. Untrusted-HTML-from-chat is **explicitly out of scope** for this change.
  - `PdfPreview.tsx` — `pdfjs-dist`-based viewer with page nav + dark-mode CSS
  - `VideoPreview.tsx` — `<video src=raw controls>` for `.mp4`/`.webm`/`.mov`
  - `ImagePreview.tsx` — `<img src=raw>` for `.png`/`.jpg`/`.gif`/`.svg`/`.webp`
  - `YouTubePreview.tsx` — extracts video id, renders YouTube `<iframe>` embed
- **NEW**: `lib/preview-dispatch.ts` — pure `dispatchPreview(target): RendererKind`. File targets dispatch by extension (case-insensitive); URL targets dispatch by host pattern (YouTube) then by URL extension (PDF/image/video) then "open in new tab" fallback. Single source of truth, exported for testing.
- **NEW**: `lib/extract-urls.ts` — pure `extractRecentUrls(messages: ChatMessage[]): string[]`. Scans the current session's messages (user + agent + tool output), regex `https?://\S+`, dedupes preserving newest-first order, caps at 50. No cross-session, no historical sessions.
- **MODIFIED**: `CommandInput.tsx` — three additions:
  1. Recognize `/view` as a dashboard-local command (alongside the existing built-ins). Submitting `/view` does not call `onSend`; it constructs a `ViewTarget` and calls a new `onViewLocal(target)` prop which the host wires to inject a `view`-kind ChatMessage into the session.
  2. Extend `@` autocomplete to include URLs from `extractRecentUrls` alongside file results. New `FileEntry`-like discriminated union surfaced to the dropdown; rendering distinguishes file rows (folder/file icon) from URL rows (globe icon).
  3. When the typed text is exactly `/view ` (with trailing space), accept either an `@`-prefixed file (existing flow) or a bare URL token (new — completed by recent-URL dropdown).
- **MODIFIED**: `ChatView.tsx` — render `ChatMessage` rows whose `view` field is set as `<PreviewCard>` instead of the default user/agent bubble. Card shows the target (file path / URL / YouTube title-if-resolvable), the renderer output, and the `⤢ expand` button which navigates to the overlay route.
- **NEW**: Overlay routes — `/folder/:encodedCwd/view?path=…` for file targets and `/pi-view?url=…` for URL targets. Both reuse the per-format renderer components in a full-screen `MarkdownPreviewView`-style shell (back button, loading/error states). Added to `App.tsx`'s shell-overlay route table next to the existing six overlays.
- **NEW**: Server endpoints under `packages/server/src/routes/file-routes.ts`:
  - `GET /api/file/raw?cwd=&path=` — streams file bytes with `Content-Type` derived from extension (`application/pdf`, `video/mp4`, `image/png`, …). Same cwd-allowlist anti-traversal gate as `/api/file`. Sets `Content-Disposition: inline`. No size cap (let the browser handle range requests for video).
  - `GET /api/file/render?cwd=&path=` — AsciiDoc-only at this iteration. Runs `asciidoctor` server-side, sanitizes output (`safe: "secure"` mode), returns `{ html }`. Rejects non-`.adoc`/`.asciidoc` with 400.
- **MODIFIED**: `shared/types.ts` — add `ChatMessage.view?: ViewTarget` field plus the `ViewTarget` discriminated union. Additive, backward-compatible.
- **MODIFIED**: ChatMessage filter on the path from server → pi extension — `view`-kind messages are stripped before forwarding to the agent so they never enter the LLM context.
- **NEW DEPS**:
  - Server: `asciidoctor` (the canonical pure-JS port; ~600 KB but server-side, not shipped to clients)
  - Client: `pdfjs-dist` (~1.5 MB; lazy-loaded only when a PDF preview mounts, via `React.lazy` + dynamic `import()`)
- **NOT INTRODUCED**: Rendering HTML from chat content (T9 deferred — explicit out-of-scope, distinct threat model)
- **NOT INTRODUCED**: Cross-session URL history in `@` autocomplete (T10 — current session only)
- **NOT INTRODUCED**: Agent-visible "the user just viewed X" signal — `/view` is purely a UI action; the agent has no way to observe it
- **NOT INTRODUCED**: Editing from the preview (read-only; use the existing editor pane for edits)
- **NOT INTRODUCED**: A generic "open external link in tab" framework — the YouTube embed is special-cased because YouTube is special-cased everywhere

## Capabilities

### New Capabilities

- `file-and-url-preview` — Per-MIME / per-host renderer dispatch and rendering for files (md, adoc, html, pdf, video, image) and URLs (YouTube). Defines the `ViewTarget` shape, dispatch rules, and per-renderer expectations.
- `view-slash-command` — Dashboard-local `/view` slash command. Defines composer interception, the `view`-kind ChatMessage, agent-filter behaviour, the overlay routes, and the `@`-autocomplete extension for recent URLs.

### Modified Capabilities

(none — both capabilities are new; existing capabilities `chat-display-preferences`, `dashboard-slash-commands`, etc. are unaffected)
