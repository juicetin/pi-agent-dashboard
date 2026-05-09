/**
 * Re-export of the public types defined in shared/types.ts plus
 * server-internal helper types for the per-source fetcher result.
 *
 * See change: honcho-dashboard-plugin (design D12).
 */
export type {
  LlmSource,
  ModelEntry,
  SourceModelsResponse,
  AggregateModelsResponse,
} from "../../shared/types.js";

export type FetcherResult<T> = { ok: true; value: T } | { ok: false; error: Error };
