/**
 * Pure renderer for `~/.honcho/docker-compose.yml`. Three knobs:
 *   - `selfHost.storageBackend` controls the `volumes:` block
 *   - `selfHost.llm.source` controls the api service `environment:` block
 *   - `selfHost.apiPort` / `dbPort` control host-side `ports:`
 * `extra_hosts: ["host.docker.internal:host-gateway"]` is rendered whenever
 * source = pi-model-proxy.
 *
 * `loop-image` v1 throws `not-implemented` per design D9.
 *
 * See change: honcho-dashboard-plugin (spec honcho-server-lifecycle).
 */
import os from "node:os";
import path from "node:path";
import type { HonchoPluginConfig, LlmSource, StorageBackend } from "../shared/types.js";

export const HONCHO_PG_DIR = path.join(os.homedir(), ".pi-dashboard", "honcho", "pgdata");
export const HONCHO_PG_LOOP_IMG = path.join(
  os.homedir(),
  ".pi-dashboard",
  "honcho",
  "postgres.img",
);

export class NotImplementedError extends Error {
  constructor(
    public readonly code: string,
    public readonly since: string,
    public readonly reason: string,
  ) {
    super(`[honcho-plugin] ${code}: ${reason} (deferred to ${since})`);
    this.name = "NotImplementedError";
  }
}

interface ResolvedPorts {
  apiPort: number;
  dbPort: number;
}

function resolvePorts(cfg: HonchoPluginConfig): ResolvedPorts {
  return {
    apiPort: cfg.selfHost?.apiPort ?? 8765,
    dbPort: cfg.selfHost?.dbPort ?? 5455,
  };
}

function renderVolumesBlock(backend: StorageBackend, pgDir: string, loopImg: string): string {
  switch (backend) {
    case "host-directory":
      return [
        "volumes:",
        "  honcho-pg:",
        "    driver: local",
        "    driver_opts:",
        "      type: none",
        "      o: bind",
        `      device: ${pgDir}`,
      ].join("\n");
    case "docker-volume":
      return ["volumes:", "  honcho-pg: {}"].join("\n");
    case "loop-image":
      throw new NotImplementedError(
        "not-implemented",
        "v0.3",
        "loop-image backend deferred (Linux only, requires sudo)",
      );
  }
}

interface LlmEnvBlock {
  vars: Record<string, string>;
  extraHosts: boolean;
}

function renderLlmEnv(source: LlmSource, cfg: HonchoPluginConfig): LlmEnvBlock {
  const llm = cfg.selfHost?.llm ?? {};
  const model = llm.model ?? "";
  const apiKey = llm.apiKey ?? "";
  const baseUrl = llm.baseUrl ?? "";
  switch (source) {
    case "pi-model-proxy": {
      const vars: Record<string, string> = {
        LLM_OPENAI_COMPATIBLE_BASE_URL: "http://host.docker.internal:9876/v1",
        DIALECTIC_PROVIDER: "openai-compatible",
        DIALECTIC_MODEL: model,
      };
      if (apiKey) vars.LLM_OPENAI_COMPATIBLE_API_KEY = apiKey;
      return { vars, extraHosts: true };
    }
    case "anthropic":
      return {
        vars: {
          LLM_ANTHROPIC_API_KEY: apiKey,
          DIALECTIC_PROVIDER: "anthropic",
          DIALECTIC_MODEL: model,
        },
        extraHosts: false,
      };
    case "openai":
      return {
        vars: {
          LLM_OPENAI_API_KEY: apiKey,
          DIALECTIC_PROVIDER: "openai",
          DIALECTIC_MODEL: model,
        },
        extraHosts: false,
      };
    case "gemini":
      return {
        vars: {
          LLM_GEMINI_API_KEY: apiKey,
          DIALECTIC_PROVIDER: "gemini",
          DIALECTIC_MODEL: model,
        },
        extraHosts: false,
      };
    case "openai-compatible": {
      // host.docker.internal in baseUrl ⇒ container must reach the host
      // (used by the auto-minted integrated-proxy flow).
      const usesHostGateway = baseUrl.includes("host.docker.internal");
      return {
        vars: {
          LLM_OPENAI_COMPATIBLE_BASE_URL: baseUrl,
          LLM_OPENAI_COMPATIBLE_API_KEY: apiKey,
          DIALECTIC_PROVIDER: "openai-compatible",
          DIALECTIC_MODEL: model,
        },
        extraHosts: usesHostGateway,
      };
    }
  }
}

function indent(lines: string[], depth: number): string {
  const pad = " ".repeat(depth);
  return lines.map((l) => pad + l).join("\n");
}

export interface RenderOptions {
  /** Override the resolved bind device path (test-only). */
  pgDir?: string;
  /** Override the loop-image path (test-only). */
  loopImg?: string;
}

export function renderComposeYaml(
  cfg: HonchoPluginConfig,
  opts: RenderOptions = {},
): string {
  const backend: StorageBackend = cfg.selfHost?.storageBackend ?? "host-directory";
  const pgDir = opts.pgDir ?? HONCHO_PG_DIR;
  const loopImg = opts.loopImg ?? HONCHO_PG_LOOP_IMG;
  const { apiPort, dbPort } = resolvePorts(cfg);

  // loop-image v1: throw before assembling output.
  if (backend === "loop-image") {
    throw new NotImplementedError(
      "not-implemented",
      "v0.3",
      "loop-image backend deferred (Linux only, requires sudo)",
    );
  }

  const source: LlmSource = cfg.selfHost?.llm?.source ?? "pi-model-proxy";
  const llm = renderLlmEnv(source, cfg);

  const envLines = Object.entries(llm.vars).map(([k, v]) => `      ${k}: ${v}`);
  const extraHostsBlock = llm.extraHosts
    ? '    extra_hosts:\n      - "host.docker.internal:host-gateway"\n'
    : "";

  const apiPortMap = `"${apiPort}:8000"`;
  const dbPortMap = `"${dbPort}:5432"`;

  const services = [
    "services:",
    "  postgres:",
    "    image: pgvector/pgvector:pg16",
    "    environment:",
    "      POSTGRES_DB: honcho",
    "      POSTGRES_USER: honcho",
    "      POSTGRES_PASSWORD: honcho",
    "    volumes:",
    "      - honcho-pg:/var/lib/postgresql/data",
    `    ports: [${dbPortMap}]`,
    "    healthcheck:",
    '      test: ["CMD-SHELL", "pg_isready -U honcho -d honcho"]',
    "      interval: 5s",
    "      retries: 10",
    "  api:",
    "    image: ghcr.io/plastic-labs/honcho:latest",
    "    depends_on:",
    "      postgres:",
    "        condition: service_healthy",
    "    environment:",
    "      DB_CONNECTION_URI: postgresql+psycopg://honcho:honcho@postgres:5432/honcho",
    ...envLines,
    extraHostsBlock.trimEnd(),
    `    ports: [${apiPortMap}]`,
  ].filter((l) => l !== "").join("\n");

  const volumes = renderVolumesBlock(backend, pgDir, loopImg);

  return `${services}\n${volumes}\n`;
}
