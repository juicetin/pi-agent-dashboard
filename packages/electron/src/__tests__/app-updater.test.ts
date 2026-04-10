import { describe, it, expect, vi } from "vitest";
import { initAutoUpdater, type AppUpdateCallbacks } from "../lib/app-updater.js";

describe("app-updater", () => {
  it("returns noop cleanup in dev mode", () => {
    const origDev = process.env.ELECTRON_DEV;
    process.env.ELECTRON_DEV = "1";
    try {
      const callbacks: AppUpdateCallbacks = {
        onUpdateAvailable: vi.fn(),
        onUpdateDownloaded: vi.fn(),
        onError: vi.fn(),
      };
      const cleanup = initAutoUpdater(callbacks);
      expect(typeof cleanup).toBe("function");
      cleanup(); // should not throw
    } finally {
      if (origDev !== undefined) process.env.ELECTRON_DEV = origDev;
      else delete process.env.ELECTRON_DEV;
    }
  });

  it("returns noop when electron-updater is not available", () => {
    const origDev = process.env.ELECTRON_DEV;
    delete process.env.ELECTRON_DEV;
    try {
      const callbacks: AppUpdateCallbacks = {
        onUpdateAvailable: vi.fn(),
        onUpdateDownloaded: vi.fn(),
        onError: vi.fn(),
      };
      // electron-updater won't be available in test environment
      const cleanup = initAutoUpdater(callbacks);
      expect(typeof cleanup).toBe("function");
      cleanup();
    } finally {
      if (origDev !== undefined) process.env.ELECTRON_DEV = origDev;
      else delete process.env.ELECTRON_DEV;
    }
  });
});
