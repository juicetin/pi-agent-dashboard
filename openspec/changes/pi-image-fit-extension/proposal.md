## Why

Models have per-image and per-request byte and pixel ceilings (Anthropic ~5 MB / >1568px long edge is server-downscaled; OpenAI ~20 MB with tile math; Gemini ~7 MB inline). When a pi agent calls `Read` on a large screenshot or photo, the request can hard-fail, get silently downscaled (wasting tokens), or push the request past the per-turn byte ceiling. Pi exposes a documented mutation seam — `pi.on("tool_call", ...)` with mutable `event.input` — that lets an extension pre-shrink the image so it fits before the built-in Read attaches it to the model turn. This monorepo is the natural home: it already ships a pi extension package (`packages/extension/`) and a workspace-based release pipeline that publishes 5 packages today; adding a sixth is mechanically free.

## What Changes

- New workspace package `packages/image-fit-extension/` published as `@blackbelt-technology/pi-image-fit`. Standalone pi extension — usable without the dashboard, depends on no dashboard package.
- Single `pi.on("tool_call", ...)` hook that fires when `toolName === "read"` and the target path looks like an image (extension allowlist: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`). On match, the hook reads the source, probes byte size + pixel dimensions, and — if either exceeds a configured threshold — resizes to a webp temp file and rewrites `event.input.path` so the built-in Read attaches the shrunk bytes.
- Pure-JS image library (`jimp`) — no native deps, no `electron-rebuild` dance, no QA matrix breakage on Alpine musl / NixOS / exotic ARM.
- Conservative single default policy in v1: long edge ≤ 1568 px, byte ceiling ≤ 4 MB, output webp quality 85. No per-provider tuning until a user asks. Configurable via env vars (`PI_IMAGE_FIT_MAX_EDGE`, `PI_IMAGE_FIT_MAX_BYTES`, `PI_IMAGE_FIT_DISABLE`).
- Resize events surfaced via a single-line console log per resized image (`[pi-image-fit] foo.png 4032×3024 8.2MB → 1568×1176 412KB`) so users have feedback when the hook fires. No TUI widget, no dashboard plugin in v1.
- Tmp file cache keyed by `(absolutePath, mtime, maxEdge, maxBytes)` so re-Reads in the same session don't re-encode. Cleanup on `session_shutdown`.
- Defensive shape copied verbatim from `packages/extension/src/bridge.ts`: all hook work wrapped in try/catch with **fall-through to original path on any failure** — a thrown error inside the hook must never break the user's pi session.
- Update root `package.json` workspaces glob (already `packages/*` — no change needed; new package picked up automatically).
- Update AGENTS.md "5 packages" reference → "6 packages". New row in `docs/file-index.md` splits table for a new `file-index-image-fit.md` (or fold into an existing extension split — decide in design).
- No changes to existing packages. No changes to bridge. No changes to release workflow (already workspace-aware).

## Capabilities

### New Capabilities
- `pi-image-fit`: Pre-attach image resizing for pi's built-in Read tool via the documented `tool_call` mutation seam. Covers: image-extension detection, size+dimension probing, jimp-based resize to webp, tmp file cache with mtime keying, env-var configuration, defensive error handling that falls through to the original path on any failure.

### Modified Capabilities
None. The extension is purely additive and lives in a new package; existing capabilities (bridge-extension, etc.) are untouched.

## Impact

**Affected code**:
- New: `packages/image-fit-extension/` (package.json, src/extension.ts, src/resize.ts, src/policy.ts, src/cache.ts, src/__tests__/).
- New: `docs/file-index-*.md` row (placement decided in design — extension split vs. new file).
- Modified: AGENTS.md (the "5 packages" comment near the release flow). Modified: `docs/file-index.md` splits table if a new area split is created.

**New runtime dependency**:
- `jimp` (pure JS, no native deps). Added only to the new package. Bridge extension and all other packages unaffected.

**Release pipeline**:
- `publish.yml` is workspace-aware (`npm version --workspaces`, per-workspace publish loop). New package gets picked up automatically. Zero workflow changes. First publish will be at the next monorepo version bump (lockstep with all other packages).
- One follow-up consideration: the `release-cut` and `ci-troubleshoot` skills mention "5 npm packages" in their descriptions — update during the implementation task list.

**Compatibility**:
- pi peer dependency: requires the documented `tool_call` event mutation seam with `event.input` mutability. Currently shipping in `@earendil-works/pi-coding-agent` (and `@mariozechner/*` dual-org). Same `peerDependenciesMeta` shape as the existing bridge extension.
- Standalone install (`pi install @blackbelt-technology/pi-image-fit`) works without the dashboard or any other monorepo package.

**Out of scope for v1** (deferred, named explicitly so design.md can revisit):
- Per-provider threshold tuning (Anthropic vs OpenAI vs Gemini dimension/byte math).
- Dashboard UI surface (settings tab, resize history per session).
- Coupling with the bridge's existing `maybeInlineAssistantImages` pipeline — distinct concern, shared surface is too small (~20 LOC) to justify a `dashboard-shared` dependency.
- Custom tools that attach images via paths other than the built-in Read. Hook is scoped to `toolName === "read"`.
- Non-Read pathways: drag-and-drop into TUI, MCP tools returning image content, agent-emitted base64. These don't flow through `tool_call.input.path`.
