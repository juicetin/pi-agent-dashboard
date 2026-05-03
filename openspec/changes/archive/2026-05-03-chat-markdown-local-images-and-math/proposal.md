## Why

Today the chat's markdown renderer renders web images (`![logo](https://…)`) but silently drops local-file images (`![pic](/abs/path.png)` or `![pic](./shot.png)`), and renders LaTeX-style math (`$x = \beta$`, `$$\sum_i$$`) as literal dollar-bracketed text. These are the two highest-impact gaps in the assistant-message rendering surface — agents routinely reference local screenshots and write inline math, and both currently look broken to end users.

The local-image gap can't be solved by a server-side file-streaming endpoint because that would invert the dashboard's existing architectural principle: image bytes ride **inside** the event stream as base64 (Read-tool images, pasted user images), the dashboard server **never** opens arbitrary files for the client. We must keep that invariant and solve the gap on the bridge side. We also have to preserve "seamless web-image-like" UX during streaming — the image must appear the moment the closing `)` of a markdown image arrives in any chunk, without re-shipping the bytes on every subsequent `message_update`.

## What Changes

- **Bridge-side markdown image inliner** — the bridge intercepts assistant `message_update` and `message_end` events, scans the text for fully-closed `![alt](src)` tokens with local-path srcs, reads each file, hashes its contents, and emits a side-channel `asset_register` event with the bytes (base64) the first time it sees a given hash. The token in the assistant text is rewritten in place to `![alt](pi-asset:<hash>)`. Same hash referenced again ships zero bytes — only the short token. Files outside the agent process's read permissions, oversized, or non-image-MIME are replaced with a visible placeholder text (`[image not found: …]`, `[image too large: …]`).
- **New `asset_register` protocol message** in the bridge → server and server → browser unions, carrying `{ sessionId, hash, mimeType, data }`. Persisted into the session event log alongside the originating `message_update` so reconnect/replay produces the asset before the message that references it.
- **Client `pi-asset:` resolver** — the `MarkdownContent` component gains an `img` component override that resolves `pi-asset:<hash>` srcs against a per-session asset map (populated by the event reducer from `asset_register` events). External (`http(s):`, `data:`, `blob:`) and same-origin srcs continue to render via the default `<img>` exactly as today.
- **Client LaTeX math rendering** — `MarkdownContent` adds `remark-math` to its remark plugins and `rehype-katex` to its rehype plugins, with single-`$…$` and `$$…$$` delimiters both enabled (GitHub / ChatGPT / Google parity). KaTeX CSS is imported once at app entry. New npm dependencies: `remark-math`, `rehype-katex`, `katex`.
- **Per-image and per-message size caps** in the bridge inliner: 5 MB per image, 20 MB total per message. SVG is supported (inlined as `image/svg+xml`).
- **No new server REST routes.** No file-streaming endpoint. No server-side filesystem reads on behalf of the client.

## Capabilities

### New Capabilities
- `bridge-asset-inlining`: Bridge-side detection, file read, hashing, MIME validation, and `asset_register` emission for local-file image references found in outgoing assistant message text. Includes the `pi-asset:` URI namespace contract and the per-session "already sent" hash deduplication.
- `chat-asset-resolver`: Client-side per-session asset registry populated from `asset_register` events, plus the `MarkdownContent` `img` override that resolves `pi-asset:<hash>` srcs to `data:` URLs.
- `chat-math-rendering`: Client-side LaTeX rendering via remark-math + rehype-katex with both `$…$` and `$$…$$` delimiters enabled.

### Modified Capabilities
- `markdown-rendering`: The single `Markdown text rendering` requirement is rewritten to include `remark-math` in the remark plugin chain, the canonical `[rehypeRaw, rehypeKatex, stripReactRefAttributes]` rehype plugin order, KaTeX-typeset math output, and `pi-asset:`-aware image resolution. Existing scenarios (links, code blocks, GFM tables, Mermaid, ASCII tables) are preserved verbatim and two new scenarios are added (math expression, pi-asset image reference). Bridge, server, and chat-view specs are NOT modified — the new behavior is fully captured by the three new capabilities (`bridge-asset-inlining`, `chat-asset-resolver`, `chat-math-rendering`) with no rewrites of existing requirements.

## Impact

- **Affected packages**: `packages/extension` (image inliner + protocol additions), `packages/shared` (protocol unions, types), `packages/server` (event-wiring pass-through, replay, memory event store awareness so `asset_register` payloads aren't truncated like other event payloads), `packages/client` (event reducer, MarkdownContent, ChatView, main.tsx for KaTeX CSS, package.json deps).
- **No changes** to `packages/electron` (rebuilt client + same server is sufficient), to any REST route, or to the auth / network-guard surface.
- **New npm deps (client only)**: `remark-math`, `rehype-katex`, `katex`. Initial bundle delta ≈ 350 KB JS+CSS; KaTeX webfonts are loaded on demand by the browser only when math actually renders.
- **Persistent storage**: asset bytes live in-memory only on the server's `Session.assets` map and are replayed to reconnecting browsers via subscription replay. Cold-start full-server-restart loses the bytes — older `pi-asset:<hash>` tokens render as a placeholder until a fresh assistant message references the same file (the bridge re-emits at that point). This matches the existing in-memory-only behavior of Read-tool image bytes. Persistence to a sidecar is a deliberate v1 non-goal.
- **Streaming UX**: image renders the moment its closing `)` arrives in a chunk, identical to web images today. No bandwidth blowup — the asset bytes ship once via `asset_register`, subsequent chunks only re-ship the short `pi-asset:<hash>` token in the streaming text.
- **Backward compatibility**: a client that doesn't know `asset_register` will display `pi-asset:<hash>` as a broken-image link. Both bridge and client are versioned in lockstep in this repo, so this is theoretical only — but worth noting for plugin consumers of the protocol.
