#!/usr/bin/env node
/**
 * assert-runnable-bundle.mjs — runnable-bundle invariant gate
 *
 * Invoked by `.github/workflows/_electron-build.yml` (step "Assert runnable
 * bundle (cli.ts exists)") when `inputs.source_only_bundle == false`.
 *
 * Asserts that `packages/electron/resources/server/node_modules/
 * @blackbelt-technology/pi-dashboard-server/{src/cli.ts,package.json}`
 * exists after `bundle-server.mjs` ran. Without this gate, a regression in
 * `scripts/sync-versions.js` (workspace cross-ref drift → registry fallback
 * for unpublished CI versions) or a future change to the bundle layout
 * could silently ship a non-runnable artefact that throws
 * `BundledServerMissingError` only when the user double-clicks the
 * unzipped installer.
 *
 * Runs identically on Linux/macOS/Windows (no shell:bash). Pinned by
 * `packages/shared/src/__tests__/publish-workflow-contract.test.ts`
 * ("contains a runnable-bundle assertion step").
 *
 * See change: fix-ci-electron-runnable-bundles.
 */

import { existsSync } from "node:fs";
import path from "node:path";

const serverBundle = path.join(
  "packages",
  "electron",
  "resources",
  "server",
);
const pidaPkg = path.join(
  serverBundle,
  "node_modules",
  "@blackbelt-technology",
  "pi-dashboard-server",
);

const required = [
  // Core runnable invariant — change fix-ci-electron-runnable-bundles
  path.join(pidaPkg, "src", "cli.ts"),
  path.join(pidaPkg, "package.json"),
  // Manual-launch helpers — change add-bundle-manual-launch-scripts
  path.join(serverBundle, "start-server.cmd"),
  path.join(serverBundle, "start-server.ps1"),
  path.join(serverBundle, "start-server.sh"),
];

// Bundled Windows git+sh — only on win32 builds (which run on a Windows
// runner). dugite-native ships sh.exe, NOT bash.exe (R1 spike). Arch libdir
// is mingw64 (x64) / clangarm64 (arm64). See change: embed-git-bash-on-windows.
if (process.platform === "win32") {
  const gitDir = path.join("packages", "electron", "resources", "git");
  required.push(
    path.join(gitDir, "cmd", "git.exe"),
    path.join(gitDir, "usr", "bin", "sh.exe"),
    path.join(gitDir, "THIRD-PARTY-LICENSE.txt"),
  );
  if (!existsSync(path.join(gitDir, "mingw64")) && !existsSync(path.join(gitDir, "clangarm64"))) {
    console.error("\u2717 Runnable-bundle assertion failed. Missing bundled git arch libdir (mingw64 / clangarm64).");
    process.exit(1);
  }
}

const missing = required.filter((p) => !existsSync(p));

if (missing.length > 0) {
  console.error("\u2717 Runnable-bundle assertion failed. Missing paths:");
  for (const p of missing) console.error("  - " + p);
  console.error(
    "See changes: fix-ci-electron-runnable-bundles, add-bundle-manual-launch-scripts.",
  );
  process.exit(1);
}

console.log(
  `\u2713 Runnable bundle OK \u2014 ${required.length} path(s) present`,
);
