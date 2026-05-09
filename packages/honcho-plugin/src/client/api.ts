/**
 * Client-side fetch helpers for the honcho plugin REST API.
 *
 * All endpoints scoped under /api/plugins/honcho/.
 */
import type {
  RedactedHonchoPluginConfig,
  HonchoPluginConfig,
  HonchoPluginStatus,
  DoctorResponse,
  SyncResponse,
  InterviewResponse,
  ServerLifecycleResponse,
  AggregateModelsResponse,
} from "../shared/types.js";

function getApiBase(): string {
  // In the dashboard plugin context, API calls are same-origin.
  return "";
}

const BASE = "/api/plugins/honcho";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${url}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Config ───────────────────────────────────────────────────────────────────

export async function fetchConfig(): Promise<RedactedHonchoPluginConfig> {
  return jsonFetch(`${BASE}/config`);
}

export async function saveConfig(
  partial: Partial<HonchoPluginConfig>,
): Promise<RedactedHonchoPluginConfig> {
  return jsonFetch(`${BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
}

// ── Sessions map ─────────────────────────────────────────────────────────────

export async function upsertSessionMapping(
  cwd: string,
  name: string,
): Promise<{ ok: boolean }> {
  return jsonFetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd, name }),
  });
}

export async function deleteSessionMapping(
  cwd: string,
): Promise<{ ok: boolean }> {
  return jsonFetch(`${BASE}/sessions`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
}

// ── Doctor ───────────────────────────────────────────────────────────────────

export async function runDoctor(): Promise<DoctorResponse> {
  return jsonFetch(`${BASE}/doctor`, { method: "POST" });
}

// ── Sync ─────────────────────────────────────────────────────────────────────

export async function triggerSync(): Promise<SyncResponse> {
  return jsonFetch(`${BASE}/sync`, { method: "POST" });
}

// ── Interview ────────────────────────────────────────────────────────────────

export async function submitInterview(
  content: string,
): Promise<InterviewResponse> {
  return jsonFetch(`${BASE}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

// ── Status ───────────────────────────────────────────────────────────────────

export async function fetchStatus(): Promise<HonchoPluginStatus> {
  return jsonFetch(`${BASE}/status`);
}

// ── Server lifecycle ─────────────────────────────────────────────────────────

export async function serverStart(): Promise<ServerLifecycleResponse> {
  return jsonFetch(`${BASE}/server/start`, { method: "POST" });
}

export async function serverStop(): Promise<ServerLifecycleResponse> {
  return jsonFetch(`${BASE}/server/stop`, { method: "POST" });
}

export async function serverRestart(): Promise<ServerLifecycleResponse> {
  return jsonFetch(`${BASE}/server/restart`, { method: "POST" });
}

// ── Models ───────────────────────────────────────────────────────────────────

export async function fetchModels(): Promise<AggregateModelsResponse> {
  return jsonFetch(`${BASE}/models`);
}

export async function refreshModels(
  source?: string,
): Promise<{ ok: boolean }> {
  const qs = source ? `?source=${encodeURIComponent(source)}` : "";
  return jsonFetch(`${BASE}/models/refresh${qs}`, { method: "POST" });
}

// ── Install gate ─────────────────────────────────────────────────────────────

export async function checkExtensionInstalled(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/packages/installed`);
    const json = await res.json();
    // Response: { success, data: Array<{ source, displayName, installedPath, ... }> }
    const list: Array<{ source?: string; displayName?: string; name?: string; id?: string }> =
      json?.data ?? json?.packages ?? json ?? [];
    return list.some(
      (p) =>
        p.source === "npm:pi-memory-honcho" ||
        p.displayName === "pi-memory-honcho" ||
        p.name === "pi-memory-honcho" ||
        p.id === "pi-memory-honcho",
    );
  } catch {
    return false;
  }
}

export async function installExtension(): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/packages/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "npm:pi-memory-honcho" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Install failed: ${res.status} ${body}`);
  }
}
