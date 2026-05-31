## Context

Tool output renders through a small set of renderers under `packages/client/src/components/tool-renderers/`. `ReadToolRenderer`, `WriteToolRenderer`, `EditToolRenderer` already mount `<OpenFileButton>` which `POST`s `/api/open-editor` (handled in `packages/server/src/routes/system-routes.ts`). `GenericToolRenderer` and `BashToolRenderer` dump `result` into a `<pre>` with no link affordance.

`MarkdownContent.tsx` already linkifies bare URLs via `remark-gfm` for markdown sources, gates external `href`s through `isExternalHref` (issue #13), and forces `target="_blank" rel="noopener noreferrer"`. Tool output is NOT routed through the markdown pipeline — it is plain text inside `<pre>`. So adding linkification here does not widen the existing HTML-injection surface from `rehype-raw`.

`ToolContext` (`tool-renderers/types.ts`) already carries `cwd` and `editors[]` per tool-call render. Path resolution against the right working directory is therefore a render-time concern, not a server concern.

## Goals / Non-Goals

**Goals:**
- Detect URLs and file references in plain-text tool output. Render as clickable elements.
- Click URL → open in new tab, reverse-tabnabbing protection.
- Click file → open in detected editor (localhost) OR in-dashboard preview overlay (remote/mobile).
- Conservative detection: zero false positives on common prose tokens (`and/or`, `math.PI`, version strings).
- No server protocol changes. No message-schema changes.
- Tokenization cheap enough for multi-MB `rg` outputs.

**Non-Goals:**
- Linkifying prose inside assistant markdown text (already covered by `remark-gfm`).
- Snapshotting cwd per historical tool-call; v1 uses live `ToolContext.cwd`.
- Windows paths (`C:\…`); defer until demand.
- Editing files from preview overlay; read-only.
- Heuristic path detection without an extension or `:line` suffix (too noisy).

## Decisions

### D1. Tokenization at render-time, not message-ingest

Tokenize the result string inside the renderer, wrapped in `useMemo` keyed by `(toolCallId, result.length, result.slice(0,64))`. Cheap, no schema change, no migration of historical messages.

Alternative considered: parse at ingest, store `parts: (TextPart | LinkPart)[]` on the message. Rejected — couples to shared message types in `packages/shared/`, requires a forward-compat envelope, breaks replay of archived sessions.

### D2. Tier-1 detection only

Three pattern families, in this priority order:

| Pattern | Example | Regex shape |
|---|---|---|
| URL | `https://example.com/path` | `\bhttps?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]` |
| Path+line(+col) | `src/foo.ts:42:7`, `src/foo.ts:42` | `(?:[\w./-]+\/)?[\w.-]+\.\w{1,8}:\d+(?::\d+)?` |
| Path with code extension | `src/foo.ts`, `./bar.tsx`, `../pkg/baz.md` | `(?:\.{1,2}\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:ts\|tsx\|js\|jsx\|md\|mdx\|json\|yml\|yaml\|css\|html\|sh\|py\|go\|rs)` |

Detection runs as a single linear scan that emits a token stream `(text | url | file)`. Overlapping matches: longer / more-specific wins (URL beats path; path-with-line beats path-with-ext).

Alternative considered: tsc-style `foo.ts(42,7)`, stack-trace patterns, eslint variants. Punted to a follow-up; tier-1 captures grep, ripgrep, lint, and standard compiler output for the listed extensions.

Rejected: bare `\S+\.\w+` — matches `math.PI`, `1.0.0`, regex literals, package names.
Rejected: `\w+/\w+` without extension — matches `and/or`, `his/her`.

### D3. Click target — environment-aware, hybrid

```
   click <FileLink path="src/foo.ts" line={42}>
        │
        ├── editors.length > 0  AND  isLocalhost()
        │       → openEditor(cwd, editors[0].id, path, line)        (existing)
        │
        └── otherwise (remote / mobile / no editor)
                → <FilePreviewOverlay path line/>
                    ├── ext .md / .mdx  → MarkdownPreviewView       (existing)
                    ├── ext image       → ImageLightbox             (existing)
                    └── otherwise       → plain <pre> w/ syntax hint
```

`isLocalhost()` already exists in `lib/editor-api.ts`. `editors` already populated in `ToolContext`. Overlay reuses existing read endpoint; no new server route.

Modifier-key escape hatch deferred. When both branches are available, prefer editor (matches existing `OpenFileButton` behavior to avoid two affordances for the same intent).

### D4. URL safety reuses existing filter

`isExternalHref` from `MarkdownContent` exported and reused. Blocks `javascript:`, `data:`, `vbscript:` URIs. No new validation logic.

### D5. Path resolution against live ToolContext.cwd

Relative paths resolved at click-time against `context.cwd`. If `cwd` changed since the tool ran, the link points to the new cwd location. Acceptable tradeoff for v1 — captured as known limitation. Snapshotting cwd per tool-call requires schema work and is deferred (see Non-Goals).

### D6. Renderer integration points

- `GenericToolRenderer.tsx`: replace `<pre>{result}</pre>` with `<LinkifiedText text={result} context={context}/>`.
- `BashToolRenderer.tsx`: same swap for the stdout/stderr blocks.
- Read/Write/Edit renderers: unchanged for now (they already have a dedicated open-button on the header; in-body output not currently linkified — out of scope for v1).

New files:
- `packages/client/src/lib/linkify-tool-output.ts` — tokenizer (pure, unit-testable).
- `packages/client/src/components/tool-renderers/LinkifiedText.tsx` — token-stream renderer.
- `packages/client/src/components/tool-renderers/FileLink.tsx` — file-token component (wraps existing `openEditor` / overlay routing).
- `packages/client/src/components/tool-renderers/UrlLink.tsx` — url-token component (thin `<a>` wrapper).
- `packages/client/src/components/FilePreviewOverlay.tsx` — extension-routed preview.

### D7. Tokenizer performance contract

Single-pass scan, no backtracking-heavy regex. Per-result memoization. Concrete budget: ≤ 50ms for a 2 MB result on commodity hardware. Token cap: if matches > 5000, render remainder as plain text and surface a `+N more links suppressed` footer (prevents pathological DOM blow-up on full-repo `rg` dumps).

### D8. Selection / copy preservation

Linkified spans MUST NOT break native text selection across token boundaries. Implementation: render `<a>` / `<button>` as `display:inline`, no padding, no margin, no `user-select:none`. Verified by visual + selection test.

## Risks / Trade-offs

- [Regex false positives on prose like `1.0.0` looking pathy] → extension allow-list restricts to known code suffixes; `1.0.0` lacks a code extension token after the final dot. Snapshot tests cover prose corpora.
- [Live-cwd resolution drifts if user `cd`s mid-session] → documented limitation; cwd-snapshot deferred to follow-up. Surface the resolved absolute path in the link's `title` so user can see what they will open.
- [`rg` outputs producing thousands of links blow up DOM] → 5000-token cap with overflow footer (D7).
- [Remote-mode preview opens files outside the session's cwd] → preview endpoint MUST scope reads under `cwd` (already enforced by existing file-read route; verify in test).
- [Linkifier touches selection / copy UX] → D8 contract + tests.
- [Click-through to `javascript:` URI via crafted tool output] → reuse `isExternalHref` (D4). Tokenizer also rejects any URL whose scheme is not `http` / `https` at detection time.
- [Mobile click target too small] → `FileLink` renders with hover underline + minimum 24px tap height via Tailwind utility, not by changing layout.

## Migration Plan

No data migration. Pure client-side addition.

Deploy:
1. Land tokenizer + components behind no flag (low risk; falls through to plain `<pre>` if tokenizer throws via ErrorBoundary).
2. Client build + dashboard restart (`npm run build` then `POST /api/restart`).

Rollback: revert the two renderer call-sites (`GenericToolRenderer`, `BashToolRenderer`) back to `<pre>{result}</pre>`. Tokenizer + components remain unused dead code, removed in a follow-up if needed.

## Open Questions

- Should we eventually linkify Read/Write/Edit body output too, or keep their dedicated header button as the only entry point? (Defer; gather usage data first.)
- Modifier-key dual-path (`shift+click → editor, click → preview` on localhost)? Defer — keep one behavior per environment until users ask.
- Add tsc-style `foo.ts(42,7)` and stack-trace patterns? Defer — tier-1 first, expand based on user reports.
