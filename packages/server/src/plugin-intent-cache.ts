/**
 * Server-side cache of the most recent plugin intent per
 * (pluginId, sessionId, slot). Used to replay current state to
 * reconnecting clients on subscribe.
 *
 * See change: adopt-server-driven-intent-rendering.
 */
import type { IntentNode } from "@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/intent-types.js";
import type { SlotId } from "@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/slot-types.js";

export interface CachedIntentEntry {
  pluginId: string;
  sessionId: string | null;
  slot: SlotId;
  intent: IntentNode;
}

function key(pluginId: string, sessionId: string | null, slot: SlotId): string {
  return `${pluginId}|${sessionId ?? ""}|${slot}`;
}

export class PluginIntentCache {
  private map = new Map<string, CachedIntentEntry>();

  /**
   * Store the intent for a (pluginId, sessionId, slot) tuple.
   * If `intent` is null, remove the entry (the plugin is clearing its
   * contribution to that slot).
   */
  set(pluginId: string, sessionId: string | null, slot: SlotId, intent: IntentNode | null): void {
    const k = key(pluginId, sessionId, slot);
    if (intent === null) {
      this.map.delete(k);
      return;
    }
    this.map.set(k, { pluginId, sessionId, slot, intent });
  }

  /** Return every intent currently cached for a given session. */
  getForSession(sessionId: string | null): CachedIntentEntry[] {
    const out: CachedIntentEntry[] = [];
    for (const entry of this.map.values()) {
      if (entry.sessionId === sessionId) out.push(entry);
    }
    return out;
  }

  /** Return EVERY cached intent (e.g. for global slots with sessionId=null). */
  getAll(): CachedIntentEntry[] {
    return Array.from(this.map.values());
  }

  /** Remove every entry for a given session (called on session removal). */
  clearForSession(sessionId: string | null): void {
    for (const [k, entry] of this.map) {
      if (entry.sessionId === sessionId) this.map.delete(k);
    }
  }

  /** Test-only: clear the entire cache. */
  reset(): void {
    this.map.clear();
  }
}

/** Module singleton — every call site shares the same cache. */
export const pluginIntentCache = new PluginIntentCache();
