## Why

The project has 14+ active proposals, many written before major architectural changes (e.g., `server-side-directory-services` moved OpenSpec polling from bridge to server, breaking protocol assumptions in several proposals). There is no systematic way to detect when implemented changes make older proposals stale, conflicting, or obsolete. Manually reviewing each proposal against the codebase and 60+ archived changes is impractical. This leads to wasted effort implementing proposals built on false assumptions.

A concrete example already exists: `session-tree-navigation` lists "Reading/parsing session JSONL files from the server" as a Non-Goal — but the server now does exactly this. The entire design could be simplified, but nothing flags this automatically.

## What Changes

- **New agent skill** `openspec-coherence-check` at `.pi/skills/openspec-coherence-check/SKILL.md` with a `references/` subdirectory containing the proposal-queue JSON schema documentation
- **New persistent file** `.pi/proposal-queue.json` — written by the skill, stores per-proposal status, priority ordering, issues, and cross-proposal conflicts. Designed as the input for future automation skills (auto-pipeline with ff + apply)
- **Two-phase workflow**: Phase 1 sweeps all active proposals producing a summary report + JSON file. Phase 2 lets the user triage individual proposals — auto-fixing trivial staleness, guided conversation for broken assumptions, archival suggestions for obsolete proposals
- **Five detection dimensions**: file existence (do referenced files still exist?), archive impact (did a post-creation archived change break something?), concept validity (are Context/Non-Goal statements still true?), obsolescence (has the feature been built already?), cross-proposal conflicts (do two proposals touch the same files/capabilities incompatibly?)
- **Priority scoring algorithm** that produces a suggested implementation order, respecting dependency constraints and conflict resolution. Stored in the JSON file for later automation consumption
- **Register the skill** in AGENTS.md `available_skills` section

## Capabilities

### New Capabilities
- `openspec-coherence-check`: Agent skill that audits active OpenSpec proposals against current codebase state and archived changes, produces gap-analysis reports, auto-fixes trivial issues, guides conversation for complex conflicts, suggests implementation ordering, and persists results to `.pi/proposal-queue.json`

### Modified Capabilities
<!-- No existing spec-level requirements change. This is a new skill file
     and a new JSON persistence file. Existing skills are not modified. -->

## Impact

- **New files**: `.pi/skills/openspec-coherence-check/SKILL.md` (~350 lines — larger than typical skills because an isolated agent must have self-contained instructions for multi-phase analysis), `.pi/skills/openspec-coherence-check/references/proposal-queue-schema.md` (JSON schema docs)
- **New runtime artifact**: `.pi/proposal-queue.json` (written by skill, gitignored)
- **Modified**: `AGENTS.md` (add skill to `available_skills` list)
- **Dependencies**: Requires `openspec` CLI and `git`. No new npm packages.
- **No server/client/extension changes**: Purely a skill + metadata file
- **Future integration point**: `.pi/proposal-queue.json` is designed to be consumed by a future `openspec-auto-pipeline` skill that reads the queue and processes proposals in priority order via ff + apply + verify + archive
