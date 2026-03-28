## Context

`detectOpenSpecActivity()` in `src/extension/openspec-activity-detector.ts` checks tool names with exact string comparison (`=== "Read"`, `=== "Bash"`, `=== "Write"`). Pi emits lowercase tool names (`"read"`, `"bash"`, `"write"`), so no tool event ever matches. The auto-attach pipeline (bridge detects → server accumulates → attaches) is wired correctly but the entry point never fires.

Additionally, `openspec new change "name"` uses positional args, not `--change` flag, so even with case fixed, this common command wouldn't be detected for the change name.

## Goals / Non-Goals

**Goals:**
- Fix tool name matching so detection works with real pi events
- Add regex for `openspec new change "name"` positional pattern
- Fix tests to use lowercase tool names matching reality

**Non-Goals:**
- Changing the auto-attach logic in the server (already works correctly)
- Adding new detection patterns beyond the `openspec new change` gap

## Decisions

### 1. Normalize toolName to lowercase at function entry
**Decision**: Call `toolName.toLowerCase()` once at the top, compare against lowercase strings.
**Why over per-comparison `.toLowerCase()`**: Single normalization point, cleaner code, no risk of missing a comparison.

### 2. Add CLI regex for `openspec new change "name"`
**Decision**: Add `CLI_NEW_CHANGE_RE = /openspec\s+new\s+change\s+["']?([^\s"']+)["']?/` to match the positional arg pattern.
**Why**: This is the most common way changes are created. Without it, the change name is only detected later when writing to `openspec/changes/X/proposal.md`, adding unnecessary delay.

## Risks / Trade-offs

- [Risk] Future pi versions could change tool name casing → Mitigation: lowercase normalization handles any casing
- [Risk] New openspec CLI patterns not detected → Mitigation: existing `--change` flag and file path detection cover most cases; new patterns can be added incrementally
