/**
 * E2E server fixture for honcho-plugin.
 *
 * Spins up an in-process `Fastify({})` instance, mounts the four honcho
 * route modules (config, honcho-client, lifecycle, models) with a
 * test-tmp `configPath`, plus a tiny `/api/packages/{installed,install}`
 * stub whose installed-list is mutable per test.
 *
 * No subprocess. No port. Tests reach the server via `fastify.inject()`
 * (sub-millisecond) wired through a `globalThis.fetch` shim installed by
 * `client-mount.tsx`.
 *
 * Background: see openspec/changes/honcho-dashboard-plugin/design.md
 * "E2E Test Fixture Approach".
 */
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import type { Response as LightMyRequestResponse, InjectPayload } from "light-my-request";

import { mountConfigRoutes } from "../../../server/routes-config.js";
import { mountHonchoClientRoutes } from "../../../server/routes-honcho-client.js";
import { mountLifecycleRoutes } from "../../../server/routes-lifecycle.js";
import { mountModelsRoutes } from "../../../server/routes-models.js";
import { resetState } from "../../../server/plugin-state.js";
import { getDefaultModelsCache } from "../../../server/llm/cache.js";

export interface InstalledPackage {
  source: string;
  displayName?: string;
  name?: string;
  id?: string;
}

export interface E2eServerFixture {
  fastify: FastifyInstance;
  /** Absolute path to the per-test honcho config.json. */
  configPath: string;
  /** Absolute path to the per-test tmp HOME. */
  tmpHome: string;
  /** Mutable installed-package list backing /api/packages/installed. */
  installedPackages: InstalledPackage[];
  /** Convenience: set extension installed/absent for the gating tests. */
  setHonchoExtensionInstalled(present: boolean): void;
  /** Inject a request through the in-process router. */
  inject(opts: {
    method: string;
    url: string;
    payload?: unknown;
  }): Promise<{ statusCode: number; body: string; json(): unknown }>;
  /** Tear down: close fastify, remove tmpHome, reset plugin globals. */
  close(): Promise<void>;
}

const HONCHO_EXTENSION: InstalledPackage = {
  source: "npm:pi-memory-honcho",
  displayName: "pi-memory-honcho",
  name: "pi-memory-honcho",
  id: "pi-memory-honcho",
};

/**
 * Create a fresh fixture. Call `close()` in `afterEach` to tear down.
 *
 * Safe to call multiple times in parallel — each invocation gets its own
 * tmp HOME, its own Fastify instance, and its own installed-package list.
 * Plugin-state (status singleton) and models cache are process-globals;
 * `close()` resets them so back-to-back tests don't see stale state.
 */
export async function createE2eServerFixture(): Promise<E2eServerFixture> {
  const tmpHome = mkdtempSync(join(tmpdir(), "honcho-e2e-"));
  mkdirSync(join(tmpHome, ".honcho"), { recursive: true });
  const configPath = join(tmpHome, ".honcho", "config.json");

  const fastify = Fastify({ logger: false });

  // ── Honcho plugin routes ──────────────────────────────────────────────
  mountConfigRoutes(fastify, { configPath });
  mountHonchoClientRoutes(fastify, { configPath });
  mountLifecycleRoutes(fastify, { configPath });
  mountModelsRoutes(fastify, { configPath });

  // ── /api/packages stub ────────────────────────────────────────────────
  const installedPackages: InstalledPackage[] = [];

  fastify.get("/api/packages/installed", async () => {
    return { success: true, data: installedPackages };
  });

  // ── /api/health stub ─────────────────────────────────────────────────────
  // After change: add-plugin-activation-ui, honcho's client gate reads plugin
  // status (PluginStatus.requirements.piExtensions) off /api/health.plugins[]
  // instead of /api/packages/installed. Mirror the installed-state here.
  fastify.get("/api/health", async () => {
    const satisfied = installedPackages.some(
      (p) => p.source === HONCHO_EXTENSION.source || p.name === "pi-memory-honcho",
    );
    return {
      ok: true,
      startedAt: new Date().toISOString(),
      plugins: [
        {
          id: "honcho",
          displayName: "Honcho Memory",
          enabled: true,
          loaded: true,
          claims: 3,
          requirements: {
            piExtensions: [{ name: "pi-memory-honcho", satisfied }],
            binaries: [],
            services: [],
          },
          missingRequirements: satisfied ? [] : ["pi-memory-honcho"],
        },
      ],
    };
  });

  fastify.post<{ Body: { source?: string } }>(
    "/api/packages/install",
    async (req, reply) => {
      const source = req.body?.source;
      if (!source) {
        reply.code(400);
        return { success: false, error: "source is required" };
      }
      // Simulate async install: the route returns 202 + operationId.
      // Tests that care about completion can mutate installedPackages
      // directly (or use setHonchoExtensionInstalled).
      reply.code(202);
      return {
        success: true,
        data: { operationId: `op-${Date.now()}` },
      };
    },
  );

  await fastify.ready();

  function setHonchoExtensionInstalled(present: boolean): void {
    const idx = installedPackages.findIndex(
      (p) => p.source === HONCHO_EXTENSION.source,
    );
    if (present && idx === -1) installedPackages.push({ ...HONCHO_EXTENSION });
    else if (!present && idx >= 0) installedPackages.splice(idx, 1);
  }

  return {
    fastify,
    configPath,
    tmpHome,
    installedPackages,
    setHonchoExtensionInstalled,
    async inject(opts) {
      const res = (await fastify.inject({
        method: opts.method as never,
        url: opts.url,
        payload: opts.payload as InjectPayload,
      })) as LightMyRequestResponse;
      return {
        statusCode: res.statusCode,
        body: res.body,
        json: () => JSON.parse(res.body),
      };
    },
    async close() {
      await fastify.close();
      try {
        rmSync(tmpHome, { recursive: true, force: true });
      } catch {
        /* ignore — best effort */
      }
      // Reset module-level singletons so the next test starts fresh.
      resetState();
      getDefaultModelsCache().bust();
    },
  };
}
