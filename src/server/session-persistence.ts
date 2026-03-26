/**
 * Persists visible (non-hidden) session metadata to JSON file.
 * Sessions survive server restarts; events are loaded on-demand.
 */
import path from "node:path";
import { CONFIG_DIR } from "../shared/config.js";
import { readJsonFile, writeJsonFile } from "./json-store.js";
import type { DashboardSession } from "../shared/types.js";

export const SESSIONS_FILE = path.join(CONFIG_DIR, "sessions.json");

/** Fields to strip from persisted data (transient/large). */
const TRANSIENT_FIELDS: (keyof DashboardSession)[] = [
  "currentTool",
  "dataUnavailable",
];

export interface SessionPersistence {
  /** Load persisted sessions from disk. */
  load(): DashboardSession[];
  /** Schedule a save of the given sessions (debounced). Hidden sessions are excluded. */
  save(sessions: DashboardSession[]): void;
  /** Flush pending writes immediately. */
  flush(): void;
  /** Stop debounce timer. */
  dispose(): void;
}

const DEBOUNCE_MS = 1000;

export function createSessionPersistence(
  filePath: string = SESSIONS_FILE,
): SessionPersistence {
  let pendingSessions: DashboardSession[] | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function filterAndClean(sessions: DashboardSession[]): Record<string, unknown>[] {
    return sessions
      .filter((s) => !s.hidden)
      .map((s) => {
        const cleaned = { ...s } as Record<string, unknown>;
        for (const field of TRANSIENT_FIELDS) {
          delete cleaned[field];
        }
        return cleaned;
      });
  }

  function writeNow(): void {
    if (pendingSessions === null) return;
    const data = filterAndClean(pendingSessions);
    pendingSessions = null;
    writeJsonFile(filePath, data);
  }

  function scheduleSave(): void {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      writeNow();
    }, DEBOUNCE_MS);
  }

  return {
    load(): DashboardSession[] {
      return readJsonFile<DashboardSession[]>(filePath, []);
    },

    save(sessions: DashboardSession[]): void {
      pendingSessions = sessions;
      scheduleSave();
    },

    flush(): void {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      writeNow();
    },

    dispose(): void {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}
