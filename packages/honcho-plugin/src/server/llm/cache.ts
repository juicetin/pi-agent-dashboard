/**
 * In-memory per-source TTL cache for the aggregate `/models` endpoint.
 * No persistence — first call after dashboard restart re-fetches.
 *
 * See change: honcho-dashboard-plugin (design D12).
 */
import type { LlmSource, SourceModelsResponse } from "./types.js";

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  response: SourceModelsResponse;
  /** Absolute deadline for cache validity. */
  expiresAt: number;
}

export class ModelsCache {
  private map = new Map<LlmSource, Entry>();
  constructor(private now: () => number = () => Date.now(), private ttlMs = TTL_MS) {}

  get(source: LlmSource): SourceModelsResponse | null {
    const e = this.map.get(source);
    if (!e) return null;
    if (this.now() >= e.expiresAt) {
      this.map.delete(source);
      return null;
    }
    return e.response;
  }

  set(source: LlmSource, response: SourceModelsResponse): void {
    this.map.set(source, { response, expiresAt: this.now() + this.ttlMs });
  }

  bust(source?: LlmSource): void {
    if (source) {
      this.map.delete(source);
      return;
    }
    this.map.clear();
  }

  /** Test-only: peek raw entry. */
  peek(source: LlmSource): Entry | undefined {
    return this.map.get(source);
  }
}

let singleton: ModelsCache | null = null;

export function getDefaultModelsCache(): ModelsCache {
  if (!singleton) singleton = new ModelsCache();
  return singleton;
}

/** Test-only reset. */
export function resetDefaultModelsCache(): void {
  singleton = null;
}
