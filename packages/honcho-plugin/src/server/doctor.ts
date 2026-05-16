/**
 * `POST /doctor` preflight runner.
 *
 *   cloud mode  → config sanity → endpoint reachable → workspace/peer/session resolves
 *   self-host   → adds docker availability, compose-file presence, container running,
 *                  api-health response, migration applied; LLM-source-specific checks
 *                  (api-key presence for direct providers; docker exec curl probe for proxy)
 *
 * See change: honcho-dashboard-plugin (spec honcho-memory-plugin + honcho-server-lifecycle).
 */
import fs from "node:fs";
import {
  COMPOSE_PATH,
  detectDocker,
  runCommand,
} from "./compose-lifecycle.js";
// Lifted into dashboard-plugin-runtime. See change: add-plugin-activation-ui (task 12).
import { detectPiModelProxy, getPluginStatusStore } from "@blackbelt-technology/dashboard-plugin-runtime/server";
import type { DoctorCheck, DoctorResponse, HonchoPluginConfig } from "../shared/types.js";

export interface DoctorDeps {
  composePath?: string;
  fetchImpl?: typeof fetch;
  /** State of the docker stack from the plugin's POV. */
  isStackRunning?: () => boolean;
}

export async function runDoctor(
  cfg: HonchoPluginConfig,
  deps: DoctorDeps = {},
): Promise<DoctorResponse> {
  const checks: DoctorCheck[] = [];
  const composePath = deps.composePath ?? COMPOSE_PATH;
  const f = deps.fetchImpl ?? fetch;

  // ── Config sanity ─────────────────────────────────────────────────
  if (!cfg.apiKey && cfg.mode !== "self-host") {
    checks.push({ id: "config-apikey", status: "fail", detail: "apiKey is missing" });
  } else {
    checks.push({ id: "config-apikey", status: "ok" });
  }
  if (!cfg.peerName) {
    checks.push({ id: "config-peer", status: "warn", detail: "peerName not set" });
  } else {
    checks.push({ id: "config-peer", status: "ok" });
  }
  if (!cfg.workspace) {
    checks.push({ id: "config-workspace", status: "warn", detail: "workspace not set" });
  } else {
    checks.push({ id: "config-workspace", status: "ok" });
  }

  // ── Endpoint reachability ─────────────────────────────────────────
  const endpoint =
    cfg.hosts?.pi?.endpoint ??
    (cfg.mode === "self-host"
      ? `http://localhost:${cfg.selfHost?.apiPort ?? 8765}`
      : "https://api.honcho.dev");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const res = await f(`${endpoint.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    checks.push({
      id: "endpoint-health",
      status: res.ok ? "ok" : "fail",
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    });
  } catch (e) {
    checks.push({
      id: "endpoint-health",
      status: "fail",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (cfg.mode === "self-host") {
    // ── Docker availability ────────────────────────────────────────
    const docker = await detectDocker();
    checks.push({
      id: "docker",
      status: docker.available ? "ok" : "fail",
      detail: docker.error,
    });

    // ── Compose file ───────────────────────────────────────────────
    checks.push({
      id: "compose-file",
      status: fs.existsSync(composePath) ? "ok" : "fail",
      detail: fs.existsSync(composePath) ? undefined : `missing ${composePath}`,
    });

    // ── Container running ──────────────────────────────────────────
    if (docker.available) {
      const ps = await runCommand(
        "docker",
        ["compose", "-f", composePath, "ps", "-q"],
        { timeoutMs: 5_000 },
      );
      const running = ps.exitCode === 0 && ps.stdout.trim().length > 0;
      checks.push({
        id: "containers",
        status: running ? "ok" : "fail",
        detail: running ? "running" : "stopped",
      });
    }

    // ── Migration applied flag ────────────────────────────────────
    checks.push({
      id: "migrations",
      status: cfg.selfHost?.migrationsApplied ? "ok" : "warn",
      detail: cfg.selfHost?.migrationsApplied
        ? "applied"
        : "not yet applied (will run on first successful boot)",
    });

    // ── LLM-source checks ─────────────────────────────────────────
    const source = cfg.selfHost?.llm?.source;
    if (source === "anthropic" || source === "openai" || source === "gemini") {
      const id = `llm-${source}-key`;
      checks.push({
        id,
        status: cfg.selfHost?.llm?.apiKey ? "ok" : "fail",
        detail: cfg.selfHost?.llm?.apiKey
          ? undefined
          : "set selfHost.llm.apiKey via Settings → Honcho Memory",
      });
    }
    if (source === "pi-model-proxy") {
      // Prefer the cached probe from the shared requirements model; fall
      // back to a direct fetch when the cache is empty (cold boot).
      // See change: add-plugin-activation-ui.
      const cached = getPluginStatusStore().getStatus("honcho")?.requirements?.services?.find(
        (s) => s.name === "pi-model-proxy",
      );
      let reachable: boolean;
      let error: string | undefined;
      if (cached) {
        reachable = cached.satisfied;
        error = cached.error;
      } else {
        const probe = await detectPiModelProxy({ fetchImpl: f });
        reachable = probe.reachable;
        error = probe.error;
      }
      checks.push({
        id: "pi-model-proxy-host-side",
        status: reachable ? "ok" : "fail",
        detail: reachable ? undefined : error,
      });
      if (deps.isStackRunning?.()) {
        // docker exec into the api container and curl the host-gateway.
        const r = await runCommand(
          "docker",
          [
            "compose",
            "-f",
            composePath,
            "exec",
            "-T",
            "api",
            "curl",
            "-fsS",
            "http://host.docker.internal:9876/health",
          ],
          { timeoutMs: 5_000 },
        );
        checks.push({
          id: "pi-model-proxy-from-container",
          status: r.exitCode === 0 ? "ok" : "fail",
          detail: r.exitCode === 0 ? undefined : (r.stderr || r.stdout || "").trim(),
        });
      }
    }
  }

  return { checks };
}
