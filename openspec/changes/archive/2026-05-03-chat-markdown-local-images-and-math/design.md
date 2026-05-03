## Context

The dashboard already has three working image-delivery paths, all sharing the same architectural principle: image bytes ride **inside** the existing event stream as base64, the dashboard server never opens arbitrary files for the client.

```
Path 1 — User pastes image (clipboard)
    Browser FileReader → base64 → send_prompt.images[] → bridge → pi
    Render: ImagePreviewStrip / ChatView.ImageAttachments via data: URLs

Path 2 — User's own message replayed in chat
    images[] persisted on the user message → ChatView.ImageAttachments
    Render: data: URLs

Path 3 — Read tool returns an image
    pi reads the file, emits tool_result with type:"image" content blocks
    → bridge forwards verbatim → state-replay extracts as images[] on the
    toolResult ChatMessage → ReadToolRenderer
    Render: data: URLs
```

The `MarkdownContent` component currently has no `img` component override. ReactMarkdown's default `img` emits a verbatim `<img src={…}>`. External URLs work because they resolve cross-origin. Local paths (`/abs/path`, `./relative`, `file://…`) become bad URLs against the dashboard origin and 404 silently.

LaTeX math is not parsed at all today — `MarkdownContent` configures only `[remarkGfm]` and `[rehypeRaw, stripReactRefAttributes]`. `$x = \beta$` reaches the rendered DOM as literal text.

The naive "rewrite the markdown text to embed `data:image/png;base64,…` URLs" approach fails on streaming. `message_update` events ship the full streaming text on every chunk (`event-reducer.ts:765–772`). A 5 MB image inlined into the text would re-ship on every subsequent chunk — for a typical 1000-token continuation, ~250 MB over the wire per message. Catastrophic on remote (zrok) connections.

## Goals / Non-Goals

**Goals**
- Local-path markdown image references (`![](localPath)`) render as the actual image in chat, with the same "image appears the moment its closing `)` arrives" UX that web images have today.
- Streaming bandwidth stays proportional to the assistant's *text* output even when many local images are referenced. Each unique image's bytes are transmitted exactly once per session.
- LaTeX math (inline `$…$` and display `$$…$$`) typesets correctly, matching GitHub / ChatGPT / Google rendering parity.
- The dashboard server's surface area is unchanged — no new REST routes, no new file-streaming endpoint, no new auth concerns.
- Replay and reconnect produce a chat that's visually identical to the live one, including all inlined images.

**Non-Goals**
- Pure-TUI rendering (pi-coding-agent's terminal renderer is a separate project).
- Local-image rewriting in non-chat markdown views (`MarkdownPreviewView`, `PackageReadmeDialog`) — those have different baseDir semantics and are out of scope for this change.
- Server-side image processing (resizing, format conversion, lazy decoding). Bytes pass through as-is.
- Lazy / on-demand image loading. Every unique referenced image is shipped once when first encountered.
- Extending the inliner to other resource types (audio, video, PDFs).
- Math editing or interactive math features. KaTeX is render-only.

## Decisions

### D1. Bridge does the inlining, not server, not client

**Decision**: The bridge (`packages/extension`) is the only component that reads files and produces image bytes for local-path markdown references.

**Rationale**: This mirrors the existing Read-tool path exactly — pi already has filesystem trust, the bridge runs in pi's process, and `command-handler.ts` already packages `ImageContent { data, mimeType, type:"image" }` for outbound user messages. Putting the work anywhere else either inverts the principle (server reads files for the client) or introduces a network round-trip (client fetches over WebSocket, defeating any latency story).

**Alternatives considered**:
- **Server-side `/api/file/raw` endpoint**: rejected. Inverts the architectural principle. Adds auth/MIME/traversal surface. Inconsistent with how the other three image paths work today.
- **Client-side fetch via a new WebSocket request/response**: rejected. Adds round-trip latency. Asynchronous render races against subsequent text chunks. Doesn't solve the streaming bandwidth problem.
- **Have the agent emit a Read-tool call instead of markdown**: rejected. Requires prompt/skill changes and depends on model cooperation. Doesn't help when models naturally write `![](…)`.

### D2. Sentinel + side-channel `asset_register` event

**Decision**: When the inliner encounters a local-path image token, it (a) emits a separate `asset_register` event carrying the bytes, then (b) rewrites the token in the assistant text to `![alt](pi-asset:<hash>)`. Subsequent occurrences of the same hash within the session emit no asset_register and only rewrite the token.

**Rationale**: The sentinel-token approach decouples bytes from text. Streaming text events (`message_update`) only carry the short `pi-asset:<hash>` token, which is repeatable across chunks at trivial cost. The bytes ride exactly once per unique hash in their own event. This is the only architecture that simultaneously delivers (a) seamless rendering on the closing `)` of each chunk and (b) bounded streaming bandwidth.

**Alternatives considered**:
- **Inline `data:` URL into the text**: bandwidth blowup on streaming as analyzed in Context.
- **Opaque server-assigned identifier instead of content hash**: rejected. Hash gives free deduplication across the session (and across sessions if we ever extend the registry) and is deterministic — same file = same hash = no extra event.
- **Inline only in `message_end` and skip rewriting `message_update`**: rejected. The user would see literal `![pic](/abs/path)` text scrolling by during streaming, then a snap at message_end. Not seamless.

### D3. URI scheme `pi-asset:<hash>`

**Decision**: Use a custom scheme `pi-asset:<hex-hash>` for the rewritten token in markdown text.

**Rationale**: Self-documenting, grep-able in event logs, unmistakably ours, no collision risk with web URLs, easy to detect in the client `img` override (`src.startsWith("pi-asset:")`).

**Alternatives considered**:
- **`cid:<hash>` (RFC 2392)**: standard, but less self-documenting in dashboard event logs and tooling. Tools that try to interpret it as a real CID could be surprised.
- **`/api/asset/<hash>`-style path**: tempts a future maintainer to add a server route that serves it. Custom scheme makes the no-server-route invariant visible.

### D4. Hash function: SHA-256 truncated to 16 hex chars

**Decision**: `sha256(fileBytes).hex.slice(0, 16)` — 64 bits of entropy, 16-char identifier in the event log.

**Rationale**: Collision probability inside a single session is vanishingly small (would need ~4 billion unique images to hit a 50% collision risk). Short enough to keep streaming chunks cheap. Deterministic across runs of the same image.

**Alternatives considered**: full sha256 (overkill, 64 chars in every chunk), md5/sha1 (fine cryptographically since we're not authenticating, but sha256 is the modern default and Node has it natively).

### D5. Per-session asset registry on Session state, in-memory only

**Decision**: Asset bytes live on `DashboardSession.assets: { [hash]: { data, mimeType } }`, populated by the server's `asset_register` switch arm. The client's event reducer maintains the same map. Subscription replay (WebSocket reconnect, `subscription-handler.ts`) re-emits every entry in `session.assets` as a fresh `asset_register` message before the events array, so reconnecting browsers see the full registry. Cold-start full-server-restart loses the bytes; older `pi-asset:<hash>` tokens in chat history display as the unresolved placeholder until either the bridge re-emits the asset (a fresh assistant message references the same file again) or the user accepts the missing image. This matches the existing pattern for Read-tool image bytes, which also live only in the in-memory event store and are lost on cold restart.

**Rationale**: The dashboard does NOT own a persistent event log — pi's `*.jsonl` files are entries (assistant text, tool calls, tool results) owned by pi-coding-agent, and the dashboard's events are in-memory only with LRU eviction. Adding a sidecar persistence file just for asset bytes would bloat `.meta.json` (`5 MB image × N images per session` is unacceptable for that file's role) or introduce a new on-disk format we'd have to garbage-collect. The accepted v1 trade-off is in-memory only with placeholder-on-cold-start.

**What survives what**:

| Action | Asset bytes survive? |
|---|---|
| Live message_update / message_end stream | yes — in-memory `Session.assets` |
| Browser WebSocket reconnect | yes — subscription replay re-emits |
| Browser refresh / new tab | yes — subscription replay re-emits |
| Memory event store LRU evicts the *referencing* event | yes — assets live on Session, not in the event buffer |
| Dashboard server restart | **no** — placeholder shows; next bridge re-attach with new assistant message restores |
| Pi process restart (same dashboard server) | yes — assets stay on the live Session object |

**Risks (handled in §Risks)**: cold-start full-server-restart is the visible miss. Acceptable for v1; can be lifted in a follow-up by adding a `<sessionFile>.assets/` sidecar directory if real-world usage shows users frequently scrolling back through long-archived chats with images.

### D6. Rewrite happens on every assistant `message_update` and `message_end`

**Decision**: The inliner runs on every `message_update` and `message_end` event with `role === "assistant"` (not on `message_start`, not on user messages, not on `thinking` deltas).

**Rationale**: Rewriting only at `message_end` defeats the streaming UX. Rewriting on every `message_update` ensures the closing `)` of an image triggers a render the moment it arrives. The inliner is idempotent on tokens already rewritten — `pi-asset:<hash>` is not a local path, so the regex skips it on subsequent chunks.

**Performance**: only fully-closed `![alt](src)` tokens are processed, and only those whose `src` looks local. Each unique hash is looked up against the per-session "already sent" set; cache hit = pure regex replace, no IO. Cache miss = single sha256 + single fs.read.

### D7. Path scope: any file the agent's process can read

**Decision**: No allowlist on `src` paths beyond "the bridge process can `fs.stat` and `fs.read` it as a regular file". Symlinks are followed; out-of-cwd paths are allowed.

**Rationale**: Per user direction. Pi's own Read tool already inlines arbitrary files the agent process can reach; the inliner mirrors that trust boundary. The dashboard adds no new surface area beyond what pi already exposes.

**Trade-off**: an agent that's compromised or instructed to leak arbitrary files via `![](…)` markdown can do so. But the same agent could already invoke its Read tool on the same paths and inline the bytes into a tool_result. This change does not widen the attack surface; it widens the *rendering* surface to match the existing trust surface.

### D8. Caps: 5 MB per image, 20 MB per message; SVG inlined as `image/svg+xml`

**Decision**:
- Per-image: refuse to inline if file > 5 MB; rewrite token to placeholder text `[image too large: <originalSrc> (<size>)]`.
- Per-message: track running total of bytes inlined per `message_update`/`message_end` cycle; once 20 MB exceeded, remaining tokens become `[message asset budget exhausted: <originalSrc>]`.
- MIME allowlist: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `image/avif`, `image/bmp`. Detected from file extension (case-insensitive). Files with non-image extensions become `[unsupported image type: <originalSrc>]`.

**Rationale**: Size caps protect bandwidth and the event log. SVG is included per user direction. Extension-based MIME detection avoids reading file headers; if the extension lies, the browser will fail to render the resulting `data:` URL — visible breakage rather than silent issue.

### D9. Math: remark-math + rehype-katex, both `$…$` and `$$…$$`, eager bundle, no auto-parsing of `$100`

**Decision**: Add `remark-math`, `rehype-katex`, `katex` as client dependencies. Wire `remarkMath` into `MarkdownContent`'s `remarkPlugins`. Wire `rehypeKatex` into `rehypePlugins`. Import `katex/dist/katex.min.css` once at app entry. Both single- and double-dollar delimiters enabled (`singleDollarTextMath: true`).

**Rationale**: Per user direction (parity with GitHub, ChatGPT, Google). `$100`-as-text remains a known footgun, accepted by all three reference renderers; users learn to escape (`\$100`) when needed.

**Bundle**: KaTeX is ~280 KB JS + ~70 KB CSS, eager-loaded with the rest of `MarkdownContent`. Lazy-loading is a future optimization; not worth the complexity in v1.

**Plugin ordering**: `[rehypeRaw, rehypeKatex, stripReactRefAttributes]`. rehypeRaw comes first so it parses any embedded HTML before rehype-katex emits its own KaTeX HTML (which we *don't* want re-parsed). Verified against rehype-katex's documented expectations.

**Streaming half-written math**: `throwOnError: false` so KaTeX renders the source as fallback when it sees `$x = 10 +` mid-stream rather than throwing. The half-formed math vanishes / corrects when the closing delimiter arrives in the next chunk.

### D10. Asset state delivery to MarkdownContent: React context

**Decision**: A new `SessionAssetsContext` provides the per-session `Map<hash, { data, mimeType }>` to any descendant `MarkdownContent`. `ChatView` populates the provider from its session state.

**Rationale**: `MarkdownContent` is rendered in many places (assistant body, streaming text, thinking blocks, agent / ask-user / get-subagent-result tool renderers). Threading a `sessionAssets` prop through all of them is noisy. A context defaulting to an empty map keeps non-chat callers (`PackageReadmeDialog`, `MarkdownPreviewView`) safe — they see no `pi-asset:` tokens in practice, and if one ever appeared, it'd render as a broken image link, which is the same as today's behavior for any unresolvable URL.

### D11. Memory event store is NOT involved in asset persistence

**Decision**: `asset_register` is a top-level protocol message handled by `event-wiring.ts` directly, NOT a `DashboardEvent` shipped through `eventStore.insertEvent`. The bytes go straight to `Session.assets`; the in-memory event store never sees them. Therefore the existing "preserve base64 image data — skip truncation when sibling mimeType exists" guard in `memory-event-store.ts` is unrelated to this change and needs no modification.

**Rationale**: Putting the bytes through `eventStore` would (a) duplicate them in two places, (b) subject them to the LRU eviction that we're explicitly avoiding (R1 mitigation), and (c) make the `getEvents(sessionId, minSeq)` API's contract weirder (asset_register isn't really an event in the per-session timeline; it's a registry update).

## Risks / Trade-offs

- **R1. Asset-event LRU eviction → broken images on long sessions** → Mitigation: store assets on the Session object (pinned) rather than relying on event-buffer presence. Memory event store can still age out the asset_register *event*, but the resolved asset bytes live on Session and survive eviction. Reducer applies `asset_register` events into Session at reduce-time.

- **R2. Bandwidth blowup if an agent loops referencing many distinct images** → Mitigation: per-message 20 MB cap (D8). Beyond that, placeholder text. Cap is per-message, not per-session, by design — a long chat with many distinct screenshots is fine; a single hostile message with 100 large images is not.

- **R3. Hash collision** → 64-bit truncated SHA-256 has a birthday-bound of ~2^32 unique images for 50% collision risk. Single session never approaches this. Cross-session: the registry is per-session, so collision impact is bounded to one session. Acceptable.

- **R4. Streaming half-rendered math** → Mitigation: `throwOnError: false` in KaTeX (D9). Mid-stream `$x = 10 +` shows a fallback rendering of the source until the closing `$` arrives in the next chunk.

- **R5. `$100`-as-math footgun** → Accepted (D9). Users learn to escape (`\$100`). Same behavior as GitHub / ChatGPT / Google.

- **R6. SVG attack surface** → SVGs can carry inline scripts. Mitigation: rendered via `<img src="data:image/svg+xml;base64,…">`. The browser's image sandbox forbids script execution in SVG-as-image (as opposed to SVG-as-document). Standard, well-known property of `<img>` rendering of SVG.

- **R7. Symlink / out-of-cwd reads** → Accepted per D7. The agent's Read tool already crosses these boundaries.

- **R8. Bundle size** → KaTeX adds ~350 KB to the initial bundle. Not lazy-loaded in v1 (D9). If we later care, the lazy-load split is straightforward (React.lazy on the math-aware MarkdownContent variant).

- **R9. `pi-asset:<hash>` token in user-authored content** → If a user copy-pastes assistant text containing `pi-asset:<hash>` and re-sends it, the client renders it (because the asset is in the session map). If the user opens that text in a different session where the asset doesn't exist, it renders as a broken-image link. Acceptable.

- **R10. Backward compatibility with old clients** → A client that doesn't recognize `pi-asset:` tokens displays the original `<img src="pi-asset:abc...">` as a broken image link. Bridge and client are versioned in lockstep in this repo, so this matters only for plugin consumers parsing protocol events directly.

## Migration Plan

No data migration. Existing sessions never contain `asset_register` events or `pi-asset:` tokens; new sessions accumulate them as they're created. Rollback = revert the change set; old sessions don't reference the new event type.

The change is additive on the protocol — `asset_register` is a new message type added to the relevant unions; existing message types are untouched. A bridge from a future version that emits `asset_register` connecting to a server from before this change would have the event silently dropped (server's switch statement falls through), which is a tolerable degradation.

## Open Questions

None — all design questions resolved through the prior conversation. The user explicitly answered:
1. Path scope: any file the agent can read.
2. Caps: 5 MB / 20 MB.
3. SVG: inline.
4. Streaming: seamless like web images (resolved via D2/D6).
5. Math: both `$…$` and `$$…$$`.
