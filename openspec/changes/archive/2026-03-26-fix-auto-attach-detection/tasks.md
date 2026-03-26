## 1. Fix auto-attach condition in server

- [x] 1.1 Write test: auto-attach triggers when phase and changeName arrive in separate `openspec_activity_update` messages
- [x] 1.2 Write test: auto-attach still works when both arrive in a single message
- [x] 1.3 Write test: no auto-attach when only phase is known (no changeName accumulated)
- [x] 1.4 Write test: no auto-attach when only changeName is known (no phase accumulated)
- [x] 1.5 Change `server.ts` auto-attach condition to check accumulated session state (`session.openspecPhase` and `session.openspecChange`) after applying the update, instead of checking `msg.phase` and `msg.changeName`

## 2. Clear openspec state on detach

- [x] 2.1 Write test: detach clears `openspecPhase` and `openspecChange` along with `attachedProposal`
- [x] 2.2 Write test: after detach, new activity updates can trigger auto-attach again
- [x] 2.3 Update `browser-gateway.ts` detach handler to also set `openspecPhase: null` and `openspecChange: null`
