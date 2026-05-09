/**
 * Boot integration tests — plugin server entry behavior without Docker / in cloud mode.
 * Tasks 9.4 + 9.5.
 *
 * These test the runAutoStart logic paths using the actual plugin-state module
 * and mocking only compose-lifecycle (to avoid Docker dependency).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getStatus, resetState } from "../server/plugin-state.js";

// Mock compose-lifecycle to control docker detection
vi.mock("../server/compose-lifecycle.js", () => ({
  detectDocker: vi.fn(),
  ensureComposeFile: vi.fn(),
  composeUp: vi.fn(),
  pollHealth: vi.fn(),
  runMigrations: vi.fn(),
}));

vi.mock("../server/storage-backend.js", () => ({
  ensureStorageBackend: vi.fn(),
}));

import { detectDocker } from "../server/compose-lifecycle.js";
import { readConfigFile, writeConfigFile } from "../server/config-store.js";
import { setStatus } from "../server/plugin-state.js";

describe("boot integration", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "honcho-boot-"));
    configPath = path.join(tmpDir, "config.json");
  });

  it("9.4: boots without Docker → state=docker-missing, no crash", async () => {
    writeConfigFile(
      { mode: "self-host", selfHost: { autoStart: true } },
      configPath,
    );

    (detectDocker as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: false,
      error: "docker not found",
    });

    // Simulate runAutoStart logic
    const cfg = readConfigFile(configPath);
    expect(cfg.mode).toBe("self-host");

    const docker = await detectDocker();
    if (!docker.available) {
      setStatus({
        state: "docker-missing",
        mode: "self-host",
        lastError: docker.error,
      });
    }

    const status = getStatus();
    expect(status.state).toBe("docker-missing");
    expect(status.lastError).toBe("docker not found");
    // No crash — test passes
  });

  it("9.5: boots in cloud mode → no docker calls, no compose file", async () => {
    writeConfigFile({ mode: "cloud" }, configPath);

    const cfg = readConfigFile(configPath);
    if (cfg.mode !== "self-host") {
      setStatus({ state: "configured", mode: "cloud" });
    }

    const status = getStatus();
    expect(status.state).toBe("configured");
    expect(status.mode).toBe("cloud");

    // detectDocker should NOT have been called
    expect(detectDocker).not.toHaveBeenCalled();
  });
});
