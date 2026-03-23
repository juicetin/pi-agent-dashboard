import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadZrokEnv } from "../tunnel.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("node:fs");
vi.mock("node:os");

describe("loadZrokEnv", () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue("/home/testuser");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return zrok env when enrolled", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        zrok_token: "tok_secret",
        ziti_identity: "env-abc123",
        api_endpoint: "https://api.zrok.io",
      })
    );

    const env = loadZrokEnv();
    expect(env).not.toBeNull();
    expect(env!.apiEndpoint).toBe("https://api.zrok.io");
    expect(env!.envZId).toBe("env-abc123");
    expect(env!.token).toBe("tok_secret");
  });

  it("should return null when not enrolled", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const env = loadZrokEnv();
    expect(env).toBeNull();
  });

  it("should return null on malformed JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("not valid json{{{");

    const env = loadZrokEnv();
    expect(env).toBeNull();
  });

  it("should return null when required fields are missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ ziti_identity: "test" })
    );

    const env = loadZrokEnv();
    expect(env).toBeNull();
  });
});
