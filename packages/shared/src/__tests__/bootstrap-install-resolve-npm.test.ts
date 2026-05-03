/**
 * Regression: `resolveNpmArgv` from `bootstrap-install.ts` MUST consult
 * the injected `ToolRegistry` for `npm` before falling back to the
 * platform `npm` / `npm.cmd` PATH binary.
 *
 * The change `embed-managed-node-runtime` adds a managedRuntime
 * strategy to the npm chain in the registry. If a future refactor
 * accidentally bypasses the registry inside `resolveNpmArgv`, the
 * managed Node runtime would stop being preferred for shared bootstrap
 * spawns \u2014 the user-visible regression class this whole change exists
 * to prevent.
 *
 * See change: embed-managed-node-runtime (task 4.2).
 */
import { describe, expect, it } from "vitest";
import { resolveNpmArgv } from "../bootstrap-install.js";
import type {
  Resolution,
  ToolRegistry,
} from "../tool-registry/index.js";

function fakeRegistry(opts: {
  hasNpm?: boolean;
  resolveResult?: Partial<Resolution>;
}): ToolRegistry {
  // Only the methods `resolveNpmArgv` actually calls.
  return {
    has: (name: string) => name === "npm" && (opts.hasNpm ?? true),
    resolve: () =>
      ({
        name: "npm",
        ok: true,
        path: "/managed/node/bin/npm",
        source: "managed",
        tried: [],
        resolvedAt: Date.now(),
        ...opts.resolveResult,
      }) as Resolution,
  } as unknown as ToolRegistry;
}

describe("resolveNpmArgv", () => {
  it("explicit npmArgv wins over registry", () => {
    const argv = resolveNpmArgv({
      npmArgv: ["/explicit/node", "/explicit/npm-cli.js"],
      registry: fakeRegistry({}),
    });
    expect(argv).toEqual(["/explicit/node", "/explicit/npm-cli.js"]);
  });

  it("uses ToolRegistry.resolve('npm') when no explicit argv", () => {
    const argv = resolveNpmArgv({
      registry: fakeRegistry({
        resolveResult: { ok: true, path: "/managed/node/bin/npm" } as Partial<Resolution>,
      }),
    });
    expect(argv).toEqual(["/managed/node/bin/npm"]);
  });

  it("falls back to npm/npm.cmd on PATH when registry has no entry", () => {
    const argv = resolveNpmArgv({
      registry: {
        has: () => false,
        resolve: () => {
          throw new Error("should not be called");
        },
      } as unknown as ToolRegistry,
    });
    expect(argv).toHaveLength(1);
    expect(argv[0]).toMatch(/^npm(\.cmd)?$/);
  });
});
