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
for (const cell of A1) register(cell, "families/a-electron.test.ts:A1");
for (const cell of A2) register(cell, "families/a-electron.test.ts:A2");
for (const cell of A1) SKIPPED_SCENARIOS.delete(cellKey(cell));
for (const cell of A2) SKIPPED_SCENARIOS.delete(cellKey(cell));

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
});
