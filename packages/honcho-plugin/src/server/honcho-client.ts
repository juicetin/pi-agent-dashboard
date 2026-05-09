/**
 * Honcho SDK client wrapper. Cached on first config read; rebuilt when
 * `apiKey`, `endpoint`, or `workspace` change.
 *
 * The Honcho SDK is dynamically imported to keep the plugin loadable even
 * when @honcho-ai/sdk isn't installed in the dashboard's node_modules
 * (e.g. tests).
 *
 * See change: honcho-dashboard-plugin (spec honcho-memory-plugin).
 */
import type { HonchoPluginConfig } from "../shared/types.js";

interface ClientCacheKey {
  apiKey: string | undefined;
  endpoint: string | undefined;
  workspace: string | undefined;
}

interface CachedClient {
  key: ClientCacheKey;
  client: unknown;
}

let cached: CachedClient | null = null;

function keyOf(cfg: HonchoPluginConfig): ClientCacheKey {
  return {
    apiKey: cfg.apiKey,
    endpoint: cfg.hosts?.pi?.endpoint,
    workspace: cfg.workspace,
  };
}

function sameKey(a: ClientCacheKey, b: ClientCacheKey): boolean {
  return a.apiKey === b.apiKey && a.endpoint === b.endpoint && a.workspace === b.workspace;
}

/**
 * Resolve a Honcho SDK client for the given config. Returns `null` when
 * `@honcho-ai/sdk` is not importable (treated as a soft failure so callers
 * can surface it as a doctor check rather than crashing).
 */
export async function getHonchoClient(
  cfg: HonchoPluginConfig,
): Promise<unknown | null> {
  const key = keyOf(cfg);
  if (cached && sameKey(cached.key, key)) return cached.client;
  let mod: { Honcho?: new (opts: unknown) => unknown };
  try {
    mod = (await import("@honcho-ai/sdk")) as typeof mod;
  } catch {
    return null;
  }
  const Honcho = mod.Honcho;
  if (!Honcho) return null;
  const client = new Honcho({
    apiKey: cfg.apiKey ?? "",
    baseURL: cfg.hosts?.pi?.endpoint,
    workspaceId: cfg.workspace,
  });
  cached = { key, client };
  return client;
}

/** Test-only: reset the singleton. */
export function resetHonchoClient(): void {
  cached = null;
}

/**
 * Run the SDK call `aiPeer.conclusionsOf(userPeer).create({ content })`
 * against the configured workspace + peers. Returns `{ ok, conclusionId? }`.
 *
 * Implementation is defensive: SDK shape may differ across major versions.
 */
export async function createConclusion(
  cfg: HonchoPluginConfig,
  content: string,
): Promise<{ ok: boolean; conclusionId?: string; error?: string }> {
  const client = await getHonchoClient(cfg);
  if (!client) return { ok: false, error: "honcho sdk not available" };
  const peerName = cfg.peerName;
  const aiPeerName = cfg.aiPeer;
  if (!peerName || !aiPeerName) {
    return { ok: false, error: "peerName and aiPeer must be configured" };
  }
  try {
    // Optimistic SDK shape; gated on runtime introspection so a method-name
    // drift surfaces as a clean error rather than a stack trace.
    const c = client as Record<string, unknown>;
    const peer = (c.peer as undefined | ((n: string) => unknown))?.(peerName);
    const aiPeer = (c.peer as undefined | ((n: string) => unknown))?.(aiPeerName);
    if (!peer || !aiPeer) {
      return { ok: false, error: "honcho SDK peer() returned undefined" };
    }
    const aiP = aiPeer as Record<string, unknown>;
    const conclOf = aiP.conclusionsOf as undefined | ((p: unknown) => unknown);
    if (!conclOf) {
      return { ok: false, error: "honcho SDK aiPeer.conclusionsOf is not a function" };
    }
    const conclSet = conclOf(peer) as { create?: (b: unknown) => Promise<unknown> };
    if (!conclSet.create) {
      return { ok: false, error: "honcho SDK conclusion set has no create()" };
    }
    const result = (await conclSet.create({ content })) as { id?: string };
    return { ok: true, conclusionId: result?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
