/**
 * Resolves paths to the bundled Node.js runtime in Electron's extraResources.
 * The bundled Node is used as a fallback when system Node is not available.
 *
 * Layout in packaged app:
 *   <app>/resources/node/bin/node       (macOS/Linux)
 *   <app>/resources/node/node.exe       (Windows)
 *   <app>/resources/node/lib/node_modules/npm/bin/npm-cli.js
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getBundledNodePath as platformGetBundledNodePath } from "../platform/node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Detect whether we're running in a packaged Electron app. */
function isPackaged(): boolean {
  // In packaged apps, app.isPackaged is true and __dirname is inside the asar
  return typeof process !== "undefined" && (process as any).resourcesPath !== undefined;
}

/** Get the resources path (works in both packaged and dev). */
function getResourcesPath(): string {
  // In packaged app: process.resourcesPath = <app>/Contents/Resources (macOS)
  if ((process as any).resourcesPath) {
    return (process as any).resourcesPath;
  }
  // In dev: relative to this file → packages/electron/src/lib/ → project root → resources/
  return path.resolve(__dirname, "..", "..", "..", "..", "resources");
}

/**
 * Returns the absolute path to the bundled Node.js binary, or null if not
 * present. Platform-specific path resolution is delegated to the Electron
 * platform module. See change: consolidate-platform-handlers.
 */
export function getBundledNodePath(): string | null {
  return platformGetBundledNodePath({ resourcesPath: getResourcesPath() });
}

/**
 * Returns the absolute path to the bundled npm CLI script, or null if not present.
 */
export function getBundledNpmPath(): string | null {
  const resources = getResourcesPath();
  // Unix layout: node/lib/node_modules/npm/bin/npm-cli.js
  // Windows layout: node/node_modules/npm/bin/npm-cli.js
  const candidates = [
    path.join(resources, "node", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(resources, "node", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}
