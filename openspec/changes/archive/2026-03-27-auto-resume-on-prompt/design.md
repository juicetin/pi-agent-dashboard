## Context

Currently, `send_prompt` in `browser-gateway.ts` forwards directly to the pi bridge via `piGateway.sendToSession()`. When the session is ended (bridge disconnected), `sendToSession` returns `false` and the prompt is silently lost. The user sees their optimistic prompt card but never gets a response.

The existing `resume_session` flow spawns a new pi process via `spawnPiSession()` (tmux or headless) and the new bridge registers via `session_register` in `server.ts`. The `PendingForkRegistry` already solves a similar "link old → new session" problem by keying on `cwd` with a 30-second expiry.

Key constraint: `pi --session <file>` continues with the same session file and reuses the **same session ID**. The session transitions in-place from `ended` → `active` via `session_register`. The pending prompt is matched by `cwd` (same pattern as `PendingForkRegistry`).

## Goals / Non-Goals

**Goals:**
- Automatically resume an ended session when the user sends a prompt to it
- Queue the prompt and forward it to the resumed session once the bridge connects
- Show visual feedback ("Resuming…" with pulsing dot) on the old session card
- Handle failures gracefully (no session file, spawn failure, timeout)

**Non-Goals:**
- Fork mode — auto-resume always uses continue mode
- Queuing multiple prompts — last prompt wins if user sends again while resuming
- Resuming from a different client (auto-resume is scoped to the browser that sent the prompt)
- Changing the existing manual resume/fork flow

## Decisions

### 1. Server-side orchestration in `browser-gateway.ts`
**Decision**: Handle auto-resume entirely in the `send_prompt` case of `browser-gateway.ts`, with flush logic in `server.ts` at `session_register` time.

**Rationale**: The server already knows session status and has access to both `sessionManager` and `piGateway`. Client-side orchestration would require coordinating `resume_session` → wait for status change → `send_prompt`, introducing race conditions and spreading logic across client and server.

### 2. `PendingResumeRegistry` keyed by `cwd`
**Decision**: Create a `PendingResumeRegistry` following the `PendingForkRegistry` pattern — a `Map<cwd, PendingResume>` with 30-second expiry timers.

**Rationale**: When `pi --session` spawns, the new session registers with the same `cwd` but a different session ID. Keying by `cwd` works because: (a) only one resume can be in-flight per cwd at a time, and (b) the `PendingForkRegistry` proves this pattern is reliable.

**Alternative considered**: Keying by `sessionFile` and matching on `session_register`'s `sessionFile` field. More precise but adds complexity for no practical benefit — concurrent resumes in the same cwd are not a realistic scenario.

### 3. `resuming` flag on `DashboardSession`
**Decision**: Add an optional `resuming?: boolean` field to `DashboardSession` and broadcast it via `session_updated`.

**Rationale**: The session card's `ActivityIndicator` can check this flag to render "Resuming…" with a pulsing yellow dot. Using an existing `SessionStatus` value (e.g., setting status to "streaming") would be misleading. A separate boolean is clean, doesn't affect other status-dependent logic, and is easy to clear on timeout or success.

### 4. In-place session transition (no hide, no navigate)
**Decision**: Since `pi --session` reuses the same session ID, the session transitions in-place from `ended` → `active` via `session_register`. No hiding or navigation is needed — the user is already viewing the correct session.

**Rationale**: Originally assumed `pi --session` would create a new session ID, but testing revealed it reuses the same ID. The session manager's `register()` sets `status: "active"` and `hidden: false`, and broadcasts `session_added` which the client merges in place.

### 5. Prompt forwarding at `session_register` time
**Decision**: In `server.ts`, after processing `session_register`, check `pendingResumeRegistry` for the registering session's `cwd`. If a pending resume exists, send the queued prompt to the new session via `piGateway.sendToSession()`, hide the old session, and broadcast navigation.

**Rationale**: `session_register` is the earliest reliable point where the bridge is connected and ready to receive messages. The `PendingForkRegistry.consumeFork()` is already called here, so adding pending resume consumption follows the same pattern.

## Risks / Trade-offs

- **[Risk] Multiple ended sessions share the same `cwd`** → The registry stores the specific `oldSessionId` for clearing the `resuming` flag. The cwd key is only for matching the incoming `session_register`, which is safe because only one resume can be in-flight per cwd.

- **[Risk] Bridge never connects (spawn failure, crash)** → 30-second timeout clears the pending resume, resets the `resuming` flag on the old session, and broadcasts `session_updated` to restore the card to normal ended state.

- **[Risk] User sends another prompt while resuming** → The registry overwrites the previous entry for the same cwd, so only the latest prompt is forwarded. The old timer is cleared. A second spawn is not triggered if `session.resuming` is already true.

- **[Trade-off] Only continue mode, not fork** → Auto-resume always continues. Fork semantics (creating a new branch) require explicit user intent and don't make sense as an automatic action from sending a prompt.
