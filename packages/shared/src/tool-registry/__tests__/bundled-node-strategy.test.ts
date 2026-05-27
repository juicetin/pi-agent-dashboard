/**
 * Unit tests for `bundledNodeStrategy` — the registry slot that
 * resolves the Electron-bundled Node runtime under
 * `<resourcesPath>/node/`.
 *
 * Pure: every fs probe routes through the injected `exists` dep, so
 * tests are deterministic across host OS / file layout.
 *
 * See change: fix-node-resolution-under-electron (tasks 1.1–1.4, 4.1).
 */
import path from "node:path";
import { describe, it, expect } from "vitest";
import { bundledNodeStrategy } from "../strategies.js";
import type { StrategyCtx } from "../types.js";

function ctx(opts: {
  platform?: NodeJS.Platform;
  resourcesPath?: string;
}): StrategyCtx {
  return {
    overrides: {},
    platform: opts.platform ?? "linux",
    env: opts.resourcesPath ? { resourcesPath: opts.resourcesPath } : {},
  };
}

describe("bundledNodeStrategy — present", () => {
  it("Unix: resolves <resourcesPath>/node/bin/node", () => {
    const resourcesPath = "/Applications/PI-Dashboard.app/Contents/Resources";
    const candidate = path.join(resourcesPath, "node", "bin", "node");
    const strat = bundledNodeStrategy("node", { exists: (p) => p === candidate });
    const r = strat.run(ctx({ platform: "darwin", resourcesPath }));
    expect(r).toEqual({ ok: true, path: candidate });
  });

  it("Unix: resolves <resourcesPath>/node/bin/npm", () => {
    const resourcesPath = "/opt/app/resources";
    const candidate = path.join(resourcesPath, "node", "bin", "npm");
    const strat = bundledNodeStrategy("npm", { exists: (p) => p === candidate });
    const r = strat.run(ctx({ platform: "linux", resourcesPath }));
    expect(r).toEqual({ ok: true, path: candidate });
  });

  it("Unix: resolves <resourcesPath>/node/bin/npx", () => {
    const resourcesPath = "/opt/app/resources";
    const candidate = path.join(resourcesPath, "node", "bin", "npx");
    const strat = bundledNodeStrategy("npx", { exists: (p) => p === candidate });
    const r = strat.run(ctx({ platform: "linux", resourcesPath }));
    expect(r).toEqual({ ok: true, path: candidate });
  });

  it("Windows: resolves <resourcesPath>\\node\\node.exe", () => {
    const resourcesPath = "C:\\Program Files\\PI Dashboard\\resources";
    const candidate = path.join(resourcesPath, "node", "node.exe");
    const strat = bundledNodeStrategy("node", { exists: (p) => p === candidate });
    const r = strat.run(ctx({ platform: "win32", resourcesPath }));
    expect(r).toEqual({ ok: true, path: candidate });
  });

  it("Windows: resolves npm.cmd", () => {
    const resourcesPath = "C:\\Program Files\\PI Dashboard\\resources";
    const candidate = path.join(resourcesPath, "node", "npm.cmd");
    const strat = bundledNodeStrategy("npm", { exists: (p) => p === candidate });
    const r = strat.run(ctx({ platform: "win32", resourcesPath }));
    expect(r).toEqual({ ok: true, path: candidate });
  });

  it("Windows: resolves npx.cmd", () => {
    const resourcesPath = "C:\\Program Files\\PI Dashboard\\resources";
    const candidate = path.join(resourcesPath, "node", "npx.cmd");
    const strat = bundledNodeStrategy("npx", { exists: (p) => p === candidate });
    const r = strat.run(ctx({ platform: "win32", resourcesPath }));
    expect(r).toEqual({ ok: true, path: candidate });
  });
});

describe("bundledNodeStrategy — absent", () => {
  it("returns no-resourcesPath when env.resourcesPath is undefined", () => {
    const strat = bundledNodeStrategy("node", { exists: () => true });
    const r = strat.run(ctx({ platform: "linux" }));
    expect(r).toEqual({ ok: false, reason: "no resourcesPath" });
  });

  it("returns missing:<path> when resourcesPath is set but binary absent (Unix)", () => {
    const resourcesPath = "/opt/app/resources";
    const strat = bundledNodeStrategy("node", { exists: () => false });
    const r = strat.run(ctx({ platform: "linux", resourcesPath }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/^missing: /);
      expect(r.reason).toContain(path.join(resourcesPath, "node", "bin", "node"));
    }
  });

  it("returns missing:<path> when resourcesPath is set but binary absent (Windows)", () => {
    const resourcesPath = "C:\\app\\resources";
    const strat = bundledNodeStrategy("npm", { exists: () => false });
    const r = strat.run(ctx({ platform: "win32", resourcesPath }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain(path.join(resourcesPath, "node", "npm.cmd"));
    }
  });

  it("never calls existsSync directly (honors injected exists)", () => {
    // Sentinel: a value that the real existsSync would never agree with.
    const probes: string[] = [];
    const strat = bundledNodeStrategy("node", {
      exists: (p) => {
        probes.push(p);
        return false;
      },
    });
    strat.run(ctx({ platform: "linux", resourcesPath: "/fake/Resources" }));
    expect(probes).toEqual([path.join("/fake/Resources", "node", "bin", "node")]);
  });
});

describe("bundledNodeStrategy.name", () => {
  it("is 'bundled-node' so classify() maps to Source 'bundled'", () => {
    expect(bundledNodeStrategy("node").name).toBe("bundled-node");
    expect(bundledNodeStrategy("npm").name).toBe("bundled-node");
    expect(bundledNodeStrategy("npx").name).toBe("bundled-node");
  });
});
