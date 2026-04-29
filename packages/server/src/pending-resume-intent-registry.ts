/**
 * In-memory tracker for user-initiated session-resume intents.
 *
 * Purpose: distinguish ended→alive transitions caused by a deliberate user
 * action (Resume click, drag-to-resume, REST resume) from those caused by a
 * bridge auto-reattach on dashboard reboot. The `sessionManager.onChange`
 * hook in `server.ts` consults this registry in its ended→alive branch:
 *
 *   - if `consume(sessionId)` returns true  → user intent → reorder + broadcast
 *   - if `consume(sessionId)` returns false → bridge reattach → leave order alone
 *
 * Tagging happens in `handleResumeSession` (WS) and the `/api/session/:id/resume`
 * handler (REST), immediately before `spawnPiSession`. Both drag-to-resume and
 * a plain Resume click flow through `handleResumeSession`, so a single tag site
 * covers both.
 *
 * In-memory only. NOT persisted across server restarts. Stale entries (older
 * than `ttlMs`, default 60 s) are silently dropped on read so a failed spawn
 * cannot poison a later legitimate reattach.
 *
 * See change: preserve-session-order-on-reboot.
 */

export const PENDING_RESUME_INTENT_TTL_MS = 60_000;

export interface PendingResumeIntentRegistry {
  /**
   * Tag a session id as user-resume-initiated. Idempotent — re-recording the
   * same id refreshes the timestamp without producing duplicate entries.
   */
  record(sessionId: string): void;
  /**
   * Returns true and clears the entry iff the session was tagged within the
   * TTL window. Stale entries are dropped silently and `false` is returned.
   */
  consume(sessionId: string): boolean;
  /** Test helper — number of live (non-expired) entries. */
  size(): number;
}

export interface PendingResumeIntentRegistryOptions {
  /** Override the TTL in milliseconds. Defaults to 60_000. */
  ttlMs?: number;
  /** Override `Date.now` for tests. */
  now?: () => number;
}

export function createPendingResumeIntentRegistry(
  opts: PendingResumeIntentRegistryOptions = {},
): PendingResumeIntentRegistry {
  const ttl = opts.ttlMs ?? PENDING_RESUME_INTENT_TTL_MS;
  const now = opts.now ?? (() => Date.now());

  // sessionId -> timestamp of most recent record() call.
  const store = new Map<string, number>();

  function pruneStale(): void {
    const cutoff = now() - ttl;
    for (const [id, ts] of store) {
      if (ts < cutoff) store.delete(id);
    }
  }

  return {
    record(sessionId: string): void {
      if (!sessionId) return;
      // Refresh-on-rerecord is intentional: a second user click on Resume
      // for the same session should not be silently classified as stale
      // because the first click's timestamp aged out.
      store.set(sessionId, now());
    },

    consume(sessionId: string): boolean {
      if (!sessionId) return false;
      const ts = store.get(sessionId);
      if (ts === undefined) return false;
      if (ts < now() - ttl) {
        store.delete(sessionId);
        return false;
      }
      store.delete(sessionId);
      return true;
    },

    size(): number {
      pruneStale();
      return store.size;
    },
  };
}
