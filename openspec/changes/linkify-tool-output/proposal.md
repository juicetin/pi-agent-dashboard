## Why

`GenericToolRenderer` dumps tool results as raw `<pre>` text. Bash/grep/find/tsc/lint output buries file paths and URLs as plain characters — users see `src/foo.ts:42` but cannot click it. `OpenFileButton` exists and is wired into Read/Write/Edit renderers, proving the editor-open path works; nothing surfaces the same affordance for the long tail of tool outputs where users actually need to navigate references.

## What Changes

- Add plain-text linkification to tool-result rendering: detect URLs (http/https) and file references with `:line[:col]` suffixes or known extensions in `GenericToolRenderer` (and Bash output).
- URL match → render `<a target="_blank" rel="noopener noreferrer">`. Reuse existing `isExternalHref` filter to block `javascript:` / `data:` URIs.
- File match → render inline button reusing `OpenFileButton` plumbing. Resolve relative paths against the tool-call's `ToolContext.cwd`.
- Click behavior is environment-aware:
  - localhost + detected editor → `POST /api/open-editor` (existing path).
  - remote / mobile / no editor → fall back to read-only inline preview via existing `/api/files/read` + a lightweight preview overlay (extension-routed: `.md` → MarkdownPreviewView, image → ImageLightbox, otherwise plain text).
- Detection is conservative tier-1 only: URLs + `path:line[:col]` shape + paths with known code extensions. No prose path guessing (no `and/or` false positives).
- Tokenization memoized per result string; no schema/protocol changes.

## Capabilities

### New Capabilities
- `tool-output-linkification`: Detect URLs and file references inside plain-text tool output. Render as clickable elements. Route URL clicks to `_blank`. Route file clicks to editor or in-dashboard preview depending on environment.

### Modified Capabilities
- `agent-tool-rendering`: `GenericToolRenderer` no longer renders result as raw `<pre>`; passes through linkifier. Bash output renderer gains same treatment.
- `open-in-editor`: Click target extends beyond Read/Write/Edit headers to any path detected in tool output.

## Impact

- Code: `packages/client/src/components/tool-renderers/GenericToolRenderer.tsx`, `BashToolRenderer.tsx`, new `linkify-tool-output.ts` util + `<FileLink>` / `<UrlLink>` components, possibly a `<FilePreviewOverlay>` for remote-mode fallback.
- APIs: no new server endpoints required; reuses `/api/open-editor` and existing file-read endpoint.
- Dependencies: none added. Detection is plain regex tokenization.
- Security: linkifier MUST reuse `isExternalHref` from `MarkdownContent` for href filtering; MUST NOT linkify inside `rehype-raw` paths (tool output is already plain text — no HTML injection surface widens).
- Performance: tokenization wrapped in `useMemo` keyed by result string. Large `rg` outputs (multi-MB) still cheap — single linear pass.
- Mobile: in-dashboard preview fallback unlocks file navigation on phones where no localhost editor exists.

## Non-Goals

- Detection of paths in prose assistant text (markdown pipeline already handles explicit `[text](url)`).
- Snapshotting cwd per historical tool-call (defer; live `session.cwd` is acceptable for v1).
- Windows path forms (`C:\…`); covered later if demand surfaces.
- Editing files from the preview overlay (read-only).
