## 1. SessionCard button

- [ ] 1.1 Add `onSpawnSibling?: (session: Session) => void` prop to `SessionCard.tsx`.
- [ ] 1.2 Render `<button>` in the existing fork/resume pill row with `mdiPlus` (or `mdiPlusCircleOutline`) icon + label `+Session`. `data-testid="session-card-spawn-sibling"`.
- [ ] 1.3 Visibility: render unconditionally when `onSpawnSibling` is supplied. NO gating on `session.status === "ended"` or `session.sessionFile`.
- [ ] 1.4 `disabled={!!session.cwdMissing}`; tooltip: `cwdMissing ? "session's directory no longer exists" : "Spawn clean sibling session in same folder"`.
- [ ] 1.5 Click: `e.stopPropagation(); onSpawnSibling(session);`.

## 2. SessionCard tests

- [ ] 2.1 Renders button for live session (`status !== "ended"`).
- [ ] 2.2 Renders button for ended session (Fork visible) — both buttons coexist.
- [ ] 2.3 Renders button when `sessionFile` absent (regression guard against accidental Fork-style gating).
- [ ] 2.4 Click invokes handler with the session.
- [ ] 2.5 `cwdMissing === true` → `disabled` attribute set; tooltip changes.
- [ ] 2.6 No handler → button absent (parity with existing optional props).

## 3. Wiring

- [ ] 3.1 Locate every `<SessionCard>` render site. Pass `onSpawnSibling={(s) => handleSpawnSibling(s)}` from the same level that owns ws send (likely `SessionList.tsx` and/or `App.tsx`).
- [ ] 3.2 Implement `handleSpawnSibling(session)`:
  - Mint `requestId = uuidv4()`.
  - Send `{ type: "spawn_session", cwd: session.cwd, ...(session.attachedProposal ? { attachProposal: session.attachedProposal } : {}), requestId }` over the existing ws send channel.
  - On success toast: rely on existing `spawn_result` handler for feedback (no new toast).
- [ ] 3.3 Confirm there is exactly ONE handler implementation. If the codebase has parallel ws send helpers (mobile vs desktop), share via a single `spawnSibling(session)` helper.

## 4. Wiring tests

- [ ] 4.1 jsdom test: render a session with `attachedProposal: "add-dark-mode"`, click `+Session`, assert ws.send called with payload containing `attachProposal: "add-dark-mode"` + `cwd: session.cwd`.
- [ ] 4.2 jsdom test: session with `attachedProposal: undefined`, click → payload omits `attachProposal` key entirely.
- [ ] 4.3 jsdom test: session with `cwdMissing: true` → button disabled, click does NOT send.

## 5. Docs

- [ ] 5.1 `docs/file-index-client.md` — append the new prop + behavior to the `SessionCard.tsx` row (caveman style, delegated subagent).
- [ ] 5.2 No `docs/architecture.md` change.

## 6. Verification

- [ ] 6.1 `npm test` all green.
- [ ] 6.2 Manual: live session with attached proposal — click `+Session`, confirm new session lands in same folder with proposal pre-attached.
- [ ] 6.3 Manual: live session without proposal — click `+Session`, confirm new session lands in same folder with no proposal.
- [ ] 6.4 Manual: ended session — `Resume`, `Fork`, AND `+Session` all coexist on the card.
- [ ] 6.5 Manual: worktree session — `+Session` spawns inside the worktree cwd, NOT the main repo. Document this in the new SessionCard test as a comment so future reviewers don't break it.
