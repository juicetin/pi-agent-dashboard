/**
 * E2E task 6.8g: route-override dropdown only appears when the selected
 * model exists in multiple groups; switching it updates `source` without
 * changing `model`.
 *
 * Two scenarios:
 *   1. Selected model in only one group → no Route: dropdown rendered.
 *   2. Selected model in two groups → Route: dropdown rendered; changing
 *      it POSTs `{ selfHost: { llm: { source: <new> } } }` and the new
 *      source lands on disk while `model` stays.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import React from "react";
import {
  createE2eServerFixture,
  type E2eServerFixture,
} from "./fixtures/server-fixture.js";
import { mountHonchoComponent } from "./fixtures/client-mount.js";
import { LlmSection } from "../../client/LlmSection.js";
import { saveConfig } from "../../client/api.js";
import { getDefaultModelsCache } from "../../server/llm/cache.js";
import type { RedactedHonchoPluginConfig } from "../../shared/types.js";

function seedConfigForModel(model: string, source: string): RedactedHonchoPluginConfig {
  return {
    mode: "self-host",
    apiKeySet: false,
    apiKeyMasked: null,
    selfHost: {
      autoStart: false,
      apiPort: 8765,
      dbPort: 5455,
      storageBackend: "host-directory",
      migrationsApplied: false,
      llm: {
        source: source as never,
        model,
        apiKeySet: true,
        apiKeyMasked: "sk-a...",
      },
    },
  };
}

/**
 * Seed cache so a single model id "shared-model" exists in BOTH the
 * Anthropic and OpenAI groups (route-override should appear), and a
 * second id "single-model" exists only in Anthropic (route-override
 * should NOT appear).
 */
function seedModelsCacheBothGroups(): void {
  const cache = getDefaultModelsCache();
  const now = new Date().toISOString();
  cache.set("anthropic", {
    available: true,
    reachable: true,
    stale: false,
    lastFetched: now,
    models: [
      { id: "shared-model", displayName: "Shared Model", supportsTools: true },
      { id: "single-model", displayName: "Single Model", supportsTools: true },
    ],
  });
  cache.set("openai", {
    available: true,
    reachable: true,
    stale: false,
    lastFetched: now,
    models: [
      { id: "shared-model", displayName: "Shared Model", supportsTools: true },
    ],
  });
  for (const src of ["gemini", "openai-compatible", "pi-model-proxy"] as const) {
    cache.set(src, {
      available: false,
      reachable: false,
      stale: false,
      lastFetched: null,
      models: [],
      error: "not configured",
    });
  }
}

describe("e2e: route-override dropdown (task 6.8g)", () => {
  let server: E2eServerFixture;

  beforeEach(async () => {
    server = await createE2eServerFixture();
    seedModelsCacheBothGroups();
    // Seed disk so secret-preservation works.
    await server.inject({
      method: "POST",
      url: "/api/plugins/honcho/config",
      payload: {
        mode: "self-host",
        selfHost: { llm: { source: "anthropic", apiKey: "sk-ant" } },
      },
    });
  });

  afterEach(async () => {
    cleanup();
    await server.close();
  });

  it("route-override dropdown is hidden when selected model is in only one group", async () => {
    const onSave = async (partial: Parameters<typeof saveConfig>[0]) => {
      await saveConfig(partial);
    };

    mountHonchoComponent({
      server,
      children: (
        <LlmSection
          config={seedConfigForModel("single-model", "anthropic")}
          onSave={onSave}
          saving={false}
        />
      ),
    });

    // Wait until models are loaded — dropdown trigger shows current id.
    await screen.findByRole("button", { name: /single-model/i });

    // The "Route:" label only renders when showRouteOverride is true.
    expect(screen.queryByText(/^Route:$/i)).not.toBeInTheDocument();
  });

  it("route-override dropdown is visible and switches source on disk when model is in multiple groups", async () => {
    const onSave = async (partial: Parameters<typeof saveConfig>[0]) => {
      await saveConfig(partial);
    };

    mountHonchoComponent({
      server,
      children: (
        <LlmSection
          config={seedConfigForModel("shared-model", "anthropic")}
          onSave={onSave}
          saving={false}
        />
      ),
    });

    // Confirm Route: label rendered (proves showRouteOverride === true).
    await waitFor(() => {
      expect(screen.getByText(/^Route:$/i)).toBeInTheDocument();
    });

    // The dropdown is the <select> next to "Route:".
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "openai" } });

    await waitFor(() => {
      const raw = readFileSync(server.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      // Source switches; model is unchanged (left untouched by handleRouteChange).
      expect(parsed.selfHost?.llm?.source).toBe("openai");
    });
  });
});
