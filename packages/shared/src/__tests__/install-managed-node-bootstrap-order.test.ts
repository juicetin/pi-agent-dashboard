/**
 * Pin the call order in `installStandalone` (the Electron entry that
 * the spec calls `installAllTools`):
 *
 *     installManagedNode(...) <  any sharedBootstrapInstall(...)
 *
 * We can't easily run installStandalone end-to-end here (it's Electron
 * code, requires a packaged resources path, spawns real npm). So this
 * is a script-text test that greps the dependency-installer source for
 * the call sites and asserts their byte offsets are in the right order.
 * If a refactor moves installManagedNode after the first npm install,
 * the regression \u2014 a fresh Windows install having no managed Node when
 * the very first install runs \u2014 cannot land silently.
 *
 * See change: embed-managed-node-runtime (task 4.3).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// packages/shared/src/__tests__/ \u2192 ../../../electron/src/lib/dependency-installer.ts
const SOURCE_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "electron",
  "src",
  "lib",
  "dependency-installer.ts",
);

describe("installStandalone call order", () => {
  it("installManagedNode runs before sharedBootstrapInstall", () => {
    const text = fs.readFileSync(SOURCE_PATH, "utf-8");

    // Locate the installStandalone function body.
    const fnIdx = text.indexOf("export async function installStandalone");
    expect(fnIdx).toBeGreaterThan(-1);

    // Scope the search to the function body — find its closing brace.
    // Cheap bracket counter: starts after the first `{` after fnIdx.
    const bodyStart = text.indexOf("{", fnIdx);
    let depth = 0;
    let bodyEnd = bodyStart;
    for (let i = bodyStart; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    const body = text.slice(bodyStart, bodyEnd);

    const managedIdx = body.indexOf("installManagedNode(");
    const sharedIdx = body.indexOf("sharedBootstrapInstall(");

    expect(managedIdx).toBeGreaterThan(-1);
    expect(sharedIdx).toBeGreaterThan(-1);
    expect(managedIdx).toBeLessThan(sharedIdx);
  });
});
