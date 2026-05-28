/**
 * Pure gate predicate for the bridge's default-model application.
 *
 * Decides whether the bridge should call `pi.setModel()` with `config.defaultModel`
 * at `session_start` time.
 *
 * Rule: apply default only on brand-new sessions (no prior message history).
 * Resumed (`--session`), forked (`--fork`, parent messages copied by
 * `SessionManager.forkFrom`), and reloaded sessions all have messages > 0 and
 * SHALL keep their existing model. Mirrors pi's own `!hasExistingSession`
 * gate (`pi-coding-agent/dist/core/sdk.js:106` —
 * `existingSession.messages.length > 0`).
 *
 * Signal derivation: `ctx.sessionManager.buildSessionContext().messages.length`,
 * NOT the raw `getEntries()` count. Pi's sdk.js auto-appends `model_change` and
 * `thinking_level_change` setup entries to a brand-new session BEFORE emitting
 * `session_start`, so `getEntries()` is ≥ 2 even for sessions with no user
 * history; only `buildSessionContext().messages` correctly distinguishes
 * "brand-new" from "has history".
 *
 * See changes: fix-resume-keeps-session-model (original gate),
 *              fix-default-model-new-session-entry-count (signal correction).
 */
export interface DefaultModelGateInput {
  /** `event.reason` from the pi `session_start` event. */
  reason: string | undefined;
  /**
   * Count of `message` entries from
   * `ctx.sessionManager.buildSessionContext().messages`. Mirrors pi's own
   * `hasExistingSession` predicate. NOT the raw `getEntries()` count — pi
   * auto-appends `model_change` + `thinking_level_change` setup entries
   * before `session_start`. Field name kept as `entryCount` for diff stability
   * with the original `fix-resume-keeps-session-model` change.
   */
  entryCount: number;
  /** Whether the bridge has captured a model registry from pi yet. */
  hasModelRegistry: boolean;
  /** Whether `config.defaultModel` is set to a non-empty string. */
  hasDefaultModel: boolean;
}

export function shouldApplyDefaultModel(args: DefaultModelGateInput): boolean {
  if (args.reason !== "startup") return false;
  if (args.entryCount !== 0) return false;
  if (!args.hasModelRegistry) return false;
  if (!args.hasDefaultModel) return false;
  return true;
}
