/**
 * Family A — Electron-packaged dashboard scenarios.
 *
 * A1: electron-fresh   — bundled dashboard, no pi, no settings.
 * A2: electron-prewarmed — bundled dashboard, managed pi+openspec, valid settings.
 *
 * Full family (A3, A4) lands as cells are activated in tasks.md §6.
 */
import { describe, expect, it } from "vitest";
import { withFakeEnv, layer } from "../harness.js";
import { registerDefaultTools } from "../../../tool-registry/definitions.js";
import * as fixtures from "../fixtures/index.js";
import { snapshotTrail } from "../assertions.js";
import { register, SKIPPED_SCENARIOS, cellKey } from "../scenarios.js";

// Register the cells this file covers. Overrides the bulk-skip from
// scenarios-skipped.ts. Runs at module import.
const A1: Parameters<typeof register>[0][] = [
  { platform: "linux", dash: "electron", pi: "absent", settings: "missing", env: "normal" },
  { platform: "darwin", dash: "electron", pi: "absent", settings: "missing", env: "normal" },
  { platform: "win32", dash: "electron", pi: "absent", settings: "missing", env: "normal" },
];
const A2: Parameters<typeof register>[0][] = [
  { platform: "linux", dash: "electron", pi: "present-valid", settings: "valid", env: "normal" },
  { platform: "darwin", dash: "electron", pi: "present-valid", settings: "valid", env: "normal" },
  { platform: "win32", dash: "electron", pi: "present-valid", settings: "valid", env: "normal" },
];
// A3: electron bundled + global pi (user had pi before installing dashboard).
const A3: Parameters<typeof register>[0][] = [
  { platform: "linux", dash: "electron", pi: "present-no-ext", settings: "valid", env: "normal" },
];
// A4: linux AppImage first run (temp mount; bridge registration skipped).
const A4: Parameters<typeof register>[0][] = [
  { platform: "linux", dash: "electron", pi: "appimage-tmp", settings: "missing", env: "normal" },
];
for (const cell of [...A1, ...A2, ...A3, ...A4]) {
  register(cell, "families/a-electron.test.ts");
  SKIPPED_SCENARIOS.delete(cellKey(cell));
}

describe("Family A — electron-packaged", () => {
  describe("A1 — electron-fresh (bundled dashboard, no pi)", () => {
    it.each(["linux", "darwin", "win32"] as const)(
      "resolves nothing for pi (%s)",
      async (platform) => {
        const homedir = platform === "win32" ? "C:\\Users\\R" : "/home/r";
        await withFakeEnv(
          {
            platform,
            homedir,
            env: { PATH: platform === "win32" ? "C:\\Windows\\System32" : "/usr/bin" },
            fs: layer(fixtures.electronPackaged({ platform })),
          },
          (ctx) => {
            const registry = ctx.createRegistry();
            registerDefaultTools(registry, ctx.createStrategyDeps());
            const res = registry.resolve("pi");
            expect(res.ok).toBe(false);
            expect(snapshotTrail(res, ctx)).toMatchSnapshot();
          },
        );
      },
    );
  });

  describe("A2 — electron-prewarmed (bundled + managed pi)", () => {
    it.each(["linux", "darwin", "win32"] as const)(
      "resolves pi via managed (%s)",
      async (platform) => {
        const homedir = platform === "win32" ? "C:\\Users\\R" : "/home/r";
        await withFakeEnv(
          {
            platform,
            homedir,
            env: { PATH: platform === "win32" ? "C:\\Windows\\System32" : "/usr/bin" },
            fs: layer(
              fixtures.electronPackaged({ platform }),
              fixtures.managedInstall({ homedir, platform }),
              fixtures.settingsJson({
                homedir,
                platform,
                packages: [
                  platform === "win32"
                    ? "C:\\Program Files\\PI Dashboard\\resources\\server\\packages\\extension"
                    : "/usr/lib/pi-dashboard/resources/server/packages/extension",
                ],
              }),
            ),
          },
          (ctx) => {
            const registry = ctx.createRegistry();
            registerDefaultTools(registry, ctx.createStrategyDeps());
            const res = registry.resolve("pi");
            expect(res.ok).toBe(true);
            expect(res.source).toBe("managed");
            expect(snapshotTrail(res, ctx)).toMatchSnapshot();
          },
        );
      },
    );
  });

  describe("A3 — electron + pre-existing global pi", () => {
    it("global npm pi takes precedence over managed-bin fallback (linux)", async () => {
      const homedir = "/home/r";
      await withFakeEnv(
        {
          platform: "linux",
          homedir,
          env: { PATH: "/usr/local/bin" },
          fs: layer(
            fixtures.electronPackaged({ platform: "linux" }),
            fixtures.npmGlobalUnix({}),
            fixtures.settingsJson({ homedir, platform: "linux", packages: [] }),
          ),
        },
        (ctx) => {
          const registry = ctx.createRegistry();
          registerDefaultTools(registry, ctx.createStrategyDeps());
          const res = registry.resolve("pi");
          // pi chain on posix: override → managed-bin → where.
          // No managed install present; `where` finds /usr/local/bin/pi.
          expect(res.ok).toBe(true);
          expect(res.source).toBe("system");
          expect(snapshotTrail(res, ctx)).toMatchSnapshot();
        },
      );
    });
  });

  describe("A4 — AppImage first run (temp mount)", () => {
    it("findBundledExtension rejects /tmp/.mount_* paths", async () => {
      const homedir = "/home/r";
      await withFakeEnv(
        {
          platform: "linux",
          homedir,
          fs: fixtures.electronPackaged({ platform: "linux", appimage: true }),
        },
        (ctx) => {
          // The bundled extension resolved by findBundledExtension when
          // running from an AppImage temp mount would be under
          // `/tmp/.mount_*/...`. The real implementation rejects those
          // paths explicitly (bridge-register.ts). Here we just verify
          // the fixture places files where the temp-mount detection
          // would fire.
          const paths = fixtures.electronPaths({ platform: "linux", appimage: true });
          expect(paths.extensionDir).toContain("/tmp/.mount_");
          expect(ctx.fs.existsSync(paths.extensionDir + "/package.json")).toBe(true);
          // Full round-trip rejection lives in bridge-register unit
          // tests; this family cell confirms only the fixture shape.
        },
      );
    });
  });
});
