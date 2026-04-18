/**
 * Tests for packages/electron/src/platform/* — the Electron UI-concern
 * platform module. Pure functions only (no Electron-API calls in test).
 *
 * Note: tray-icon.ts is not tested here because it calls
 * `nativeImage.createFromPath` which requires an Electron runtime.
 * That file's only platform logic is a 3-way if/else that's trivially
 * reviewable.
 *
 * See change: consolidate-platform-handlers.
 */
import { describe, it, expect, vi } from "vitest";
import { getBundledNodePath } from "../platform/node.js";
import {
  configureLinuxOzoneHint,
  shouldQuitOnAllWindowsClosed,
} from "../platform/app-lifecycle.js";
import { usesMacMenuLayout } from "../platform/menu.js";

describe("getBundledNodePath", () => {
  it("resolves node.exe on Windows", () => {
    const exists = vi.fn().mockReturnValue(true);
    const result = getBundledNodePath({
      resourcesPath: "/app/resources",
      platform: "win32",
      exists,
    });
    expect(result).toMatch(/node[\\\/]node\.exe$/);
    expect(exists).toHaveBeenCalledWith(expect.stringMatching(/node[\\\/]node\.exe$/));
  });

  it("resolves bin/node on Linux", () => {
    const exists = vi.fn().mockReturnValue(true);
    const result = getBundledNodePath({
      resourcesPath: "/app/resources",
      platform: "linux",
      exists,
    });
    expect(result).toMatch(/node[\\\/]bin[\\\/]node$/);
  });

  it("resolves bin/node on macOS", () => {
    const exists = vi.fn().mockReturnValue(true);
    const result = getBundledNodePath({
      resourcesPath: "/app/resources",
      platform: "darwin",
      exists,
    });
    expect(result).toMatch(/node[\\\/]bin[\\\/]node$/);
  });

  it("returns null when the bundled binary is missing", () => {
    const exists = vi.fn().mockReturnValue(false);
    expect(getBundledNodePath({
      resourcesPath: "/app/resources",
      platform: "linux",
      exists,
    })).toBeNull();
  });
});

describe("configureLinuxOzoneHint", () => {
  function makeFakeApp() {
    const switches: Array<{ name: string; value: string }> = [];
    const app = {
      commandLine: {
        appendSwitch(name: string, value: string) {
          switches.push({ name, value });
        },
      },
    } as any;
    return { app, switches };
  }

  it("appends ozone-platform-hint on Linux when env var is unset", () => {
    const { app, switches } = makeFakeApp();
    configureLinuxOzoneHint(app, { platform: "linux", env: {} });
    expect(switches).toEqual([{ name: "ozone-platform-hint", value: "auto" }]);
  });

  it("does nothing on Linux when ELECTRON_OZONE_PLATFORM_HINT is already set", () => {
    const { app, switches } = makeFakeApp();
    configureLinuxOzoneHint(app, {
      platform: "linux",
      env: { ELECTRON_OZONE_PLATFORM_HINT: "x11" },
    });
    expect(switches).toEqual([]);
  });

  it("does nothing on macOS", () => {
    const { app, switches } = makeFakeApp();
    configureLinuxOzoneHint(app, { platform: "darwin", env: {} });
    expect(switches).toEqual([]);
  });

  it("does nothing on Windows", () => {
    const { app, switches } = makeFakeApp();
    configureLinuxOzoneHint(app, { platform: "win32", env: {} });
    expect(switches).toEqual([]);
  });
});

describe("shouldQuitOnAllWindowsClosed", () => {
  it("returns false on macOS (dock keeps app alive)", () => {
    expect(shouldQuitOnAllWindowsClosed({ platform: "darwin" })).toBe(false);
  });

  it("returns true on Windows", () => {
    expect(shouldQuitOnAllWindowsClosed({ platform: "win32" })).toBe(true);
  });

  it("returns true on Linux", () => {
    expect(shouldQuitOnAllWindowsClosed({ platform: "linux" })).toBe(true);
  });
});

describe("usesMacMenuLayout", () => {
  it("returns true for darwin", () => {
    expect(usesMacMenuLayout({ platform: "darwin" })).toBe(true);
  });

  it("returns false for win32", () => {
    expect(usesMacMenuLayout({ platform: "win32" })).toBe(false);
  });

  it("returns false for linux", () => {
    expect(usesMacMenuLayout({ platform: "linux" })).toBe(false);
  });
});
