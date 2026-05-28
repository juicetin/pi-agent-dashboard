## Why

Today, a release cut produces a git tag, npm artifacts, Electron installers, and a draft GitHub Release — but nothing visual. Users discover what changed in `vX.Y.Z` only by reading CHANGELOG prose. With the HyperFrames skill bundle vendored (`add-hyperframes-skills`), we can render a short, deterministic "what's new in vX.Y.Z" video directly from the promoted CHANGELOG section and attach it to the GitHub Release on every tag push. This turns the changelog into a shareable artifact (Twitter/X, Discord, README hero) at zero per-release cost.

## Why now

`add-hyperframes-skills` lands the skills and the licensed SFX palette. The marginal cost of adding the CI step is small once those exist; deferring leaves the vendored bundle without a flagship use case in this repo.

## What Changes

- Add `media/release-video/` containing a single composition template, `release-template.html`, parameterized by data attributes the CI step injects (version, date, changelog entries grouped by `Added` / `Changed` / `Fixed` / `Removed`, accent color).
- Add `scripts/changelog-to-release-vars.mjs`: pure Node script that reads `CHANGELOG.md`, extracts the most recent versioned section (the one promoted by `release-cut`), and emits a JSON payload (`{ version, date, sections: [{ kind, entries: [...] }] }`) on stdout. Covered by vitest unit tests with fixture CHANGELOGs.
- Add `scripts/render-release-video.sh`: orchestrates `changelog-to-release-vars.mjs` → injects vars into `release-template.html` → runs `npx hyperframes render` from `vendor/hyperframes/`'s installed CLI → emits `release-vX.Y.Z.mp4` to a CI-scoped output path. Self-contained; runnable locally for preview.
- Add `.github/workflows/release-video.yml` (new workflow, NOT a modification of `publish.yml`) triggered on `release` event type `published` (downstream of the existing release pipeline). Steps: checkout at tag → install Node 22 + ffmpeg → run `scripts/render-release-video.sh` → `gh release upload vX.Y.Z release-vX.Y.Z.mp4`. Runs on `ubuntu-latest`; no Windows/macOS matrix (single MP4 output is platform-agnostic).
- Add `docs/release-video.md` covering: pipeline overview, how to preview the template locally, how the CHANGELOG parser handles edge cases (no entries, missing sections, prerelease tags), how to opt out of a single release (commit message `[skip release-video]`).
- Add one-line pointer to `docs/release-video.md` in `AGENTS.md`; one row in the appropriate `docs/file-index-<area>.md` split for each new file (delegated to subagent per docs protocol).
- Update `.pi/skills/release-cut/SKILL.md` with one line noting that publishing a tag triggers the release-video workflow downstream (informational only — no skill behavior change).
- **Non-goals**:
  - Do NOT commit rendered MP4s to the repo. All renders are CI-only and live on the GitHub Release.
  - Do NOT add HyperFrames to any production runtime path. CI-only use.
  - Do NOT replace or modify the existing `publish.yml`. The video workflow is strictly additive and runs on the post-publish `release` event.

## Capabilities

### New Capabilities

- `release-video-pipeline`: every published GitHub Release on this repo includes a rendered "what's new" MP4 generated deterministically from the CHANGELOG entry for that version; failures in video rendering do not affect the release itself (the workflow can fail without blocking the release artifacts already published).

### Modified Capabilities

(none — the existing release workflow is not modified; the new workflow listens to the `release` event independently.)

## Impact

- **New trees**: `media/release-video/`, `.github/workflows/release-video.yml`.
- **New scripts**: `scripts/changelog-to-release-vars.mjs` (+ tests), `scripts/render-release-video.sh`.
- **Modified**: `AGENTS.md` (one pointer row), one `docs/file-index-<area>.md` split, `.pi/skills/release-cut/SKILL.md` (one informational line).
- **New docs**: `docs/release-video.md`.
- **CI cost**: one new ubuntu-latest job per release event (~2–4 min including ffmpeg install + headless Chrome render). Negligible against the existing release matrix.
- **No runtime dependency added**, no root `package.json` change. HyperFrames runs via `npx` from the vendored skills' guidance only at CI time.
- **Audio palette**: uses `vendor/hyperframes/skills/website-to-hyperframes/assets/sfx/` directly (Pixabay-licensed; redistribution + commercial use OK).
- **Failure isolation**: the workflow's `continue-on-error` posture means a broken template, a malformed CHANGELOG, or a Chrome crash does not block the release artifacts already published by `publish.yml`. Rendered MP4 is an optional asset.
- **Depends on**: `add-hyperframes-skills` (must land first; this proposal assumes `vendor/hyperframes/` exists and `.pi/settings.json` points pi at it).
- **Open design questions deferred to `design.md`**:
  - Where to source the title screen's accent color (per-release override? derive from version major?)
  - Whether to handle prerelease tags (`v1.2.0-rc.1`) differently or skip entirely.
  - How long is "right" — 15s, 30s, scale to entry count?
  - Template's responsive behavior at 16:9 vs 9:16 (one render or two?).
  - Whether to also push to the README as a `<video>` tag on milestone releases.
