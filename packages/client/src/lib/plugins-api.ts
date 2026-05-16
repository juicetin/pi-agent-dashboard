/**
 * Client API for /api/plugins activation endpoints.
 * See change: add-plugin-activation-ui.
 */
import { getApiBase } from "./api-context.js";

export interface PluginRequirementReport {
  piExtensions: { name: string; satisfied: boolean }[];
  binaries: { name: string; satisfied: boolean; resolvedPath?: string }[];
  services: { name: string; satisfied: boolean; error?: string }[];
}

export interface PluginRowStatus {
  id: string;
  displayName: string;
  enabled: boolean;
  loaded: boolean;
  error?: string;
  claims: number;
  requirements?: PluginRequirementReport;
  missingRequirements?: string[];
}

export interface PluginRow {
  id: string;
  displayName: string;
  priority: number;
  hasServer: boolean;
  hasBridge: boolean;
  hasClient: boolean;
  claims: Array<{
    slot: string;
    component?: string;
    tab?: string;
    command?: string;
    toolName?: string;
  }>;
  requires?: {
    piExtensions?: string[];
    binaries?: string[];
    services?: string[];
  } | null;
  /** Plugin ids this plugin depends on (verbatim from manifest). */
  dependsOn?: string[];
  /** Plugin ids that transitively depend on this plugin (computed). */
  dependents?: string[];
  status: PluginRowStatus | null;
}

export interface TogglePluginResult {
  restartRequired: boolean;
  cascade?: {
    enable?: string[];
    disable?: string[];
  };
}

export interface TogglePluginBlocked {
  blockers: string[];
}

export class TogglePluginBlockedError extends Error {
  constructor(public readonly blockers: string[]) {
    super(`Cannot enable plugin: missing deps ${blockers.join(", ")}`);
    this.name = "TogglePluginBlockedError";
  }
}

export async function listPlugins(): Promise<PluginRow[]> {
  const res = await fetch(`${getApiBase()}/api/plugins`);
  if (!res.ok) throw new Error(`GET /api/plugins failed: ${res.status}`);
  const body = (await res.json()) as { success: boolean; plugins: PluginRow[] };
  return body.plugins ?? [];
}

export async function togglePlugin(
  id: string,
  enabled: boolean,
): Promise<TogglePluginResult> {
  const res = await fetch(`${getApiBase()}/api/plugins/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (res.status === 409) {
    let body: { reason?: string; blockers?: string[] } = {};
    try {
      body = await res.json();
    } catch {
      /* empty */
    }
    if (body.reason === "blockers" && Array.isArray(body.blockers)) {
      throw new TogglePluginBlockedError(body.blockers);
    }
  }
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = String(body.error);
    } catch {
      /* empty */
    }
    throw new Error(`POST /api/plugins/${id}/toggle failed: ${msg}`);
  }
  return (await res.json()) as TogglePluginResult;
}
