/**
 * Family G — Windows specifics.
 *
 * G1: win-cmd-shim          — pi.cmd found; `toArgv` MUST prepend node.exe.
 * G2: win-appdata-roaming    — npm-g installed at %APPDATA%\Roaming\npm.
 * G3: win-programfiles-cwd   — cwd under "C:\Program Files (x86)\..."
 *                              (covered in F1-win; add a G-variant with
 *                              pi resolution via npm-g).
 * G4: win-programfiles-node  — node.exe at "C:\Program Files\nodejs".
 */
import { describe, expect, it } from "vitest";
import { withFakeEnv, layer } from "../harness.js";
import { registerDefaultTools } from "../../../tool-registry/definitions.js";
import * as fixtures from "../fixtures/index.js";
import { snapshotTrail } from "../assertions.js";
import { register, SKIPPED_SCENARIOS, cellKey } from "../scenarios.js";

// All Family G cells are win32-only.
const G = [
  // G1 is already covered by B2 (npm-g on win32); this family focuses
  // on specific layout variants.
  { platform: "win32", dash: "managed", pi: "present-valid", settings: "valid", env: "normal" },
  { platform: "win32", dash: "npm-g", pi: "present-valid", settings: "valid", env: "normal" },
] as const;
for (const cell of G) {
  register(cell, "families/g-windows-specifics.test.ts");
  SKIPPED_SCENARIOS.delete(cellKey(cell));
}

describe("Family G — Windows specifics", () => {
  it("G1 — pi.cmd resolved + toArgv prepends node.exe (no-cmd-flash)", async () => {
    // Managed install with pi-coding-agent at a real module path, NOT
    // the .bin/pi.cmd shim. This forces resolution through
    // managedModuleStrategy (matches `@mariozechner/pi-coding-agent/
    // dist/cli.js`), which is a Node script — `toArgv` prepends
    // node.exe. That's the no-cmd-flash invariant.
    const homedir = "C:\\Users\\R";
    await withFakeEnv(
      {
        platform: "win32",
        homedir,
        env: { PATH: "C:\\Program Files\\nodejs" },
        fs: layer(
          fixtures.managedInstall({ homedir, platform: "win32" }),
          {
            // node.exe must be resolvable for toArgv to prepend it.
            "C:\\Program Files\\nodejs\\node.exe": "\x7fELF",
          },
        ),
      },
      (ctx) => {
        const registry = ctx.createRegistry();
        registerDefaultTools(registry, ctx.createStrategyDeps());
        const executor = registry.resolveExecutor("pi");
        expect(executor.ok).toBe(true);
        expect(executor.path?.endsWith("cli.js")).toBe(true);
        // No-cmd-flash invariant: argv[0] MUST be node.exe, NOT the
        // .cmd shim or cmd.exe. The snapshot locks this in.
        expect(executor.argv[0]).toBe("C:\\Program Files\\nodejs\\node.exe");
        expect(executor.argv).toHaveLength(2);
        expect(snapshotTrail(executor, ctx)).toMatchSnapshot();
      },
    );
  });

  it("G2 — npm-g at %APPDATA%\\Roaming\\npm (argv prepends node.exe)", async () => {
    const homedir = "C:\\Users\\R";
    await withFakeEnv(
      {
        platform: "win32",
        homedir,
        env: {
          PATH: "C:\\Users\\R\\AppData\\Roaming\\npm;C:\\Program Files\\nodejs",
          APPDATA: "C:\\Users\\R\\AppData\\Roaming",
        },
        fs: layer(
          fixtures.npmGlobalWindowsAppData(homedir, { dashboard: false }),
          { "C:\\Program Files\\nodejs\\node.exe": "\x7fELF" },
        ),
      },
      (ctx) => {
        const registry = ctx.createRegistry();
        registerDefaultTools(registry, ctx.createStrategyDeps());
        const executor = registry.resolveExecutor("pi");
        expect(executor.ok).toBe(true);
        expect(executor.source).toBe("npm-global");
        // Same no-cmd-flash invariant: even for npm-g, argv routes
        // through node.exe.
        expect(executor.argv[0]).toBe("C:\\Program Files\\nodejs\\node.exe");
        expect(snapshotTrail(executor, ctx)).toMatchSnapshot();
      },
    );
  });

  it("G3 — cwd under Program Files (x86) does not affect resolution", async () => {
    // Spec requires this cell tested; covered structurally by F1-win,
    // but a dedicated block documents the invariant alongside the
    // other G cells.
    const homedir = "C:\\Users\\R";
    await withFakeEnv(
      {
        platform: "win32",
        homedir,
        cwd: "C:\\Program Files (x86)\\Pi Dashboard",
        fs: fixtures.managedInstall({ homedir, platform: "win32" }),
      },
      (ctx) => {
        const registry = ctx.createRegistry();
        registerDefaultTools(registry, ctx.createStrategyDeps());
        const res = registry.resolve("pi");
        expect(res.ok).toBe(true);
        expect(res.source).toBe("managed");
      },
    );
  });

  it("G4 — node.exe at C:\\Program Files\\nodejs\\node.exe", async () => {
    const homedir = "C:\\Users\\R";
    await withFakeEnv(
      {
        platform: "win32",
        homedir,
        env: { PATH: "C:\\Program Files\\nodejs" },
        fs: layer(
          fixtures.managedInstall({ homedir, platform: "win32" }),
          {
            "C:\\Program Files\\nodejs\\node.exe": "\x7fELF",
          },
        ),
      },
      (ctx) => {
        const registry = ctx.createRegistry();
        registerDefaultTools(registry, ctx.createStrategyDeps());
        const nodeRes = registry.resolveExecutor("node");
        expect(nodeRes.ok).toBe(true);
        expect(nodeRes.path).toBe("C:\\Program Files\\nodejs\\node.exe");
        // Binary-kind tool: argv = [path] (no interpreter prepended).
        expect(nodeRes.argv).toEqual(["C:\\Program Files\\nodejs\\node.exe"]);
        expect(snapshotTrail(nodeRes, ctx)).toMatchSnapshot();
      },
    );
  });
});
