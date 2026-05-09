/**
 * `mergeConfig` performs a recursive deep-merge of `partial` into `existing`.
 *
 * Rules:
 *  - Plain objects merge recursively.
 *  - Arrays and primitives in `partial` REPLACE the matching key in `existing`.
 *  - `undefined` values in `partial` are skipped (preserve the existing key).
 *  - Unknown top-level keys in `existing` (e.g. honcho-cli writes, future
 *    extension fields) survive untouched — required by spec
 *    honcho-memory-plugin "Atomic write" requirement.
 *  - Empty-string values in `partial` REPLACE — secret-preservation for
 *    `apiKey` is handled at the route layer, NOT here.
 *
 * See change: honcho-dashboard-plugin.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

export function mergeConfig<T extends Record<string, unknown>>(
  existing: T,
  partial: Partial<T> | Record<string, unknown>,
): T {
  if (!isPlainObject(partial)) return existing;
  const out: Record<string, unknown> = { ...existing };
  for (const key of Object.keys(partial)) {
    const incoming = (partial as Record<string, unknown>)[key];
    if (incoming === undefined) continue;
    const current = out[key];
    if (isPlainObject(incoming) && isPlainObject(current)) {
      out[key] = mergeConfig(current, incoming);
    } else {
      out[key] = incoming;
    }
  }
  return out as T;
}
