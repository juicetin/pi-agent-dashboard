/**
 * E2E task 6.8f: pick a model from each group, verify
 * `selfHost.llm.{source,model}` lands correctly in `~/.honcho/config.json`.
 *
 * Renders LlmSection directly with seeded config + seeded models cache
 * (avoids the upstream fetchers). The picker calls back to a real fetch
 * → real Fastify route → real config-store, so the on-disk file is the
 * authoritative assertion target.
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

function seedSelfHostConfig(): RedactedHonchoPluginConfig {
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
        source: "anthropic",
        model: "",
        apiKeySet: true,
        apiKeyMasked: "sk-a...",
      },
    },
  };
}

function seedModelsCache(): void {
  const cache = getDefaultModelsCache();
  const now = new Date().toISOString();
  cache.set("anthropic", {
    available: true,
    reachable: true,
    stale: false,
    lastFetched: now,
    models: [
      { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", supportsTools: true },
      { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5", supportsTools: true },
    ],
  });
  cache.set("openai", {
    available: true,
    reachable: true,
    stale: false,
    lastFetched: now,
    models: [
      { id: "gpt-4o-mini", displayName: "GPT-4o mini", supportsTools: true },
    ],
  });
  cache.set("gemini", {
    available: false,
    reachable: false,
    stale: false,
    lastFetched: null,
    models: [],
    error: "no api key configured",
  });
  cache.set("openai-compatible", {
    available: false,
    reachable: false,
    stale: false,
    lastFetched: null,
    models: [],
    error: "no base url configured",
  });
  cache.set("pi-model-proxy", {
    available: false,
    reachable: false,
    stale: false,
    lastFetched: null,
    models: [],
    error: "proxy not reachable",
  });
}

describe("e2e: model picker (task 6.8f)", () => {
  let server: E2eServerFixture;

  beforeEach(async () => {
    server = await createE2eServerFixture();
    seedModelsCache();
    // Seed the on-disk config so the route's secret-preservation path
    // and the LLM `available` gates work as expected.
    await server.inject({
      method: "POST",
      url: "/api/plugins/honcho/config",
      payload: {
        mode: "self-host",
        apiKey: "hch-cloud-key",
        selfHost: {
          llm: { source: "anthropic", apiKey: "sk-ant-test" },
        },
      },
    });
  });

  afterEach(async () => {
    cleanup();
    await server.close();
  });

  it("picking a model in the Anthropic group writes selfHost.llm.{source,model} to disk", async () => {
    const onSave = async (partial: Parameters<typeof saveConfig>[0]) => {
      await saveConfig(partial);
    };

    mountHonchoComponent({
      server,
      children: (
        <LlmSection
          config={seedSelfHostConfig()}
          onSave={onSave}
          saving={false}
        />
      ),
    });

    // Open dropdown. The trigger button is the only element showing
    // "Select model…" or the current model id.
    const trigger = await screen.findByRole("button", { name: /Select model|claude/i });
    fireEvent.click(trigger);

    // Click claude-haiku-4-5 in the Anthropic group.
    const haiku = await screen.findByText("claude-haiku-4-5");
    fireEvent.click(haiku);

    await waitFor(() => {
      const raw = readFileSync(server.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.selfHost?.llm?.source).toBe("anthropic");
      expect(parsed.selfHost?.llm?.model).toBe("claude-haiku-4-5");
    });
  });

  it("picking a model in the OpenAI group switches source and model on disk", async () => {
    const onSave = async (partial: Parameters<typeof saveConfig>[0]) => {
      await saveConfig(partial);
    };

    mountHonchoComponent({
      server,
      children: (
        <LlmSection
          config={seedSelfHostConfig()}
          onSave={onSave}
          saving={false}
        />
      ),
    });

    const trigger = await screen.findByRole("button", { name: /Select model|claude/i });
    fireEvent.click(trigger);

    const gpt = await screen.findByText("gpt-4o-mini");
    fireEvent.click(gpt);

    await waitFor(() => {
      const raw = readFileSync(server.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.selfHost?.llm?.source).toBe("openai");
      expect(parsed.selfHost?.llm?.model).toBe("gpt-4o-mini");
    });
  });
});
