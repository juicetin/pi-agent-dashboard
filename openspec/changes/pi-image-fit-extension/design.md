## Context

Pi exposes a documented mutation seam at `pi.on("tool_call", ...)` where `event.input` is mutable in place and the runtime performs **no re-validation** after the handler runs (per `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`, line 674+). The built-in `read` tool accepts `{ path, offset?, limit? }`; for image files the `offset`/`limit` fields are ignored. Mutating `event.input.path` to point at a shrunk temp file is the cleanest way to ensure the model sees an image that fits the per-image byte ceiling and the per-request total — no fork of the Read tool, no custom MCP shim, no header rewriting in the provider request.

Within this monorepo, the bridge extension (`packages/extension/src/bridge.ts`) already subscribes to `tool_call` but as a **pass-through observer only** (declared in `passThroughEventTypes` near line 1144). It does not mutate. The image-fit extension would be the first `tool_call` mutator in this codebase, but it follows patterns the bridge already establishes for handler safety (`safe(...)` wrapper, `isActive()` gate, `sessionReady` gate, `cachedCtx` for cwd resolution).

Stakeholders:
- **End users running pi sessions**: get larger images automatically right-sized; no behavioral change for already-small images.
- **Dashboard users**: same benefits, no UI change in v1.
- **Skill authors**: need to know image-fit is on so a skill that says "Read the screenshot at full res to confirm pixel-perfect alignment" doesn't silently break.
- **Release operators**: one more workspace to track; mechanically automatic via the workspace-aware publish job.

## Goals / Non-Goals

**Goals:**
- Standalone pi extension installable via `pi install @blackbelt-technology/pi-image-fit` with no dashboard dependency.
- Single-file mental model: one `pi.on("tool_call", ...)` hook does the work.
- Zero native dependencies — `jimp` only. No `electron-rebuild` step, no per-platform prebuilt downloads at install time.
- Defensive: any failure in the resize pipeline falls through to the original path. A buggy hook must never break a user's Read.
- Conservative single default: long edge ≤ 1568 px, ≤ 4 MB. Already-small images pass through untouched.
- Visible: a console log line per resize gives users feedback that the hook fired.
- Cacheable: re-Reads of the same image in a session don't re-encode.

**Non-Goals:**
- Per-provider threshold tuning (Anthropic vs OpenAI vs Gemini limits differ). v1 picks the smallest common target ("fits everywhere") and defers per-provider logic until a user actually asks.
- Dashboard UI surface (settings tab, per-session resize history). Console log is enough for v1.
- Interception of non-Read image attachment pathways (TUI drag-and-drop, MCP tools, agent-emitted base64). The hook scope is `event.toolName === "read"` only.
- Shared helpers with the bridge's `maybeInlineAssistantImages` pipeline. Different concern (display vs. attach), shared surface too small to justify coupling.
- Format coercion beyond webp output. No transparent-PNG preservation, no animated-GIF handling beyond first-frame extraction.
- Image content awareness. The hook does not OCR, does not look at the image's purpose, does not check whether the agent "needs full res" — it applies the same rule to every image read.

## Decisions

### D1 — Hook seam: `tool_call` arg mutation (vs. `tool_result` content rewrite, vs. custom Read tool)

**Choice**: `pi.on("tool_call", ...)` mutating `event.input.path` to a resized temp file path.

**Why**:
- Documented mutable seam (`event.input` is explicitly mutable; no re-validation after mutation).
- Built-in Read still does all the heavy lifting (text vs. image detection, attachment encoding, line offset handling for non-image files). We rewrite one field.
- `tool_result` would mean intercepting the already-attached image content blocks — possible but a stronger primitive that's easy to get wrong.
- A custom Read tool replacing the built-in would mean reimplementing text-file handling, offset/limit semantics, EISDIR error shapes, etc. Large surface, high regression risk.

**Alternatives considered**:
- Provider-layer interception (`before_provider_request`): would catch all image pathways including non-Read, but the event is documented as "carries raw API payloads (very large)" and is excluded from bridge subscription for that reason. Wrong layer.
- MCP shim: out of scope; pi's Read is built-in.

### D2 — Image library: `jimp` (vs. `sharp`, `@napi-rs/image`)

**Choice**: `jimp` (pure JS, no native deps).

**Why**:
- Pi installs extensions with `npm install --omit=dev`. A native lib means the user's machine downloads a prebuilt binary at install time. Works for the common matrix but breaks on Alpine musl, NixOS, some ARM variants.
- The dashboard ships as an Electron app. Sharp would need `electron-rebuild` integration in the Electron build pipeline (`packages/electron/`). Jimp is invisible to electron-builder.
- Cross-platform QA matrix (`qa/Makefile` Packer VMs) wouldn't have to validate platform-specific binary downloads.
- Speed differential is irrelevant: the hook runs once per image Read, not in a tight loop. Sharp ~50 ms vs. jimp ~300 ms per image is unmeasurable in agent-loop terms.

**Alternatives considered**:
- `sharp`: faster, ~10 MB platform binary, native-dep headache. Reconsider if/when a user actually files an issue showing jimp performance is a bottleneck.
- `@napi-rs/image`: similar tradeoffs to sharp.
- Shell out to `sips` / `magick` / `ffmpeg`: zero install size, but unportable. macOS-only or system-dep coupling. Rejected.

### D3 — Output format: format-adaptive (PNG-in → PNG-out, else JPEG@85)

**Choice**: Format-adaptive output:
- PNG input → PNG output (lossless, preserves text/screenshot fidelity).
- All other inputs (`.jpg`, `.jpeg`, `.webp`, `.gif`) → JPEG quality 85.

Quality 85 applies only to the lossy JPEG path.

**Why**:
- Honest about input intent: PNGs in agent workflows are almost always screenshots / diagrams / code captures where lossy re-encoding destroys readable text; cameras and the web ship JPEGs where lossy is the original choice.
- Stays within `jimp`'s native encoder set — no second image dep, no native binary.
- The 4 MiB byte ceiling still drives the *decision* to resize; the format choice just shapes the *encoded output*. PNG-out for a downscaled image is much smaller than the original even at lossless settings (1568 px long edge × lossless > 4 MiB is rare).
- All target providers accept both PNG and JPEG inline; webp's marginal compression advantage was never worth a second dep.

**Alternatives considered**:
- Always webp at quality 85 (original D3): rejected after implementation discovered `jimp@1.6.1` ships no webp encoder. Supported output mimes per `node_modules/jimp/dist/esm/index.d.ts:266`: `bmp`, `gif`, `jpeg`, `png`, `tiff`. Adding `@jsquash/webp` (wasm) would buy ~20–30% size savings at the cost of a second image dep and a wasm load step — not worth it for a feature whose job is "fit under 5 MB," not "minimize bytes."
- Always JPEG quality 85: simpler but visibly degrades code-screenshot text. Rejected.
- Switch to `sharp` for webp: overturns D2 and reintroduces the native-binary install problem. Rejected.
- Lossless webp for screenshots, lossy webp for photos: same content-classification problem, same wasm dep cost. The PNG-vs-not split is a cheap, sound proxy for the same intent.

### D4 — Threshold: 1568 px long edge, 4 MB bytes

**Choice**: Single global default. Long edge ≤ 1568 px **and** bytes ≤ 4 MB. Resize triggers if **either** is exceeded.

**Why**:
- 1568 px is the documented Anthropic server-side downscale target — landing under that means we avoid double-downscale (theirs after ours).
- 4 MB leaves headroom under Anthropic's ~5 MB/image ceiling and is comfortably under the per-request 30 MB total even with a handful of images.
- Below both thresholds, the image is forwarded untouched (no quality loss, no temp file).

**Alternatives considered**:
- Provider-aware policy: defer (Non-Goal).
- More aggressive (1024 px / 1 MB): saves tokens but degrades agent perception of detail. The point of image-fit is to fit, not to minimize.

### D5 — Configuration: env vars only in v1

**Choice**:
- `PI_IMAGE_FIT_DISABLE=1` — opt-out kill switch.
- `PI_IMAGE_FIT_MAX_EDGE=<px>` — override long-edge threshold.
- `PI_IMAGE_FIT_MAX_BYTES=<bytes>` — override byte threshold.
- `PI_IMAGE_FIT_QUALITY=<1-100>` — override webp quality.

**Why**: Standalone pi extension (no dashboard required); env vars are the lowest-friction config surface that works in TUI, headless, electron-bundled, and CI contexts identically. No config file to parse, no schema to maintain, no migration.

**Alternatives considered**:
- Config file (`.pi/image-fit.json`): adds a parse path and schema. Defer until a user files an issue with a config knob that doesn't fit cleanly into env vars.
- Dashboard settings UI: defer to a future v2 dual extension+plugin shape (Non-Goal).

### D6 — Default policy: on by default

**Choice**: Hook is active when the extension is installed; user opts out via `PI_IMAGE_FIT_DISABLE=1`.

**Why**: An extension that does nothing unless flipped on is dead weight. The conservative thresholds (D4) and console feedback (D8) mean the on-by-default mode is unsurprising — small images pass through, large images get a visible log line.

**Alternatives considered**:
- Opt-in via `PI_IMAGE_FIT=1`: safer but defeats the purpose. If a user installs the extension, they want it active. Rejected.

### D7 — Caching: tmp file cache keyed by `(absPath, mtime, maxEdge, maxBytes)`

**Choice**:
- Cache directory: `path.join(os.tmpdir(), "pi-image-fit", <session-id-or-pid>)`.
- Cache key: SHA-256 of `${absPath}|${mtime}|${maxEdge}|${maxBytes}|${quality}`.
- File name: `<hash>.webp`.
- Cleanup on `session_shutdown` event.

**Why**:
- Agents re-Read the same image within a turn or across turns (e.g. checking a screenshot before and after a step). Re-encoding is wasteful.
- `mtime` keying invalidates on file change. `maxEdge`/`maxBytes`/`quality` keying invalidates if the user changes env vars mid-session.
- Session-scoped tmp dir avoids leakage across pi sessions.

**Alternatives considered**:
- Memory cache: works but doesn't survive bridge reload. File cache is durable across reloads within a session.
- No cache: simplest but redundant work on every re-Read.

### D8 — Telemetry: single-line console log per resize

**Choice**: `console.log("[pi-image-fit] foo.png 4032×3024 8.2MB → 1568×1176 412KB")` — one line, no level, no JSON, no event emission.

**Why**:
- Visible feedback that the hook fired (D6 on-by-default depends on this).
- pi forwards `console.log` to the TUI/dashboard output stream already.
- No coupling to dashboard event bus, no protocol additions, no version bumps from a schema change.

**Alternatives considered**:
- Emit a `pi.events.emit("image-fit:resized", {...})` event: would let the dashboard build a resize-history panel. Defer to v2 (Non-Goal).
- Silent: rejected — invisible behavior in the agent loop is a debugging trap.

### D9 — Defensive shape: try/catch with fall-through

**Choice**: Wrap the hook body in try/catch. On any failure (file read error, jimp error, fs write error, dimension probe error), log a warning and leave `event.input.path` unmodified — built-in Read uses the original file as if the hook weren't installed.

**Why**:
- The bridge's `safe()` wrapper catches handler errors so pi keeps running, but image-fit needs a stricter contract: not just "don't crash pi" but "the agent's Read must succeed exactly as it would without this extension installed."
- Errors-as-no-ops is the right policy for a transparent middleware layer.

**Alternatives considered**:
- Surface errors as Read tool failures: would block the agent on hook bugs. Rejected.

### D10 — Package boundary: new workspace `packages/image-fit-extension/` (vs. co-locate inside `packages/extension/`)

**Choice**: New workspace package, published as `@blackbelt-technology/pi-image-fit`. No dashboard-shared dep.

**Why**:
- Bridge extension is dashboard-coupled (forwards events to dashboard server). Image-fit has nothing to do with the dashboard.
- A pi user without the dashboard should be able to `pi install @blackbelt-technology/pi-image-fit` and have it work.
- Co-locating would force jimp into every dashboard install. Standalone keeps the bridge package lean.

**Alternatives considered**:
- Second `pi.extensions` entry in `packages/extension/package.json` (already an array, mechanically trivial): rejected per above — couples image-fit to dashboard install.
- Top-level npm package outside this monorepo: rejected — release operator wanted lockstep with the monorepo version cadence.

## Risks / Trade-offs

- **[Silent quality loss]** Agent reads a 4K screenshot of code, image-fit squashes it to 1568 px, agent can't read fine text. Failure is invisible — agent just guesses wrong. → **Mitigation**: console log per resize gives users a trail; opt-out env var; document the failure mode in the package README and in a skill-author note in `docs/`.
- **[Hook breaks user's Read]** Bug in jimp or our wrapper throws and corrupts `event.input.path`. → **Mitigation**: D9 try/catch with fall-through. Tests for each error path (unreadable file, malformed image, oversize-after-shrink edge case, EISDIR, ENOENT).
- **[Tmp file disk litter]** Cache files accumulate if `session_shutdown` doesn't fire (crash, kill -9). → **Mitigation**: session-scoped tmp dir; on extension load, sweep `os.tmpdir()/pi-image-fit/` for dirs older than 24h.
- **[Re-encoding lossy formats]** Re-encoding a JPEG through jimp → JPEG re-decodes and re-encodes — double-lossy at quality 85. → **Mitigation**: only resize if a threshold is actually exceeded; quality 85 is the well-known sweet spot; acceptable for the visual fidelity range models can use.
- **[PNG-out failing the byte ceiling]** Lossless PNG re-encoding of a complex 1568 px image could theoretically still exceed `maxBytes`. → **Mitigation**: rare in practice for screenshots (which compress well even lossless); if it shows up in user reports, add a configurable PNG-byte fallback to JPEG. v1 ships PNG-out unconditionally for PNG inputs.
- **[Cross-platform install]** jimp pure JS but still has transitive deps. → **Mitigation**: extend `qa/tests/` with an install-and-Read-a-large-image test that runs on the existing Packer VM matrix.
- **[Animated GIF flattening]** First-frame extraction loses motion. → **Mitigation**: documented behavior; rare in agent workflows.
- **[Lockstep version inflation]** v1.0.0 of image-fit at release time will actually be 0.5.5 (or whatever the monorepo is at) because of the `npm version --workspaces` bump. Semantic version → meaningless. → **Mitigation**: accept it; monorepo norm.
- **[Skill behavior change]** A skill that assumed full-res Read now gets a downscaled image. → **Mitigation**: doc note in `docs/file-index-*.md` for the new package; mention in the package README; suggest skill authors use `PI_IMAGE_FIT_DISABLE=1` in environments where pixel-perfect Read matters.

## Migration Plan

This is a new additive package — no migration of existing code.

**Deployment**:
1. Land the package in the monorepo.
2. Next release cycle (`release-cut` skill) bumps every workspace to the new version, including the new package.
3. Publish job picks up the new workspace automatically via per-workspace publish loop.
4. Users opt in by installing: `pi install @blackbelt-technology/pi-image-fit`.

**Rollback**:
- No code-level rollback needed (additive).
- Users disable via `PI_IMAGE_FIT_DISABLE=1` env var without uninstalling.
- Full removal: `pi uninstall @blackbelt-technology/pi-image-fit`.

**Documentation tasks** (live in tasks.md, not here):
- AGENTS.md "5 packages" → "6 packages".
- `docs/file-index.md` splits table — add row for image-fit area (or fold into extension split — decide during implementation).
- `release-cut` skill description: "5 npm packages" → "6 npm packages".
- `ci-troubleshoot` skill description: same.

## Open Questions

1. **File-index placement**: own split `docs/file-index-image-fit.md` (one new package, ~5 rows — feels light) vs. fold into `docs/file-index-extension.md`? Default: fold into extension split with a section header; revisit if the package grows.
2. **Animated GIFs**: silently first-frame, or skip resize entirely and let the original through? Default: first-frame with a log line noting it.
3. **Dimension probe cost**: probing dimensions requires decoding the image (jimp has no metadata-only API). Worth short-circuiting on byte size alone (skip dimension probe if `bytes < maxBytes`)? Default: yes — saves a decode pass for the common case.
4. **Behavior when jimp can't decode**: log + fall through, or log + abort the Read with an error the agent can see? Default: fall through (D9). Reconsider if users report Read returning images the model also rejects.
5. **`docs/faq.md` entry**: add a "what does pi-image-fit do" entry? Default: yes once shipped; defer until v1 releases.
