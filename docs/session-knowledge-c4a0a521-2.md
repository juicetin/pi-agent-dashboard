# Session Knowledge Synthesis Part 2: c4a0a521 (General)

Continued from `session-knowledge-c4a0a521.md`. Covers the later phase: session persistence deep-dive, event loading, context usage tracking, session discovery, status broadcast, and operational issues.

---

## 1. The @mariozechner/pi-coding-agent Peer Dependency Trap

### The Problem
Three server-side modules used `import("@mariozechner/pi-coding-agent")`:
- `loadSessionEvents()` in directory-service.ts
- `discoverSessions()` in directory-service.ts
- `handleLoadSessionEvents()` in command-handler.ts

**This package is a peer dependency — it only exists inside pi's process.** The dashboard server runs independently and does NOT have it installed. The dynamic import **silently fails** (caught by try/catch or Promise.catch), producing zero errors in logs but causing complete functionality loss.

### Impact
| Function | Effect of Silent Failure |
|----------|-------------------------|
| `loadSessionEvents()` | Events never loaded from disk → chat history empty for ended sessions |
| `discoverSessions()` | Historical sessions never found → "Show hidden" shows 5 sessions instead of 77 |
| `handleLoadSessionEvents()` | Used by bridge (has the package) — works fine |

### Discovery Method
Tried to run the dynamic import manually from the project directory:
```bash
npx tsx -e "import('@mariozechner/pi-coding-agent').then(m => console.log('OK')).catch(e => console.error('FAIL:', e.message))"
# FAIL: Cannot find package '@mariozechner/pi-coding-agent'
```

### Fix: Standalone Modules
Created three modules that read pi's data formats directly without the dependency:

| Module | Purpose | What It Reads |
|--------|---------|---------------|
| `session-file-reader.ts` | Load session entries (chat replay) | JSONL file → tree branch traversal |
| `session-discovery.ts` | List all sessions for a cwd | `~/.pi/agent/sessions/<encoded-cwd>/*.jsonl` headers |
| `session-stats-reader.ts` | Extract token/cost/context stats | JSONL file → accumulate from assistant message `usage` |

### Key Lesson
**Never use `import("@mariozechner/pi-coding-agent")` in server code.** It only works inside the bridge extension (which runs in pi's process). All server-side session file operations must use standalone readers.

---

## 2. Session File Format Deep Dive

### JSONL Structure
- One JSON object per line
- First line: session header `{ type: "session", id: "...", cwd: "...", timestamp: "..." }`
- Subsequent lines: entries with `{ type, id, parentId, timestamp, ... }`

### Entry Types Found
| Type | Fields | Purpose |
|------|--------|---------|
| `session` | `id`, `cwd`, `timestamp` | Header (always first) |
| `message` | `message: { role, content, usage }` | User/assistant/toolResult messages |
| `model_change` | `provider`, `modelId` | Model switch events |
| `thinking_level_change` | `level` | Thinking budget changes |
| `session_info` | `name` | Session rename |
| `label` | `targetId`, `label` | Branch labels |
| `leaf` | `entryId` | Current branch pointer |

### Tree Structure — SURPRISE
Sessions use a **tree structure** via `parentId` chains, not a flat list:
- Each entry has `id` and `parentId`
- `getBranch()` walks from `leafId` back to root via `parentId`
- The `leaf` entry type records which branch is "current"
- Forks create new branches from existing entries
- **The standalone reader must implement tree traversal** to get the correct message order

### Assistant Message Usage Data
```json
{
  "usage": {
    "input": 1,
    "output": 316,
    "cacheRead": 134241,
    "cacheWrite": 366,
    "totalTokens": 134924,
    "cost": {
      "input": 0.000005,
      "output": 0.0079,
      "cacheRead": 0.0671205,
      "cacheWrite": 0.0022875,
      "total": 0.07731299999999999
    }
  }
}
```
- `totalTokens` approximates context usage (input + output + cache)
- `cost.total` is per-turn cost
- These are on every assistant message — accumulate for session totals

### Path Encoding Formula
Pi encodes cwd to directory name: `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`
Example: `/Users/robson/Project/pi-agent-dashboard` → `--Users-robson-Project-pi-agent-dashboard--`
Location: `~/.pi/agent/sessions/<encoded-cwd>/`

---

## 3. Context Usage Tracking — Full Data Path

### The Problem
After server restart, context usage bars (showing % of context window used) were empty for all sessions.

### Root Cause Chain
1. `contextUsage` was only in client-side `SessionState` (from event reducer)
2. It was set by `stats_update` events which included `contextUsage: { tokens, contextWindow }`
3. `stats_update` events came from the bridge's live `turn_end` handler
4. After restart, no live events → no context data
5. Event replay from session files DID generate `stats_update` but WITHOUT `contextUsage`
6. Even with replay, `contextUsage` requires `contextWindow` which comes from `ctx.getContextUsage()` — a live API

### Fix: Multiple Layers
1. **Added `contextTokens` and `contextWindow` to `DashboardSession`** — server-side persistence
2. **Server stores context usage from bridge events** — `pi-gateway.ts` updates session on every `stats_update`
3. **Server broadcasts context data in `session_updated`** — so all browser cards show the bar
4. **Client merges two sources** — live event-reduced state (priority) + server-persisted session data (fallback)
5. **Event replay includes `contextUsage`** — `state-replay.ts` now adds `contextUsage` to `stats_update` using `totalTokens` from usage data + model-inferred context window
6. **Session file enrichment** — `session-stats-reader.ts` extracts `lastTotalTokens` on startup

### Context Window Inference — GOTCHA
Since session files don't contain the model's context window, we infer it from the model name:
```typescript
function inferContextWindow(model: string): number {
  if (id.includes("claude")) return 200_000;
  if (id.includes("gpt-4o")) return 128_000;
  if (id.includes("gemini")) return 1_000_000;
  if (id.includes("deepseek")) return 128_000;
  return 200_000; // default
}
```

**Surprise**: The bridge reported `contextWindow: 1,000,000` for `claude-opus-4-6`. This came from `ctx.getContextUsage()` (the authoritative source). The inference function would say 200k. The live value from the bridge takes priority — the inference is only a fallback for sessions without live data.

### Session Stats Enrichment Condition — GOTCHA
Originally, enrichment only ran when `cost === 0` (session had no stats). But context data could be missing even when cost was present (e.g., first restart enriched cost but not context). Fixed to also run when `contextTokens === undefined`.

---

## 4. Session Status Broadcast — Three Attempts

### Attempt 1: `piGateway.onDisconnect` Was Never Set
- **Discovery**: `piGateway.onDisconnect` existed in the interface but was never assigned in `server.ts`
- After heartbeat timeout, `unregister()` set status to "ended" but browsers were never notified
- Cards showed stale "active" status indefinitely

### Attempt 2: Immediate End on Disconnect — TOO AGGRESSIVE
```typescript
piGateway.onDisconnect = (sessionId) => {
  sessionManager.update(sessionId, { status: "ended" });
  browserGateway.broadcastSessionUpdated(sessionId, { status: "ended" });
};
```
- **Problem**: During `/reload`, the bridge disconnects briefly then reconnects
- This caused cards to flash "ended" → "active" on every reload
- New sessions spawned from dashboard never appeared (set to ended immediately)

### Attempt 3: onUnregister Callback — CORRECT
```typescript
sessionManager.onUnregister = (sessionId) => {
  browserGateway.broadcastSessionUpdated(sessionId, { status: "ended" });
};
```
- Fires only after heartbeat timeout (45s) — temporary disconnects don't trigger it
- Bridge reconnects within 45s → session stays "active"
- True disconnects → 45s delay then card updates to "ended"

### Key Lesson
**Don't end sessions on WebSocket close.** The bridge disconnects/reconnects during `/reload`, `/compact`, and other internal operations. Use the heartbeat timeout as the canonical "session ended" signal.

---

## 5. Session Discovery — register/unregister Dance

### Original Approach (Problematic)
For each discovered session file:
```typescript
sessionManager.register({...});    // → status "active", broadcasts session_added
sessionManager.unregister(id);     // → status "ended", triggers onUnregister broadcast
sessionManager.update(id, { hidden: true });
browserGateway.broadcastSessionAdded(session);
```

### Problems
1. `register()` calls `stateStore.setHidden(id, false)` → clears hidden state
2. `unregister()` triggers `onUnregister` → broadcasts `session_updated` to browsers that don't have the session yet
3. For 77 sessions: 77 × 3 = 231 state mutations + 77 × 2 = 154 broadcasts — flooding the browser
4. Race conditions between `session_updated` and `session_added` messages

### Fix: Direct `restore()`
```typescript
sessionManager.restore({
  id, cwd, name, source: "tui", status: "ended",
  startedAt, sessionFile, sessionDir, hidden: true, dataUnavailable: true,
  model, contextTokens, contextWindow,
});
browserGateway.broadcastSessionAdded(session);  // Single broadcast
```
- No register/unregister — quiet restore
- Single broadcast per session
- Stats enrichment runs during restore

---

## 6. Lazy Subscription — Performance Optimization

### Before
- ALL sessions (60+) subscribed on browser connect
- Each subscribe triggered `loadSessionEvents()` from disk
- 60+ concurrent file reads on startup

### After
- **Active sessions** (`status !== "ended"`): auto-subscribed for live events
- **Ended sessions**: subscribed on-demand when user clicks the card
- On connect: only ~5 active sessions load events
- Clicking an ended session triggers subscribe → event load from disk → chat appears

### Default Filter State
`activeOnly` defaults to `true` (stored in localStorage). This means ended sessions are hidden by default. The "Show all" toggle reveals them. The "Show hidden" toggle reveals sessions marked as hidden by the server.

---

## 7. Auto-Resume Behavior Change

### Before
When a session was resumed (via Resume button):
- Old session: `hidden: true` (disappeared from list)
- New session: appears as active

### After
- Old session: stays visible (only `resuming` flag cleared)
- New session: appears as active
- User can see both and manually hide the old one if desired

---

## 8. OpenSpec Bulk Archive — Conflict Resolution

### Conflict Detection
When multiple changes modify the same spec capability:
```
session-grouping → [pinned-directories, fix-pinned-dir-symlink-and-path-display]
```

### Resolution Strategy
1. Read delta specs from each conflicting change
2. Check for actual requirement overlap (different requirements = no real conflict)
3. Apply in chronological order (older first)
4. Both changes implemented → both specs applied

### Spec Merge Process
- New capabilities: `cp delta → main spec`
- Existing capabilities: `cat delta >> existing spec`
- Archive: `mv change-dir → archive/YYYY-MM-DD-name/`

---

## 9. ESM Module Issues

### `require()` in ESM — headless-pid-registry.ts
```typescript
// BROKEN in ESM:
const { EventEmitter } = require("node:events");

// FIX: static import at top level
import { EventEmitter } from "node:events";
```
- The server runs as ESM (`"type": "module"` in package.json)
- `require()` is not available in ESM modules
- This caused server startup to crash with `ReferenceError: require is not defined`
- Only manifested when `cleanupOrphans()` was called (startup with existing headless processes)

---

## 10. Persistence Debounce and Shutdown Race

### The Race
1. Session change triggers `sessionPersistence.save()` (debounced 1s)
2. `/api/shutdown` calls `process.exit(0)` after 100ms
3. Debounce timer hasn't fired → last changes lost

### Fix
Added `sessionPersistence.flush()` and `stateStore.flush()` before `process.exit()` in the `/api/shutdown` handler.

### Note
`SIGINT`/`SIGTERM` handlers call `server.stop()` which flushes correctly. Only the HTTP shutdown endpoint had this gap.

---

## 11. JSON Serialization Behavior

### `undefined` vs `null` in JSON
```javascript
JSON.stringify({ a: 1, b: undefined, c: null })
// → '{"a":1,"c":null}'
```
- `undefined` values are **dropped** from JSON output
- `null` values are **preserved**
- Session fields like `attachedProposal` are `string | null | undefined`
- When never set: `undefined` → not in JSON → restored as `undefined` ✓
- When explicitly detached: `null` → in JSON → restored as `null` ✓
- When attached: `"name"` → in JSON → restored as `"name"` ✓

### Implication
Don't rely on the absence of a field to distinguish "never set" from "explicitly cleared". Use `null` for explicit clearing.

---

## 12. Vitest Process Leak — Operational Hazard

### Symptoms
- 9 orphaned `node (vitest N)` processes consuming ~500MB each
- 92% swap usage (50.9 GiB), 43% memory
- System becomes sluggish

### Cause
Multiple concurrent test runs from different pi sessions. Vitest spawns worker processes that don't always terminate when the parent test run is interrupted.

### Cleanup
```bash
ps aux | grep vitest
kill <pids>
# Or more aggressively:
pkill -f vitest
```

### Prevention
- Don't run tests concurrently from multiple sessions
- Use `--no-file-parallelism` for integration tests that use real ports
- Auto-attach tests with real servers can hang on port conflicts

---

## 13. register() Merge Logic — What Survives Reconnect

When a bridge reconnects to a server with an existing (restored) session, `register()` creates a new session object. What's preserved:

| Field | Preserved? | Source |
|-------|-----------|--------|
| `tokensIn/tokensOut/cacheRead/cacheWrite/cost` | ✓ | Existing session |
| `attachedProposal` | ✓ (fixed) | Existing session |
| `contextTokens/contextWindow` | ✓ (fixed) | Existing session |
| `name` | ✓ (fixed) | `params.name ?? existing.name` |
| `firstMessage` | ✓ (fixed) | `params.firstMessage ?? existing.firstMessage` |
| `model/thinkingLevel` | Overwritten | From bridge registration params |
| `status` | Always "active" | Set by register() |
| `gitBranch/gitPrNumber` | NOT preserved | Re-polled by bridge |
| `openspecPhase/openspecChange` | NOT preserved | Re-polled by bridge |
| `hidden` | Always false | Active sessions must be visible |
| `startedAt` | Preserved | `params.startedAt ?? existing.startedAt` |
| `dataUnavailable` | Always false | Active session has bridge |

---

## 14. Operational Commands Reference

### Build & Deploy
```bash
npm run build              # Vite build of web client
npm run reload             # Reload all connected pi sessions
npm run reload:check       # Type-check + reload all
./scripts/reload-all.sh    # Direct reload script
```

### Server Management
```bash
npx tsx src/server/cli.ts start   # Daemon mode
npx tsx src/server/cli.ts stop    # Stop daemon
npx tsx src/server/cli.ts         # Foreground mode
curl -s -X POST http://localhost:8000/api/shutdown  # HTTP shutdown
```

### Debug
```bash
# Check server health
curl -s http://localhost:8000/api/health

# Query sessions
curl -s http://localhost:8000/api/sessions | node -e "..."

# Check persisted data
cat ~/.pi/dashboard/sessions.json | node -e "..."

# Kill orphaned vitest
pkill -f vitest

# Check session files on disk
ls ~/.pi/agent/sessions/--<encoded-cwd>--/*.jsonl | wc -l
```
