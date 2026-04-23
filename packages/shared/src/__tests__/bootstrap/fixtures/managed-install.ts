/**
 * Fixture: managed install at `<homedir>/.pi-dashboard/`.
 *
 * Produces the fs layout a user gets after running the Electron wizard
 * or proposal-2's CLI first-run bootstrap: node_modules/@mariozechner/
 * pi-coding-agent + node_modules/.bin shims.
 */
import posix from "node:path/posix";
import win32 from "node:path/win32";
import type { FsRecord } from "../harness.js";
import { openspecPackageJson, piPackageJson, type PiVersionSpec } from "./pi-versions.js";

export interface ManagedInstallSpec {
  homedir: string;
  platform: NodeJS.Platform;
  pi?: PiVersionSpec | false;
  openspec?: string | false;
  tsx?: string | false;
  /**
   * If `true`, write just the package.json for pi — no `dist/cli.js`.
   * Simulates an install that was interrupted mid-extract (scenario E2).
   */
  piPartial?: boolean;
}

export function managedInstall(spec: ManagedInstallSpec): FsRecord {
  const p = spec.platform === "win32" ? win32 : posix;
  const out: Record<string, string> = {};
  const managedDir = p.join(spec.homedir, ".pi-dashboard");
  const nodeModules = p.join(managedDir, "node_modules");
  const binDir = p.join(nodeModules, ".bin");

  out[p.join(managedDir, "package.json")] = JSON.stringify({
    name: "pi-dashboard-managed",
    private: true,
    type: "module",
  });

  if (spec.pi !== false) {
    const piSpec = spec.pi ?? {};
    const piDir = p.join(nodeModules, "@mariozechner", "pi-coding-agent");
    out[p.join(piDir, "package.json")] = piPackageJson(piSpec);
    if (!spec.piPartial) {
      out[p.join(piDir, "dist", "cli.js")] = "#!/usr/bin/env node\n// pi cli stub";
      // bin shim
      if (spec.platform === "win32") {
        out[p.join(binDir, "pi.cmd")] = "@node %~dp0\\..\\@mariozechner\\pi-coding-agent\\dist\\cli.js %*";
      } else {
        out[p.join(binDir, "pi")] = "#!/bin/sh\nexec node ../@mariozechner/pi-coding-agent/dist/cli.js \"$@\"";
      }
    }
  }

  if (spec.openspec !== false) {
    const v = spec.openspec ?? "0.4.1";
    const dir = p.join(nodeModules, "openspec");
    out[p.join(dir, "package.json")] = openspecPackageJson(v);
    out[p.join(dir, "dist", "cli.js")] = "#!/usr/bin/env node";
    out[p.join(dir, "dist", "index.js")] = "module.exports = {};";
    if (spec.platform === "win32") {
      out[p.join(binDir, "openspec.cmd")] = "@node %~dp0\\..\\openspec\\dist\\cli.js %*";
    } else {
      out[p.join(binDir, "openspec")] = "#!/bin/sh\nexec node ../openspec/dist/cli.js \"$@\"";
    }
  }

  if (spec.tsx !== false) {
    const v = spec.tsx ?? "4.20.0";
    const dir = p.join(nodeModules, "tsx");
    out[p.join(dir, "package.json")] = JSON.stringify({
      name: "tsx",
      version: v,
      main: "dist/cli.mjs",
      bin: { tsx: "dist/cli.mjs" },
    });
    out[p.join(dir, "dist", "cli.mjs")] = "#!/usr/bin/env node";
    if (spec.platform === "win32") {
      out[p.join(binDir, "tsx.cmd")] = "@node %~dp0\\..\\tsx\\dist\\cli.mjs %*";
    } else {
      out[p.join(binDir, "tsx")] = "#!/bin/sh\nexec node ../tsx/dist/cli.mjs \"$@\"";
    }
  }

  return out;
}
