/**
 * Client-side browse API helper for the PathPicker component.
 */
import type {
  BrowseResult,
  MkdirResult,
} from "@blackbelt-technology/pi-dashboard-shared/rest-api.js";
import { getApiBase } from "./api-context.js";

export interface BrowseOptions {
  /** Optional substring query. Empty / whitespace is treated as no filter. */
  q?: string;
  /** Optional AbortSignal to cancel in-flight requests. */
  signal?: AbortSignal;
}

export async function browseDirectory(
  path?: string,
  options?: BrowseOptions,
): Promise<BrowseResult> {
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  const qTrim = (options?.q ?? "").trim();
  if (qTrim) params.set("q", qTrim);
  const qs = params.toString();
  const url = qs ? `${getApiBase()}/api/browse?${qs}` : `${getApiBase()}/api/browse`;

  const res = await fetch(url, { signal: options?.signal });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error ?? "browse failed");
  }
  return json.data;
}

/**
 * Create a new directory named `name` under `parent`.
 * Returns the absolute path of the new directory.
 */
export async function createDirectory(
  parent: string,
  name: string,
): Promise<MkdirResult> {
  const res = await fetch(`${getApiBase()}/api/browse/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent, name }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error ?? "mkdir failed");
  }
  return json.data;
}
