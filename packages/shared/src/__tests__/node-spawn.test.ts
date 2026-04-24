/**
 * Tests for `platform/node-spawn.ts` — the canonical helper for
 * constructing `node --import <loader> <entry>` argv.
 *
 * See change: fix-windows-entry-script-url.
 */
import { describe, it, expect, vi } from "vitest";
import { toFileUrl, spawnNodeScript, isTsxLoader } from "../platform/node-spawn.js";
import * as execModule from "../platform/exec.js";

describe("toFileUrl", () => {
  it("returns a file:// URL input unchanged (idempotent)", () => {
    expect(toFileUrl("file:///C:/foo.ts")).toBe("file:///C:/foo.ts");
    expect(toFileUrl("file:///usr/local/bin/cli.js")).toBe("file:///usr/local/bin/cli.js");
  });

  it("wraps Windows B:\\ drive-letter paths on any host OS", () => {
    expect(toFileUrl("B:\\Dev\\cli.ts")).toBe("file:///B:/Dev/cli.ts");
  });

  it("wraps Windows C:\\ drive-letter paths on any host OS", () => {
    expect(toFileUrl("C:\\Users\\x\\cli.ts")).toBe("file:///C:/Users/x/cli.ts");
  });

  it("wraps forward-slash Windows paths", () => {
    expect(toFileUrl("B:/Dev/cli.ts")).toBe("file:///B:/Dev/cli.ts");
  });

  it("wraps POSIX absolute paths", () => {
    expect(toFileUrl("/usr/local/bin/cli.js")).toBe("file:///usr/local/bin/cli.js");
  });

  it("handles uppercase and lowercase drive letters identically", () => {
    expect(toFileUrl("b:\\Dev\\cli.ts")).toBe("file:///b:/Dev/cli.ts");
    expect(toFileUrl("Z:\\foo.ts")).toBe("file:///Z:/foo.ts");
  });
});

describe("isTsxLoader", () => {
  it("returns true for loader URLs containing /tsx/", () => {
    expect(isTsxLoader("file:///home/x/node_modules/tsx/dist/esm/index.mjs")).toBe(true);
    expect(isTsxLoader("file:///C:/project/node_modules/tsx/dist/esm/index.mjs")).toBe(true);
  });

  it("returns true for raw paths with /tsx/ segment", () => {
    expect(isTsxLoader("/home/x/node_modules/tsx/dist/esm/index.mjs")).toBe(true);
  });

  it("returns true for Windows raw paths with \\tsx\\ segment", () => {
    expect(isTsxLoader("C:\\project\\node_modules\\tsx\\dist\\esm\\index.mjs")).toBe(true);
  });

  it("returns false for jiti loader", () => {
    expect(isTsxLoader("file:///home/x/node_modules/@mariozechner/jiti/lib/jiti-register.mjs")).toBe(false);
    expect(isTsxLoader("/home/x/node_modules/@mariozechner/jiti/lib/jiti-register.mjs")).toBe(false);
  });

  it("returns false for undefined / empty", () => {
    expect(isTsxLoader(undefined)).toBe(false);
    expect(isTsxLoader("")).toBe(false);
  });
});

describe("spawnNodeScript", () => {
  it("URL-wraps both loader and entry when loader is NOT tsx (jiti/default)", () => {
    const spawnSpy = vi
      .spyOn(execModule, "spawn")
      .mockImplementation(() => ({ unref: () => {} } as unknown as ReturnType<typeof execModule.spawn>));

    spawnNodeScript({
      nodeBin: "C:\\Program Files\\nodejs\\node.exe",
      loader: "B:\\jiti\\register.mjs",
      entry: "B:\\Dev\\cli.ts",
      args: ["start", "--dev"],
    });

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    const [bin, argv] = spawnSpy.mock.calls[0]!;
    expect(bin).toBe("C:\\Program Files\\nodejs\\node.exe");
    expect(argv).toEqual([
      "--import",
      "file:///B:/jiti/register.mjs",
      "file:///B:/Dev/cli.ts",
      "start",
      "--dev",
    ]);

    spawnSpy.mockRestore();
  });

  it("URL-wraps loader but passes RAW entry when loader is tsx", () => {
    const spawnSpy = vi
      .spyOn(execModule, "spawn")
      .mockImplementation(() => ({ unref: () => {} } as unknown as ReturnType<typeof execModule.spawn>));

    spawnNodeScript({
      nodeBin: "/usr/bin/node",
      loader: "/home/u/node_modules/tsx/dist/esm/index.mjs",
      entry: "/home/u/repo/packages/server/src/cli.ts",
      args: ["start"],
    });

    const [, argv] = spawnSpy.mock.calls[0]!;
    expect(argv).toEqual([
      "--import",
      "file:///home/u/node_modules/tsx/dist/esm/index.mjs",
      "/home/u/repo/packages/server/src/cli.ts",  // RAW, not URL
      "start",
    ]);
    spawnSpy.mockRestore();
  });

  it("defaults nodeBin to process.execPath when omitted", () => {
    const spawnSpy = vi
      .spyOn(execModule, "spawn")
      .mockImplementation(() => ({ unref: () => {} } as unknown as ReturnType<typeof execModule.spawn>));

    spawnNodeScript({
      entry: "/usr/local/cli.ts",
    });

    const [bin] = spawnSpy.mock.calls[0]!;
    expect(bin).toBe(process.execPath);
    spawnSpy.mockRestore();
  });

  it("omits --import when no loader is provided", () => {
    const spawnSpy = vi
      .spyOn(execModule, "spawn")
      .mockImplementation(() => ({ unref: () => {} } as unknown as ReturnType<typeof execModule.spawn>));

    spawnNodeScript({
      entry: "B:\\Dev\\cli.ts",
      args: ["help"],
    });

    const [, argv] = spawnSpy.mock.calls[0]!;
    expect(argv).toEqual(["file:///B:/Dev/cli.ts", "help"]);
    spawnSpy.mockRestore();
  });

  it("passes spawnOptions through to exec.spawn unchanged", () => {
    const spawnSpy = vi
      .spyOn(execModule, "spawn")
      .mockImplementation(() => ({ unref: () => {} } as unknown as ReturnType<typeof execModule.spawn>));

    const opts = { detached: true, stdio: ["ignore", 1, 2] as ("ignore" | number)[], env: { FOO: "bar" } };
    spawnNodeScript({
      entry: "/usr/local/cli.ts",
      spawnOptions: opts,
    });

    const [, , passedOpts] = spawnSpy.mock.calls[0]!;
    expect(passedOpts).toBe(opts);
    spawnSpy.mockRestore();
  });

  it("accepts a loader that is already a file:// URL without double-wrapping", () => {
    const spawnSpy = vi
      .spyOn(execModule, "spawn")
      .mockImplementation(() => ({ unref: () => {} } as unknown as ReturnType<typeof execModule.spawn>));

    spawnNodeScript({
      loader: "file:///C:/jiti/register.mjs",
      entry: "B:\\Dev\\cli.ts",
    });

    const [, argv] = spawnSpy.mock.calls[0]!;
    expect(argv).toEqual([
      "--import",
      "file:///C:/jiti/register.mjs",
      "file:///B:/Dev/cli.ts",
    ]);
    spawnSpy.mockRestore();
  });
});
