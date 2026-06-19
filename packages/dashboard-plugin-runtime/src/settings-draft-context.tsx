/**
 * Settings draft registry — lets settings sections (built-in AND plugin)
 * buffer edits and commit them through the host Settings panel's single
 * "Save" action instead of autosaving on every change.
 *
 * A section calls `useSettingsDraftSource({ id, page, isDirty, commit, reset })`.
 * The host (SettingsPanel) provides the registry, aggregates dirtiness across
 * every registered source for the Save Bar + per-page dirty dots, and invokes
 * each dirty source's `commit` on Save / `reset` on Discard.
 *
 * Sections that do NOT call the hook keep their own autosave behavior and are
 * simply absent from the dirty set (coexist + flag). The provider is optional:
 * when no provider is mounted the hook is a no-op so sections render unchanged
 * outside the Settings panel.
 *
 * See change: unify-settings-save-contract.
 */
import React, { createContext, useContext, useEffect, useRef } from "react";

/** A buffered settings source contributing to the unified Save. */
export interface SettingsDraftSource {
  /** Stable unique id (e.g. "display-prefs", "plugin:roles"). */
  id: string;
  /** Settings page id this source lives on (for per-page dirty dots). */
  page: string;
  /** True when the source has unsaved edits. */
  isDirty: boolean;
  /** Persist the source's draft. MUST reject on failure (kept dirty + retry). */
  commit: () => Promise<void>;
  /** Revert the source's draft to its loaded baseline. */
  reset: () => void;
}

/** Stored form held by the host: dirty flag + stable delegating callbacks. */
export interface RegisteredSource {
  page: string;
  isDirty: boolean;
  commit: () => Promise<void>;
  reset: () => void;
}

export interface SettingsDraftRegistry {
  /** Insert or update a source by id. */
  upsert: (id: string, source: RegisteredSource) => void;
  /** Remove a source by id (on unmount). */
  remove: (id: string) => void;
}

const SettingsDraftContext = createContext<SettingsDraftRegistry | null>(null);

export function SettingsDraftProvider({
  registry,
  children,
}: {
  registry: SettingsDraftRegistry;
  children: React.ReactNode;
}) {
  return (
    <SettingsDraftContext.Provider value={registry}>
      {children}
    </SettingsDraftContext.Provider>
  );
}

/**
 * Register a settings source with the host's unified-Save registry.
 *
 * `commit`/`reset` are captured in refs so the host always calls the latest
 * closures without forcing a re-register every render. Re-registration fires
 * only when `id`, `page`, or `isDirty` change. No-op when no provider mounted.
 */
export function useSettingsDraftSource(source: SettingsDraftSource): void {
  const registry = useContext(SettingsDraftContext);
  const commitRef = useRef(source.commit);
  const resetRef = useRef(source.reset);
  commitRef.current = source.commit;
  resetRef.current = source.reset;

  const { id, page, isDirty } = source;

  useEffect(() => {
    if (!registry) return;
    registry.upsert(id, {
      page,
      isDirty,
      commit: () => commitRef.current(),
      reset: () => resetRef.current(),
    });
  }, [registry, id, page, isDirty]);

  useEffect(() => {
    if (!registry) return;
    return () => registry.remove(id);
  }, [registry, id]);
}
