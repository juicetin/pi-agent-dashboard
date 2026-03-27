# Session Knowledge: c4a0a521 (2026-03-25)

**Session ID**: c4a0a521-dd40-4cd6-8a7a-0e090b3fe9ce  
**Duration**: ~3+ hours of continuous work  
**Focus Areas**: Command handling, session state management, OpenSpec integration, dashboard restart issues

---

## Critical Bugs & Issues Found

### 1. !! Command Loading State Never Clears
**Problem**: When executing `!!` (bash command without LLM context), the command card stays in a loading state indefinitely. Refresh hides it but doesn't properly complete the state.

**Root Cause**: The `pendingPrompt` state in the event reducer is only cleared by:
- `agent_start` events
- `message_start` with user role

For `!!` commands, there's no `agent_start` because the command runs directly (excludeFromContext: true) and sends only a `bash_output` event, never triggering the LLM.

**Solution Required**: Clear `pendingPrompt` when `bash_output` or `command_feedback` events are received in the event reducer.

**Discovery**: This is a critical UX issue affecting direct bash commands that should be fast and responsive.

---

### 2. OpenSpec Archive State Lost After Dashboard Restart
**Problem**: When dashboard restarts, the session-to-OpenSpec change attachments are lost. Previously attached changes no longer appear on session cards.

**Location**: Session state persistence layer  
**Impact**: Users lose work context and change associations when dashboard restarts  
**Discovery**: Session metadata persistence needs to include OpenSpec attachment state, not just session visibility

---

### 3. Inactive & Ended Session Logs Not Loading
**Problem**: When selecting an inactive or ended session card, the chat log doesn't load. Messages don't appear to replay from session file.

**Related Issues**:
- Context usage statistics not loaded for inactive sessions
- Session file reader doesn't load initial token/cost stats on startup
- Lazy loading approach doesn't work for session card state refresh

**Discovery**: Session initialization needs to eagerly load token stats and message count before display, not lazily on selection.

---

### 4. Context Usage Stats Not Persisted for Inactive Sessions
**Problem**: Inactive sessions show no context usage progressbar. The stats are lost when session becomes inactive.

**Question Raised**: Inactive session showed 200k tokens - where does this come from? Need to understand max context length storage.

**Infrastructure Gap**: Need a tool to extract session-level stats from pi session .jsonl files for initial card state population.

---

### 5. Session Card State Not Updating on Page Refresh
**Problem**: When hiding/unhiding sessions or after resuming a session, the card status doesn't update properly.

**Specific Case**: "Show hidden" doesn't display all pi sessions for the cwd. Hidden sessions appear when unhidden, but auto-resumed sessions shouldn't be hidden.

**Discovery**: Session visibility state and session status state (idle/streaming/ended) are getting out of sync.

---

## Performance Issues

### OpenSpec Operations Taking Several Seconds
**Problem**: Attaching, detaching, and executing OpenSpec commands consistently take 3-5+ seconds to respond.

**Areas Affected**:
- Change attachment from combo box (should show "Attaching..." indicator)
- Change detachment
- OpenSpec command execution

**Discovery**: This is significantly worse than expected for local operations. Likely causes:
- Unnecessary rebuilds on `/reload` trigger
- File I/O contention
- State synchronization overhead between server and bridge

**Needed**: Performance profiling to identify bottleneck.

---

## Infrastructure & Architecture Discoveries

### The `/reload` Command Behavior
**Fact**: `/reload` is an internal pi command, not a Dashboard command  
**Discovery**: It doesn't always trigger properly through the command handler  
**Problem**: Code catches the command so errors are hidden from the assistant  
**Solution Created**: `scripts/reload-all.sh` script that:
- Builds the bridge TypeScript
- Finds all connected pi sessions via WebSocket  
- Sends reload message to each session

### Dashboard Build Configuration Issue
**Discovery**: Dashboard config can disable building and stop server for `/reload` calls  
**Impact**: This prevents bridge code from reloading on development changes  
**Question**: Why would you disable this? Seems like a footgun.

### TypeScript Compilation in Event Loop
**Problem**: `reload-all.sh --check` compiles tests (slow) even though only type-checking is needed  
**Specific Error Found**:
```
src/client/components/MarkdownContent.tsx(182,21): error TS2769
  Type 'Record<string, unknown>' not assignable to 'CSSProperties'
```
**Discovery**: SyntaxHighlighter type definitions are too strict. Needs type casting or version update.

---

## State Management Gaps

### Session State Initialization
**Discovery**: Sessions need to load full state on startup, not lazy-load on selection:
- Token stats (input, output, cache read/write)
- Cost accumulation
- Context window and usage
- Message count
- Model and thinking level

**Tool Needed**: Session file reader that can extract these stats from .jsonl files synchronously during app initialization.

### Session Visibility & Status Sync
**Problems**:
- Hidden state not properly synchronized with actual session status
- Auto-resumed sessions should not be hidden
- Visibility state and connection status getting out of sync

**Discovery**: The hidden/visible toggle and actual pi session list need bidirectional sync. Current unidirectional flow loses state on restart.

---

## Electron Embedding Discussion

**Topic**: How to embed this 3-process architecture into an Electron app

**Current Architecture (Web-based)**:
```
Pi Sessions (bridge ext) ←→ Dashboard Server ←→ Browser (React)
             WebSocket 9999         WebSocket 8000 (/ws)
```

**Proposed Electron Model** (2-process):
- Main process: Bundle dashboard server + React app
- Render process: The React UI
- Bridge: Still runs as pi extension in separate pi sessions

**Key Question**: How would the bridge connect to the embedded server when running inside Electron? Would need:
- Named pipes instead of TCP on some platforms
- Electron IPC bridge layer
- Headless session manager integration

---

## Important Discoveries & Surprises

### 1. Connected Session Discovery Works Well
**Discovery**: The `reload-all.sh` script successfully finds 5+ connected sessions by querying the Dashboard server's active WebSocket connections. This is the right approach.

### 2. Vitest Process Accumulation
**Issue**: Running reload repeatedly causes vitest processes to pile up  
**Fix Used**: `killall vitest`  
**Discovery**: Build system isn't properly cleaning up child processes

### 3. Blue Logo Styling
**Change Made**: Type logo (droid icon) changed to blue to match CLI appearance  
**Discovery**: Small visual consistency improvements have measurable impact on perceived quality

### 4. Session Card Stats Must Be Eager-Loaded
**Discovery**: Lazy loading stats on selection breaks the UX because:
- Users can't see which sessions are actually active without scrolling
- Page refreshes lose all visual state
- Multiple cards with no stats look like loading errors
- Forces users to click each card to see its status

**Solution**: Load token/cost stats for ALL visible cards during app initialization, not on demand.

---

## What Did NOT Work

### 1. Lazy Loading Session Stats
- Breaks UX for fast visibility scanning
- Loses state on page refresh
- Creates false sense of loading errors

### 2. Build-on-Reload with Test Compilation
- Makes development loop too slow
- Type-checking tests is unnecessary overhead
- Should only rebuild bridge TypeScript, not test suite

### 3. Auto-Hide Resumed Sessions
- Users don't expect sessions to disappear
- "Show hidden" filter becomes confusing
- Should keep visibility state explicit

### 4. Unidirectional Session State Updates
- Server restart loses session-to-spec attachments
- Hidden state doesn't persist across restarts
- Visibility toggles not durable

---

## Technical Debt & Refactoring Opportunities

1. **Event Reducer Cleanup**: `pendingPrompt` should clear on `bash_output` and `command_feedback`, not just `agent_start`

2. **Session Initialization**: Create a unified "bootstrap" phase that:
   - Loads all session metadata from disk
   - Extracts token stats from .jsonl files
   - Populates card state before first render

3. **State Persistence**: Extend session JSON storage to include:
   - OpenSpec attachment ID
   - Last known status (idle/streaming/ended)
   - Token stats snapshot
   - Visibility flag

4. **Performance Audit**: Profile:
   - OpenSpec operation latency chain
   - File I/O patterns during reload
   - WebSocket message throughput
   - React reconciliation for card updates

5. **Build Configuration**: Decouple:
   - Bridge TypeScript compilation (required)
   - Test compilation (optional for dev)
   - Dashboard server restart (optional)

---

## Patterns & Conventions Observed

- **Command Routing**: Commands with `!!` prefix are bash-only (no LLM), `!` includes LLM context, `/` are slash commands
- **Event Types**: bash_output, command_feedback, message_start/end, agent_start/end, tool_execution_*, turn_end, stats_update
- **Session Status**: idle, streaming, ended
- **WebSocket Messaging**: Server→Extension via port 9999, Server↔Browser via port 8000
- **Script Pattern**: Simple shell scripts in `/scripts/` for integration tasks (reload-all.sh)

---

## Questions for Follow-up

1. Why does the 200k token count appear for inactive sessions?
2. What's the actual bottleneck in OpenSpec operations (profiling needed)?
3. Should "Show hidden" be a checkbox or a completely separate view?
4. Can we pre-compile session stats on the server to avoid client-side I/O?
5. How should Electron embedding handle the bridge connection discovery?

---

## Summary

This was a highly productive session that uncovered several critical UX bugs, a major state persistence issue, and important architectural insights about session initialization and state management. The team discovered that:

1. Direct bash commands (`!!`) have a broken UX due to event reducer gaps
2. Session state must be eagerly loaded on app startup for usability
3. Build tooling needs separation of concerns (bridge vs tests)
4. OpenSpec operations need performance investigation
5. State durability across restarts requires explicit persistence

The session produced working reload infrastructure (`reload-all.sh`), identified specific TypeScript compilation issues, and clarified the path forward for Electron embedding.
