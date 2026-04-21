/**
 * Fixture: stamp a specific version into a pi-coding-agent package.json.
 * Returns the package.json JSON string ready for FsRecord insertion.
 */
export interface PiVersionSpec {
  name?: string;
  version?: string;
  bin?: Record<string, string>;
  main?: string;
}

export function piPackageJson(spec: PiVersionSpec = {}): string {
  return JSON.stringify(
    {
      name: spec.name ?? "@mariozechner/pi-coding-agent",
      version: spec.version ?? "0.6.3",
      main: spec.main ?? "dist/cli.js",
      bin: spec.bin ?? { pi: "dist/cli.js" },
    },
    null,
    2,
  );
}

export function openspecPackageJson(version = "0.4.1"): string {
  return JSON.stringify(
    {
      name: "openspec",
      version,
      main: "dist/index.js",
      bin: { openspec: "dist/cli.js" },
    },
    null,
    2,
  );
}
