const HIDDEN_KEY = "dashboard:hiddenSessions";
const ACTIVE_ONLY_KEY = "dashboard:activeOnly";

function getStorage(): Storage {
  return window.localStorage;
}

export function getHiddenSessionIds(): Set<string> {
  try {
    const raw = getStorage().getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id: unknown) => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function setHiddenSessionIds(ids: Set<string>): void {
  getStorage().setItem(HIDDEN_KEY, JSON.stringify([...ids]));
}

export function getActiveOnly(): boolean {
  try {
    const raw = getStorage().getItem(ACTIVE_ONLY_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export function setActiveOnly(value: boolean): void {
  getStorage().setItem(ACTIVE_ONLY_KEY, String(value));
}

/**
 * Remove hidden IDs that are not in the current set of known session IDs.
 * Returns the pruned set.
 */
export function pruneStaleHiddenIds(knownSessionIds: Set<string>): Set<string> {
  const hidden = getHiddenSessionIds();
  const pruned = new Set<string>();
  for (const id of hidden) {
    if (knownSessionIds.has(id)) {
      pruned.add(id);
    }
  }
  setHiddenSessionIds(pruned);
  return pruned;
}
