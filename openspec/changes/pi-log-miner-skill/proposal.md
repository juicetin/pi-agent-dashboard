## Why

Pi conversation logs contain rich institutional knowledge — architectural decisions, debugging insights, failure patterns, subtle side-effects — that is lost once a session ends. There is no way to extract, search, or share this knowledge across sessions or team members. A skill that mines these logs and stores structured memories enables persistent project knowledge that grows over time.

## What Changes

- New pi skill `pi-log-miner` that processes JSONL session logs and extracts categorized knowledge
- TypeScript orchestrator that parses, filters, and chunks conversation logs before sending to LLM
- Headless pi invocation (`pi --print --model haiku`) for extraction — no direct API client needed
- Optional Shodh Memory integration via REST API for semantic search, Hebbian learning, and memory decay
- Export/import commands for git-based team knowledge sharing
- Shodh data stored in `~/.pi/shodh/`, portable exports in `.pi/memories/`
- Graceful degradation: works without Shodh (produces JSON files only)

## Capabilities

### New Capabilities
- `log-extraction-pipeline`: JSONL parsing, content filtering (discard file dumps, keep reasoning/errors), topic-aware chunking with rolling summary, headless pi spawning per chunk
- `shodh-memory-integration`: Optional Shodh server detection/auto-start, REST client for remember/recall, memory type mapping (Decision, Discovery, Error, Learning, Pattern, Observation, Context), episode threading from topic segments, emotional metadata inference
- `memory-portability`: Export project memories from Shodh to human-readable JSON, import teammate exports into local Shodh, content-hash dedup on re-import, git-friendly format in `.pi/memories/`

### Modified Capabilities
<!-- None — this is a standalone skill with no changes to existing specs -->

## Impact

- **New dependency**: Shodh Memory server (optional, skill degrades gracefully without it)
- **New files**: Skill directory under `.pi/skills/pi-log-miner/` with scripts, lib, and prompt template
- **Pi sessions directory**: Read-only access to `~/.pi/agent/sessions/` for log processing
- **Storage**: `~/.pi/shodh/` for Shodh data, `.pi/memories/` for portable exports
- **API usage**: Each extraction spawns headless pi calls (Haiku-level, ~10-20 per session, low cost)
- **No changes** to existing dashboard server, bridge extension, or client code
