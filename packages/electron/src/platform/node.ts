/**
 * Platform-specific bundled-Node path resolution.
 *
 * The Electron app ships a per-architecture Node.js binary under
 * `resources/node/` so the dashboard server can be launched even when the
 * user has no system Node. Layout differs between Windows and Unix:
 *
 *   Windows:  <resources>/node/node.exe
 *   Unix:     <resources>/node/bin/node
 *
 * See change: consolidate-platform-handlers.
 */
import path from "node:path";
import { existsSync } from "node:fs";

export interface BundledNodeOpts {
  /** Absolute path to the Electron `resources/` directory. */
  resourcesPath: string;
  /** Override platform (defaults to process.platform). */
  platform?: NodeJS.Platform;
  /** Override existsSync (for tests). */
  exists?: (p: string) => boolean;
}

/**
 * Resolve the path to the bundled Node binary for the current platform,
 * or return `null` if it isn't present (dev mode, or a cross-platform
 * build that deliberately omits the binary).
 */
export function getBundledNodePath(opts: BundledNodeOpts): string | null {
  const platform = opts.platform ?? process.platform;
  const exists = opts.exists ?? existsSync;
  const p = platform === "win32"
    ? path.join(opts.resourcesPath, "node", "node.exe")
    : path.join(opts.resourcesPath, "node", "bin", "node");
  return exists(p) ? p : null;
}
