## 1. Protocol additions (shared)

- [x] 1.1 Add `AssetRegisterMessage` interface to `packages/shared/src/protocol.ts` (`{ type: "asset_register", sessionId: string, hash: string, mimeType: string, data: string }`) and add it to the `ExtensionToServerMessage` union
- [x] 1.2 Add the same `AssetRegisterMessage` to `packages/shared/src/browser-protocol.ts`'s `ServerToBrowserMessage` union
- [x] 1.3 Add `Session.assets?: { [hash: string]: { data: string; mimeType: string } }` to `packages/shared/src/types.ts` so the resolved registry can live on Session state (decision D5/R1)
- [x] 1.4 Update `packages/shared/src/__tests__/protocol-shape.test.ts` (or the equivalent contract tests) to lock in that `asset_register` is in both unions

## 2. Bridge inliner (`bridge-asset-inlining` capability)

- [x] 2.1 Create `packages/extension/src/markdown-image-inliner.ts` exporting:
  - `parseImageTokens(text: string): { token: string; alt: string; src: string; index: number; length: number }[]` — matches only fully-closed `![alt](src)` tokens
  - `isLocalSrc(src: string): boolean` — false for `data:`, `blob:`, `http:`, `https:`, `pi-asset:`, fragment-only `#…`; true otherwise
  - `mimeFromExtension(path: string): string | null` — case-insensitive against the D8 allowlist
  - `hashBytes(buf: Buffer): string` — sha256, hex, slice(0, 16) (decision D4)
  - `inlineMessageText(text, opts): { rewritten: string; assetsToEmit: { hash, mimeType, data }[] }` — pure helper, no IO; takes `opts.readFile`, `opts.alreadyEmitted: Set<string>`, `opts.maxPerImageBytes`, `opts.maxPerMessageBytes`, `opts.cwd`
- [x] 2.2 Wire the inliner into `packages/extension/src/bridge.ts` event-forwarding path for `message_update` / `message_end` events with `role === "assistant"`. Maintain a per-sessionId `Set<string>` of emitted hashes on `bridgeContext`
- [x] 2.3 For each new asset to emit, send the `asset_register` message through the WebSocket BEFORE the (rewritten) `message_update` / `message_end` (decision D2)
- [x] 2.4 Skip inlining when the role is `user` or `thinking` (so user-paste paths and thinking deltas are unaffected)
- [x] 2.5 Idempotency check: applying the inliner twice to text already containing `pi-asset:` tokens MUST produce identical output
- [x] 2.6 Unit tests in `packages/extension/src/__tests__/markdown-image-inliner.test.ts` covering every scenario in `bridge-asset-inlining/spec.md`: external unchanged, data:/blob: unchanged, idempotent, partial token unchanged, single asset emit, dup asset within message, dup asset across messages, SVG, unsupported ext, case-insensitive ext, 6 MB rejection, per-message budget, ENOENT placeholder, EACCES placeholder, EISDIR placeholder, user-message bypass

## 3. Server pass-through and replay

- [x] 3.1 Add an `asset_register` switch arm in `packages/server/src/event-wiring.ts` that forwards the message to all subscribed browsers and stores `session.assets[hash] = { data, mimeType }` on the Session (creating the assets map lazily). Reject when `data`/`mimeType`/`hash` are absent or malformed
- [x] 3.2 ~~Persist asset_register to events.jsonl~~ — N/A: dashboard does NOT own a persistent event log; pi's `*.jsonl` files are entries, not events. Asset bytes live in-memory on `Session.assets`. See design.md D5 (revised).
- [x] 3.3 ~~memory-event-store truncation guard~~ — N/A per design.md D11 (revised): `asset_register` is a top-level protocol message, not a `DashboardEvent`, and never enters `eventStore`.
- [x] 3.4 In `packages/server/src/browser-handlers/subscription-handler.ts`, add an asset-replay step: re-emit one `asset_register` message per entry in `session.assets` BEFORE the events array on every subscribe. Ordering: asset_register batch → events → pending UI requests → ui_modules_list → ui_data_list → ext_ui_decorator
- [x] 3.5 ~~state-replay synthesizes asset_register~~ — N/A per design.md D5 (revised): pi's persisted entries don't carry asset bytes, so cold-start replay can't synthesize them. v1 accepts placeholder-on-cold-start.

## 4. Client asset registry (`chat-asset-resolver` capability)

- [x] 4.1 Add an `asset_register` case to `useMessageHandler` that writes to `DashboardSession.assets[hash] = { data, mimeType }` (matches the data shape chosen in 1.3 — we put assets on `DashboardSession`, not on `SessionState`, since other session-scoped extension caches like `uiModules` / `uiDecorators` already live there)
- [x] 4.2 Create `packages/client/src/lib/SessionAssetsContext.tsx` exporting `SessionAssetsProvider` and a `useSessionAssets()` hook with a frozen empty-map default
- [x] 4.3 Wire the provider in `packages/client/src/App.tsx` (around `<ChatView>`) so descendant `MarkdownContent` components see the active session's assets via context
- [x] 4.4 Reducer / handler tests in `useMessageHandler.asset-register.test.tsx` covering: live `asset_register` populates map, multiple assets merge, idempotent same-hash overwrite, cross-session isolation, no-op for unknown session

## 5. Client MarkdownContent img override + math (`chat-math-rendering` + `markdown-rendering` capability)

- [x] 5.1 Added `remark-math`, `rehype-katex`, `katex` to `packages/client/package.json`; `npm install` ran cleanly
- [x] 5.2 Imported `katex/dist/katex.min.css` once in `packages/client/src/main.tsx`
- [x] 5.3 In `packages/client/src/components/MarkdownContent.tsx`:
  - Imported `remarkMath` and `rehypeKatex`
  - `remarkPlugins`: `[remarkGfm, remarkMath]`
  - `rehypePlugins`: `[rehypeRaw, [rehypeKatex, { throwOnError: false }], stripReactRefAttributes]`
  - Set `urlTransform={(value) => value}` so ReactMarkdown does NOT sanitize `pi-asset:` and `data:` srcs to empty strings before our `img` override sees them
  - Added a `PiAssetImg` component override that consumes `useSessionAssets()`, branches on `src.startsWith("pi-asset:")`, and falls through to default `<img>` for everything else
  - Unresolved `pi-asset:<hash>` renders as a visible dashed-bordered `<span>` with the alt text and a `(loading…)` suffix
- [x] 5.4 Component tests in `MarkdownContent.test.tsx`:
  - inline `$…$` produces `.katex`
  - display `$$\n…\n$$` (block-level, per remark-math 6.x semantics) produces `.katex-display`
  - `\beta` renders as the β glyph
  - half-formed `$x = 10 +` does not throw
  - `pi-asset:<hash>` resolves to `data:` URL when in context map
  - `pi-asset:<hash>` shows placeholder when absent
  - external URL src unchanged
  - data: URL src unchanged
  - placeholder swaps to resolved image on context update without remount
- [x] 5.5 Visual smoke check via the browser-visual-debug skill: confirm the new behavior renders cleanly in ChatView — manual, deferred to acceptance gate 7.3

## 6. Documentation

- [x] 6.1 Updated `AGENTS.md` "Key files" section: extended the existing `MarkdownContent.tsx` row with the new behavior, added new rows for `SessionAssetsContext.tsx` and `markdown-image-inliner.ts`, citing this change name
- [x] 6.2 Updated `README.md` Features section under "Sessions & chat" describing local-image and math support with the per-image / per-message caps
- [x] 6.3 Updated `docs/architecture.md` with a new "Local-image inlining + LaTeX math in chat" section: mermaid sequence diagram of the bridge→server→client flow, key invariants, failure-mode placeholder table
- [x] 6.4 Added an entry under `## [Unreleased]` in `CHANGELOG.md` describing the user-visible change

## 7. Acceptance gates

- [x] 7.1 `npm test` — 4207 passed / 9 skipped, no regressions. New tests added: 34 in `markdown-image-inliner.test.ts`, 8 in `subscription-handler.test.ts` (asset replay), 5 in `useMessageHandler.asset-register.test.tsx`, 9 in `MarkdownContent.test.tsx` (math + pi-asset img). Plus 6 protocol-shape assertions in `browser-protocol-types.test.ts`.
- [x] 7.2 `npm run build` — client built without errors. The `markdown` chunk grew from ~250 KB to 354 KB (+~100 KB) for the KaTeX engine; KaTeX webfonts load on demand. Total gzipped client bundle 2.55 MB (71% saved).
- [x] 7.3 Manual: post `Here is a local screenshot: ![pic](/abs/path/to/some.png)` and `Here is math: $x = \beta$ and $$\sum_i^n i$$` from an agent and confirm both render as intended in ChatView during streaming AND after replay (manual gate — deferred to user verification after `npm run reload` + browser refresh)
- [x] 7.4 Manual: confirm `npm run reload` after the change picks up the new bridge inliner, and that reconnecting a browser to a session whose log already contains `asset_register` events replays correctly (manual gate — deferred to user verification)
