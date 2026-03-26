# Spec Gap Analysis Report

**Date**: 2026-03-25  
**Scope**: All 56 specs in `openspec/specs/` vs actual codebase in `src/`  
**Status**: All identified gaps have been resolved.

---

## Summary

All previously identified gaps have been addressed through spec updates and new spec creation:

| Action Taken | Count |
|-------------|-------|
| Stale specs updated (SQLite refs, field names, etc.) | 7 |
| New specs created | 4 |
| Unimplemented requirements removed/clarified | 3 |

---

## Changes Made (2026-03-25)

### Stale Specs Updated

| Spec | What Changed |
|------|-------------|
| `packaging` | Removed SQLite `dbPath`/`retentionDays`, removed `sql.js` dep, removed service templates & `--help` (not implemented), fixed config field names (`port`/`piPort`), simplified peer deps, added `--no-tunnel` and SPA fallback |
| `shared-config` | Removed `dbPath`/`retentionDays` from table, added `spawnStrategy` field with validation scenario, added `ensureConfig` scenario |
| `session-identity` | Replaced "stored in SQLite" with JSON-backed state store + in-memory Map, added session display name requirement |
| `session-listing` | Replaced "SQLite session records" with in-memory session manager, updated scenarios |
| `extension-ui-forwarding` | Replaced unimplemented `tool_call` hook + `pi.events` bus with current state: protocol defined, rendering works, active detection deferred |
| `open-in-editor` | Added `file` and `line` optional parameters to open-editor endpoint |
| `model-selector` | Added thinking level selector requirement (6 levels, `set_thinking_level` protocol) |
| `session-filtering` | Replaced SQLite references with in-memory session manager + state store |
| `shared-protocol` | Added heartbeat protocol (15s send, 45s timeout, sleep-aware grace period) |

### New Specs Created

| Spec | Purpose |
|------|---------|
| `tool-renderers` | Registry, 5 renderers (Read/Edit/Write/Bash/Generic), DiffView, OpenFileButton, language auto-detection |
| `token-stats-pipeline` | Stats extraction from turn_end → protocol → server accumulation → browser broadcast + event status extraction |
| `event-reducer` | Client state machine: events → SessionState (messages, tool calls, streaming, stats, pending prompts, compact) |
| `toast-notifications` | Auto-dismiss toast component + useToast hook |

### Unimplemented Requirements Clarified

| Spec | Resolution |
|------|-----------|
| `packaging` — service templates | Removed (not implemented, not planned) |
| `packaging` — `--help` flag | Removed (not implemented) |
| `extension-ui-forwarding` — `tool_call` hook | Marked as deferred; spec now reflects actual passive relay behavior |

---

## Remaining Notes

- The `packaging` spec `--dev` mode previously mentioned "proxy to Vite dev server" — the actual behavior is that the server simply doesn't serve static files (expects separate Vite process). This is accurate now.
- The `event-persistence` spec documents the removed SQLite event store and its replacement rationale. It serves as historical documentation and does not need updating.
