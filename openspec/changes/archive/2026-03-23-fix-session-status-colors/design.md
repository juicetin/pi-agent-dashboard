## Context

Session status colors in `SessionList.tsx` and `SessionSidebar.tsx` are semantically inverted. The `statusColors` mapping assigns yellow-pulse to "active" (connected), green to "streaming" (working), and gray to "idle" (connected but waiting). Users expect green=connected, yellow=working, gray=offline.

## Goals / Non-Goals

**Goals:**
- Correct the color-to-status mapping so it matches user expectations
- Apply consistently across both sidebar components

**Non-Goals:**
- Changing the status model or status names (kept as-is: active, streaming, idle, ended)
- Changing any server or protocol behavior

## Decisions

**Swap color assignments in `statusColors` objects:**
- `active` → `bg-green-500` (was `bg-yellow-500 animate-pulse`)
- `streaming` → `bg-yellow-500 animate-pulse` (was `bg-green-500`)
- `idle` → `bg-green-500` (was `bg-gray-400`)
- `ended` → `bg-gray-600` (unchanged)

Rationale: This is the minimal change — just remap colors without renaming statuses or changing the state machine. Both "active" and "idle" represent connected states and get green. "Streaming" is the only working state and gets yellow pulse.

## Risks / Trade-offs

- [Identical colors for active/idle] → Acceptable since both represent "connected"; the ActivityIndicator text below the dot provides additional context ("Thinking…" vs "Waiting for input")
