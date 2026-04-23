/**
 * Fixture: Electron packaged resources layout.
 *
 * macOS:   /Applications/PI Dashboard.app/Contents/Resources/server/...
 * Linux:   /usr/lib/pi-dashboard/resources/server/...
 * Windows: C:\Program Files\PI Dashboard\resources\server\...
 * AppImage: /tmp/.mount_PIxxxx/resources/server/... (temp, unstable)
 *
 * The bundled extension lives alongside at
 * `<resourcesPath>/server/packages/extension/`.
 */
import posix from "node:path/posix";
import win32 from "node:path/win32";
import type { FsRecord } from "../harness.js";

export interface ElectronLayoutSpec {
  platform: NodeJS.Platform;
  /** If true, simulate AppImage temp-mount path. */
  appimage?: boolean;
}

function resourcesRoot(spec: ElectronLayoutSpec): string {
  if (spec.appimage) {
    return "/tmp/.mount_PIxxxx/resources";
  }
  switch (spec.platform) {
    case "darwin":
      return "/Applications/PI Dashboard.app/Contents/Resources";
    case "win32":
      return "C:\\Program Files\\PI Dashboard\\resources";
    default:
      return "/usr/lib/pi-dashboard/resources";
  }
}

export function electronPackaged(spec: ElectronLayoutSpec): FsRecord {
  const p = spec.platform === "win32" ? win32 : posix;
  const resources = resourcesRoot(spec);
  const serverDir = p.join(resources, "server");
  const extensionDir = p.join(serverDir, "packages", "extension");
  const out: Record<string, string> = {};

  // Bundled server package.json
  out[p.join(serverDir, "package.json")] = JSON.stringify({
    name: "@blackbelt-technology/pi-agent-dashboard-root",
    version: "0.4.0",
    private: true,
  });

  // Bundled server CLI source
  out[p.join(serverDir, "packages", "server", "package.json")] = JSON.stringify({
    name: "@blackbelt-technology/pi-dashboard-server",
    version: "0.4.0",
  });
  out[p.join(serverDir, "packages", "server", "src", "cli.ts")] = "// cli";

  // Bundled bridge extension
  out[p.join(extensionDir, "package.json")] = JSON.stringify({
    name: "@blackbelt-technology/pi-dashboard-extension",
    version: "0.4.0",
  });
  out[p.join(extensionDir, "src", "bridge.ts")] = "// bridge";

  // Bundled Node.js (minimal)
  const nodeBin = spec.platform === "win32"
    ? p.join(resources, "node", "bin", "node.exe")
    : p.join(resources, "node", "bin", "node");
  out[nodeBin] = "\x7fELF"; // binary-ish marker

  return out;
}

/** Returns the resolved `resourcesPath` + extension path for assertions. */
export function electronPaths(spec: ElectronLayoutSpec): {
  resources: string;
  serverDir: string;
  extensionDir: string;
} {
  const p = spec.platform === "win32" ? win32 : posix;
  const resources = resourcesRoot(spec);
  const serverDir = p.join(resources, "server");
  const extensionDir = p.join(serverDir, "packages", "extension");
  return { resources, serverDir, extensionDir };
}
