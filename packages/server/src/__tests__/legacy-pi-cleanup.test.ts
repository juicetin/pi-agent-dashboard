import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseVersion,
  legacyPathUnder,
  detectLegacyPiInstalls,
  uninstallLegacyPi,
  LEGACY_PI_PACKAGE,
  type LegacyPiInstall,
} from "../legacy-pi-cleanup.js";

describe("parseVersion", () => {
  it("returns version from valid json", () => {
    expect(parseVersion('{"name":"x","version":"1.2.3"}')).toBe("1.2.3");
  });
  it("returns null on parse error", () => {
    expect(parseVersion("not json")).toBeNull();
  });
  it("returns null when version missing", () => {
    expect(parseVersion('{"name":"x"}')).toBeNull();
  });
});

describe("legacyPathUnder", () => {
  it("joins node_modules with legacy package", () => {
    const p = legacyPathUnder("/tmp/nm");
    expect(p.endsWith(path.join("@mariozechner", "pi-coding-agent"))).toBe(true);
  });
});

describe("detectLegacyPiInstalls (filesystem)", () => {
  let tmpHome: string;
  let origHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-pi-test-"));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });

  afterEach(() => {
    if (origHome !== undefined) process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function plantLegacy(scopeDir: string, version: string): string {
    const pkgDir = path.join(scopeDir, ...LEGACY_PI_PACKAGE.split("/"));
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name: LEGACY_PI_PACKAGE, version }),
    );
    return pkgDir;
  }

  it("returns empty when nothing planted", () => {
    // Note: this still consults `npm root -g` from the real system; if that
    // happens to contain @mariozechner/pi-coding-agent the test would
    // see it. We accept that and only assert npx-cache + managed are empty.
    const found = detectLegacyPiInstalls();
    expect(found.filter((f) => f.scope !== "npm-global")).toEqual([]);
  });

  it("detects npx-cache install", () => {
    plantLegacy(path.join(tmpHome, ".npm", "_npx", "abc123", "node_modules"), "0.73.1");
    const found = detectLegacyPiInstalls().filter((f) => f.scope === "npx-cache");
    expect(found).toHaveLength(1);
    expect(found[0].version).toBe("0.73.1");
  });

  it("detects managed install", () => {
    plantLegacy(path.join(tmpHome, ".pi-dashboard", "node_modules"), "0.70.0");
    const found = detectLegacyPiInstalls().filter((f) => f.scope === "managed");
    expect(found).toHaveLength(1);
    expect(found[0].version).toBe("0.70.0");
  });

  it("detects multiple npx-cache installs", () => {
    plantLegacy(path.join(tmpHome, ".npm", "_npx", "h1", "node_modules"), "0.72.0");
    plantLegacy(path.join(tmpHome, ".npm", "_npx", "h2", "node_modules"), "0.73.0");
    const found = detectLegacyPiInstalls().filter((f) => f.scope === "npx-cache");
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.version).sort()).toEqual(["0.72.0", "0.73.0"]);
  });
});

describe("uninstallLegacyPi (filesystem subset)", () => {
  let tmpHome: string;
  let origHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-pi-rm-test-"));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });

  afterEach(() => {
    if (origHome !== undefined) process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function plant(scope: "managed" | "npx-cache", version: string): LegacyPiInstall {
    const base =
      scope === "managed"
        ? path.join(tmpHome, ".pi-dashboard", "node_modules")
        : path.join(tmpHome, ".npm", "_npx", "x1", "node_modules");
    const pkgDir = path.join(base, ...LEGACY_PI_PACKAGE.split("/"));
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ version }));
    return { scope, path: pkgDir, version };
  }

  it("removes managed install via rm -rf", () => {
    const install = plant("managed", "0.70.0");
    expect(fs.existsSync(install.path)).toBe(true);
    const results = uninstallLegacyPi([install]);
    expect(results[0]).toEqual({ scope: "managed", path: install.path, removed: true });
    expect(fs.existsSync(install.path)).toBe(false);
  });

  it("removes npx-cache install via rm -rf", () => {
    const install = plant("npx-cache", "0.73.1");
    const results = uninstallLegacyPi([install]);
    expect(results[0].removed).toBe(true);
    expect(fs.existsSync(install.path)).toBe(false);
  });

  it("returns error result when path does not exist (rm force suppresses, returns removed=true)", () => {
    // fs.rmSync with force:true treats missing paths as success.
    const install: LegacyPiInstall = {
      scope: "managed",
      path: path.join(tmpHome, "does-not-exist"),
      version: null,
    };
    const results = uninstallLegacyPi([install]);
    expect(results[0].removed).toBe(true);
  });

  it("processes multiple installs independently", () => {
    const a = plant("managed", "0.70.0");
    const b = plant("npx-cache", "0.73.0");
    const results = uninstallLegacyPi([a, b]);
    expect(results.every((r) => r.removed)).toBe(true);
    expect(fs.existsSync(a.path)).toBe(false);
    expect(fs.existsSync(b.path)).toBe(false);
  });
});
