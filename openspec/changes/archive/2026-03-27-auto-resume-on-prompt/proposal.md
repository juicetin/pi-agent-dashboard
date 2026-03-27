## Why

When a user sends a prompt to an ended session, the message is silently lost - `piGateway.sendToSession()` returns false and the server only logs an error. The user sees their optimistic prompt card but gets no response. They must manually resume the session first and then re-type the prompt. Auto-resume eliminates this friction by detecting the ended state server-side, resuming the session, and forwarding the prompt once the new bridge connects.

## What Changes

- Server-side `send_prompt` handler detects ended sessions and automatically triggers a resume (continue mode) instead of silently failing
- A new `PendingResumeRegistry` queues the prompt and metadata until the resumed session's bridge connects
- On bridge reconnection (`session_register`), the queued prompt is flushed to the resumed session (same session ID) and the `resuming` flag is cleared
- The session card shows a “Resuming…” state (pulsing yellow dot + text) while the resume is in progress
- Resume and Fork buttons are disabled during resuming state
- A 30-second timeout clears the pending resume if the bridge never connects

## Capabilities

### New Capabilities
- `auto-resume-on-prompt`: Server-side detection of prompts sent to ended sessions, prompt queueing, auto-resume orchestration, auto-hide of old session, and browser auto-navigation to the new session

### Modified Capabilities
- `session-resume`: Adds a `resuming` flag to session state and "Resuming..." visual indicator on the session card

## Impact

- `src/shared/types.ts` - Add `resuming?: boolean` to `DashboardSession`
- `src/server/pending-resume-registry.ts` — New file, follows `PendingForkRegistry` pattern
- `src/server/browser-gateway.ts` — `send_prompt` handler: detect ended, queue, spawn, broadcast resuming state; `resume_session` guard for already-resuming
- `src/server/server.ts` — `session_register` handler: check pending resume, flush prompt, clear resuming flag
- `src/client/App.tsx` — Optimistic `resuming` state on Resume/Fork click, clear on failure or `session_added`
- `src/client/components/SessionCard.tsx` — Show “Resuming…” in `ActivityIndicator`, pulsing dot, disabled buttons when `session.resuming` is true
