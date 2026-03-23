## Context

The `detectSessionSource()` function in `source-detector.ts` returns `"unknown"` when no recognized environment variable is set. The `SessionSource` type includes `"tui"` but it is never matched. Plain terminal sessions (the most common case) show as "unknown" in the dashboard.

## Goals / Non-Goals

**Goals:**
- Terminal pi sessions correctly identified as `"tui"`

**Non-Goals:**
- ACP-from-Zed detection (requires future investigation of available env vars)
- Adding new source types

## Decisions

**Change fallthrough from `"unknown"` to `"tui"`:**
The detection order stays the same (dashboard → zed → tmux → fallthrough). The only change is the fallthrough return value. If pi is running and none of the special env vars are set, it's a plain terminal TUI session.

Rationale: `"unknown"` is never useful information. If none of the specialized environments are detected, the session is running in a terminal, which is what `"tui"` means.

## Risks / Trade-offs

- [Future unknown environments misidentified as tui] → Acceptable; as new sources are identified (e.g., ACP), specific detection is added before the fallthrough
