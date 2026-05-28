## Why

We have no in-repo path for producing release videos, README hero clips, or CHANGELOG animations. HyperFrames (heygen-com/hyperframes, Apache-2.0) is an HTML→MP4 framework that ships a 15-skill bundle in pi's native `SKILL.md` format and a curated, redistribution-licensed SFX library. Vendoring it once gives every contributor and every pi session in this repo the ability to author and render video without per-machine setup, and unblocks the follow-on `add-release-video-pipeline` change that wires CHANGELOG entries to a CI render step.

## What Changes

- Add `vendor/hyperframes/` containing the upstream `skills/` tree pinned to a specific release tag (initial pin: `0.6.48`).
- Preserve upstream `LICENSE` (Apache-2.0) verbatim under `vendor/hyperframes/LICENSE`. Write `vendor/hyperframes/README.md` documenting source URL, pinned version, license summary (code = Apache-2.0; bundled SFX in `website-to-hyperframes/assets/sfx/` = Pixabay Content License, redistribution OK, no attribution required), and the supported upgrade procedure.
- Write a single source of truth for the pinned version at `vendor/hyperframes/VERSION` (read by the upgrade script and any CI lints).
- Add `scripts/update-hyperframes.sh` — idempotent, parameterized by tag, that clones at the requested tag, syncs `skills/` + `LICENSE` into `vendor/hyperframes/`, and updates `VERSION`. Re-runnable; no manual file shuffling.
- Wire `.pi/settings.json` with `{ "skills": ["./vendor/hyperframes/skills"] }` so pi discovers all 15 SKILL.md trees via the standard skills loader. Keep `.pi/skills/` untouched — vendored third-party skills stay visually quarantined.
- Add `docs/hyperframes.md` covering: what HyperFrames is, where the vendored copy lives, how to render locally (`npx hyperframes preview` / `render` from a composition dir), how to upgrade (run the script, commit, PR), and the licensing summary.
- Add one-line pointer to `docs/hyperframes.md` in `AGENTS.md` per the Documentation Update Protocol (≤200 char row in Key Files; no inline detail).
- Add one row in the appropriate `docs/file-index-<area>.md` split for `vendor/hyperframes/` and the update script (delegated to subagent per docs protocol).
- **Non-goals**: no CI step, no rendered video assets committed, no template compositions, no project-level `package.json` change. All deferred to `add-release-video-pipeline`.

## Capabilities

### New Capabilities

- `hyperframes-skills`: vendored HyperFrames skill bundle is discoverable by pi sessions in this repo; the vendored tree carries license + version metadata; an upgrade script exists and is idempotent; documentation explains how contributors find, use, and upgrade the bundle.

### Modified Capabilities

(none)

## Impact

- **New tree**: `vendor/hyperframes/` (~2.5 MB, 172 files, including 19 MP3 SFX totaling 1.3 MB).
- **Modified**: `.pi/settings.json` (one new entry in `skills[]`), `AGENTS.md` (one pointer row), one `docs/file-index-<area>.md` split.
- **New scripts**: `scripts/update-hyperframes.sh`.
- **New docs**: `docs/hyperframes.md`, `vendor/hyperframes/README.md`.
- **No runtime dependency added.** Renders happen via `npx hyperframes` invoked ad-hoc from composition directories; the skills only teach the agent how to author and invoke. No change to root `package.json`.
- **Context cost**: 15 additional skill descriptions in every pi session opened against this repo (~3–5 KB always-on context). Acceptable tradeoff given the release-video use case; mitigated by pi's progressive disclosure (bodies load on demand).
- **Licensing**: all vendored content is redistribution-safe (Apache-2.0 + Pixabay Content License); no NOTICE file required by Apache-2.0 §4 (upstream has no NOTICE), but our `vendor/hyperframes/README.md` summarizes provenance for transparency.
- **Unblocks**: `add-release-video-pipeline` (CHANGELOG → video CI step using these skills and the bundled SFX palette).
