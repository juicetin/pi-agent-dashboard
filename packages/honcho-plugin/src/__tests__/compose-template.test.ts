import { describe, it, expect } from "vitest";
import {
  renderComposeYaml,
  NotImplementedError,
} from "../server/compose-template.js";
import type { HonchoPluginConfig } from "../shared/types.js";

const baseLlm = (source: HonchoPluginConfig["selfHost"] = {}) =>
  ({
    selfHost: {
      ...source,
      llm: { source: "anthropic", apiKey: "sk-ant-x", model: "claude-haiku-4-5" },
      ...source,
    },
  }) as HonchoPluginConfig;

describe("renderComposeYaml — backends", () => {
  it("host-directory renders bind volume with explicit device path", () => {
    const out = renderComposeYaml(baseLlm(), { pgDir: "/tmp/honcho-pg" });
    expect(out).toContain("type: none");
    expect(out).toContain("o: bind");
    expect(out).toContain("device: /tmp/honcho-pg");
  });

  it("docker-volume renders default named volume", () => {
    const out = renderComposeYaml({
      selfHost: {
        storageBackend: "docker-volume",
        llm: { source: "anthropic", apiKey: "k", model: "m" },
      },
    });
    expect(out).toContain("honcho-pg: {}");
    expect(out).not.toContain("device:");
  });

  it("loop-image throws NotImplementedError", () => {
    expect(() =>
      renderComposeYaml({
        selfHost: {
          storageBackend: "loop-image",
          llm: { source: "anthropic", apiKey: "k", model: "m" },
        },
      }),
    ).toThrow(NotImplementedError);
  });
});

describe("renderComposeYaml — LLM env per source", () => {
  const cases: Array<{
    source: NonNullable<NonNullable<HonchoPluginConfig["selfHost"]>["llm"]>["source"];
    expectIncludes: string[];
    expectExcludes: string[];
    extraConfig?: Partial<NonNullable<NonNullable<HonchoPluginConfig["selfHost"]>["llm"]>>;
  }> = [
    {
      source: "anthropic",
      expectIncludes: [
        "LLM_ANTHROPIC_API_KEY: sk-ant-x",
        "DIALECTIC_PROVIDER: anthropic",
        "DIALECTIC_MODEL: claude-haiku-4-5",
      ],
      expectExcludes: ["LLM_OPENAI_API_KEY", "host.docker.internal:host-gateway"],
    },
    {
      source: "openai",
      expectIncludes: [
        "LLM_OPENAI_API_KEY: sk-ant-x",
        "DIALECTIC_PROVIDER: openai",
        "DIALECTIC_MODEL: claude-haiku-4-5",
      ],
      expectExcludes: ["LLM_ANTHROPIC_API_KEY", "host-gateway"],
    },
    {
      source: "gemini",
      expectIncludes: [
        "LLM_GEMINI_API_KEY: sk-ant-x",
        "DIALECTIC_PROVIDER: gemini",
      ],
      expectExcludes: ["LLM_ANTHROPIC_API_KEY"],
    },
    {
      source: "openai-compatible",
      expectIncludes: [
        "LLM_OPENAI_COMPATIBLE_BASE_URL: https://api.example.com/v1",
        "LLM_OPENAI_COMPATIBLE_API_KEY: sk-ant-x",
        "DIALECTIC_PROVIDER: openai-compatible",
      ],
      expectExcludes: ["host-gateway"],
      extraConfig: { baseUrl: "https://api.example.com/v1" },
    },
    {
      source: "pi-model-proxy",
      expectIncludes: [
        "LLM_OPENAI_COMPATIBLE_BASE_URL: http://host.docker.internal:9876/v1",
        "host.docker.internal:host-gateway",
        "DIALECTIC_PROVIDER: openai-compatible",
      ],
      expectExcludes: [],
    },
  ];

  for (const c of cases) {
    it(`source=${c.source}`, () => {
      const out = renderComposeYaml({
        selfHost: {
          llm: {
            source: c.source,
            apiKey: "sk-ant-x",
            model: "claude-haiku-4-5",
            ...c.extraConfig,
          },
        },
      });
      for (const inc of c.expectIncludes) expect(out).toContain(inc);
      for (const exc of c.expectExcludes) expect(out).not.toContain(exc);
    });
  }
});

describe("renderComposeYaml — ports", () => {
  it("default ports 8765:8000 and 5455:5432", () => {
    const out = renderComposeYaml(baseLlm());
    expect(out).toContain('"8765:8000"');
    expect(out).toContain('"5455:5432"');
  });

  it("override apiPort/dbPort flow into ports map", () => {
    const out = renderComposeYaml({
      selfHost: {
        apiPort: 9001,
        dbPort: 6543,
        llm: { source: "anthropic", apiKey: "k", model: "m" },
      },
    });
    expect(out).toContain('"9001:8000"');
    expect(out).toContain('"6543:5432"');
  });
});

describe("renderComposeYaml — extra_hosts gating", () => {
  it("included when source = pi-model-proxy", () => {
    const out = renderComposeYaml({
      selfHost: { llm: { source: "pi-model-proxy", model: "x" } },
    });
    expect(out).toContain("host.docker.internal:host-gateway");
  });
  it("excluded for direct providers", () => {
    const out = renderComposeYaml({
      selfHost: { llm: { source: "anthropic", apiKey: "k", model: "m" } },
    });
    expect(out).not.toContain("host-gateway");
  });
  it("included when openai-compatible baseUrl uses host.docker.internal (integrated proxy)", () => {
    const out = renderComposeYaml({
      selfHost: {
        llm: {
          source: "openai-compatible",
          baseUrl: "http://host.docker.internal:8000/v1",
          apiKey: "pi-proxy-x",
          model: "anthropic/claude-haiku-4-5",
        },
      },
    });
    expect(out).toContain("host.docker.internal:host-gateway");
  });
  it("excluded when openai-compatible baseUrl is remote", () => {
    const out = renderComposeYaml({
      selfHost: {
        llm: {
          source: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          apiKey: "k",
          model: "m",
        },
      },
    });
    expect(out).not.toContain("host-gateway");
  });
});
