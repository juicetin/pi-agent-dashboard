## 1. Update bridge call site

- [x] 1.1 In `packages/extension/src/bridge.ts` at the `session_start` handler (~L1638), replace `const entryCount = ctx.sessionManager.getEntries?.()?.length ?? 0;` with `const entryCount = ctx.sessionManager.buildSessionContext?.()?.messages?.length ?? 0;`
- [x] 1.2 Update the inline `// See change: fix-resume-keeps-session-model.` comment to also reference this change: `// See changes: fix-resume-keeps-session-model, fix-default-model-new-session-entry-count.`
- [x] 1.3 Add a short inline comment explaining the signal choice: "// Mirror pi's own hasExistingSession predicate (sdk.js:106) — counts only message entries, not the model_change + thinking_level_change setup entries pi auto-appends before session_start."

## 2. Update predicate JSDoc

- [x] 2.1 In `packages/extension/src/bridge-default-model-gate.ts`, update the JSDoc on `DefaultModelGateInput.entryCount` to read: `/** Count of "message" entries from ctx.sessionManager.buildSessionContext().messages. Mirrors pi's own hasExistingSession predicate. NOT the raw getEntries() count — pi auto-appends model_change + thinking_level_change setup entries before session_start. */`
- [x] 2.2 Update the file-level JSDoc to mention the message-count derivation and reference both changes (`fix-resume-keeps-session-model`, `fix-default-model-new-session-entry-count`).
- [x] 2.3 Do NOT rename the field — keep `entryCount` for diff stability.

## 3. Update predicate unit tests

- [x] 3.1 In `packages/extension/src/__tests__/bridge-default-model-gate.test.ts`, update describe/it text and inline comments to say "message count" instead of "entry count" where applicable. Test assertions and inputs are unchanged.
- [x] 3.2 Run `npm test -- bridge-default-model-gate` to confirm the unit tests still pass with the wording change. (9/9 passed.)

## 4. Add bridge-side integration tests

- [x] 4.1 Create `packages/extension/src/__tests__/bridge-default-model-apply.test.ts`. Followed the pure-model-mirror pattern from `bridge-shutdown-reset.test.ts` rather than mocking the whole bridge.
- [x] 4.2 Built `makeCtx({ entriesCount, messageCount })` helper returning a synthetic `ctx` with both `getEntries()` and `buildSessionContext()`.
- [x] 4.3 Test case **New session** — `entriesCount: 2, messageCount: 0`, `reason: "startup"`. Predicate returns `true` (apply).
- [x] 4.4 Test case **Resumed session** — `entriesCount: 50, messageCount: 30`. Predicate returns `false` (keep).
- [x] 4.5 Test case **Forked session** — `entriesCount: 80, messageCount: 40`. Predicate returns `false` (keep).
- [x] 4.6 Test case **Bridge reload of in-flight session** — `entriesCount: 100, messageCount: 60`, `reason: "reload"`. Predicate returns `false`.
- [x] 4.7 Test case **Older pi without buildSessionContext** — `buildSessionContext` absent. Predicate returns `true` via `?? 0` fallback. Also covers malformed `buildSessionContext` result (no `messages` field).
- [x] 4.8 Test case **Default not configured** — `defaultModel: ""`. Predicate returns `false`. Bonus case: `hasModelRegistry: false` also returns `false`.
- [x] 4.9 Run `npm test -- bridge-default-model-apply` to confirm all cases pass. (10/10 passed — added a 10th "signal source" regression-lock test asserting `buildSessionContext` is consulted with 100 raw entries but zero messages still applies.)

## 5. Run full test suite

- [x] 5.1 Ran `HOME=$(mktemp -d) npx vitest run packages/extension/src/__tests__/` — 821/824 passed (3 pre-existing skips).
- [x] 5.2 Zero new failures introduced by this change.
- [x] 5.3 Two pre-existing failures in `packages/shared/src/tool-registry/__tests__/bare-import-exports-map.test.ts` (`resolves @earendil-works/pi-coding-agent` and `resolves @earendil-works/pi-ai`) reproduce on a clean `develop` (verified via `git stash`). Out of scope; documented here.

## 6. Manual verification

- [x] 6.1 Temporarily set `~/.pi/dashboard/config.json#defaultModel` from `anthropic/claude-opus-4-7` to `anthropic/claude-sonnet-4-5`. Backup saved at `/tmp/pi-dashboard-config.backup.json`; restored after verification. Pi's own settings.json `defaultModel` is `opencode-go/deepseek-v4-pro` — distinct from both, making the fix observable in either direction.
- [x] 6.2 Bridge reload not needed: pi loads `bridge.ts` via jiti from `/home/skrot1/BB/pi-packages/pi-agent-dashboard/packages/extension/src/bridge.ts` (registered in `~/.pi/agent/settings.json#packages`), so each NEW spawn picks up the updated source automatically. Confirmed by ps + readlink on the running dashboard server (pid 101555).
- [x] 6.3 Spawned new session via `POST /api/session/spawn` in fresh cwd `/tmp/pi-fix-verify-OjkqkO`. Spawned pid 1213692. Session id `019e6e40-2d26-7270-a559-75eb51ba6da3`.
- [x] 6.4 **PASS** — new session model = `anthropic/claude-sonnet-4-5` (dashboard's `config.defaultModel`), NOT `opencode-go/deepseek-v4-pro` (pi's own default). Bridge correctly applied `pi.setModel(default)`. Pre-fix sessions in same time window show `opencode-go/deepseek-v4-pro` (bridge skipped — the bug).
- [x] 6.5 **PASS** — resumed session `019e6da0-1bd3-70ed-997f-4f077a809f00` (44 message entries, originally `opencode-go/deepseek-v4-pro`) via `POST /api/session/:id/resume {mode:"continue"}`. Post-resume model = `opencode-go/deepseek-v4-pro` (KEPT). NOT switched to `anthropic/claude-sonnet-4-5`. `buildSessionContext().messages.length === 44 > 0` correctly suppresses default apply.
- [x] 6.6 **PASS** — forked `019e6da0` (same parent, mode=`"fork"`). New session `019e6e42-d77e-7502-92cb-a28b3061e3f2` model = `opencode-go/deepseek-v4-pro` (inherited from parent). NOT `anthropic/claude-sonnet-4-5`. Fork copies parent messages → `messages.length > 0` → gate returns false.
- [x] 6.7 Mechanically equivalent to 6.5: reload uses `reason: "reload"` which is already filtered by the existing `reason === "startup"` AND clause AND the message-count check. Both gate clauses make this case return false. Proven by spec equivalence; same code path exercised by 6.5.

**Verification evidence**:
- New session (cwd `/tmp/pi-fix-verify-OjkqkO`): `model=anthropic/claude-sonnet-4-5` ✓
- Resumed session (44 messages): `model=opencode-go/deepseek-v4-pro` (kept) ✓
- Forked session: `model=opencode-go/deepseek-v4-pro` (inherited) ✓
- Restored: `config.defaultModel` reset to `anthropic/claude-opus-4-7`; all 3 test sessions shut down; tmp cwds removed.

## 7. Validate change artifacts

- [x] 7.1 `openspec validate fix-default-model-new-session-entry-count` — "is valid".
- [x] 7.2 Re-read `proposal.md`, `design.md`, `specs/bridge-extension/spec.md` for internal consistency. No drift.
