import { describe, it, expect } from "vitest";
import {
  buildJitiRegisterUrl,
  resolveJitiImport,
  pickJitiRegisterUrl,
  pickJitiFromAnchor,
  JITI_PACKAGES,
} from "../resolve-jiti.js";

describe("buildJitiRegisterUrl", () => {
  // Pure function: given a jiti package.json path, return the file:// URL of
  // its register hook. The URL contract is the critical invariant — Node's
  // --import on Windows rejects raw drive-letter paths (parses "C:" as a
  // URL scheme). See change: fix-windows-server-parity.

  it("returns a file:// URL", () => {
    const url = buildJitiRegisterUrl("/usr/lib/node_modules/@mariozechner/jiti/package.json");
    expect(url.startsWith("file://")).toBe(true);
  });

  it("URL is parseable by new URL() without throwing", () => {
    const url = buildJitiRegisterUrl("/usr/lib/node_modules/@mariozechner/jiti/package.json");
    expect(() => new URL(url)).not.toThrow();
  });

  it("points at lib/jiti-register.mjs under the package dir", () => {
    const url = buildJitiRegisterUrl("/usr/lib/node_modules/@mariozechner/jiti/package.json");
    expect(url.endsWith("/lib/jiti-register.mjs")).toBe(true);
  });

  it("handles Windows drive-letter paths (regression for ERR_UNSUPPORTED_ESM_URL_SCHEME)", () => {
    // This is the exact shape that crashed pre-fix: a raw path with a
    // drive letter was passed to `node --import` and Node parsed "B:" as
    // a URL scheme. A file:// URL sidesteps the parser entirely.
    const url = buildJitiRegisterUrl("B:\\Dev\\Nodejs\\global\\node_modules\\@mariozechner\\jiti\\package.json");
    expect(url.startsWith("file:///")).toBe(true);
    expect(() => new URL(url)).not.toThrow();
    expect(new URL(url).protocol).toBe("file:");
    // The drive letter survives as part of the pathname, not as a protocol
    expect(url.toLowerCase()).toContain("/b:/");
    expect(url.endsWith("/lib/jiti-register.mjs")).toBe(true);
  });

});

describe("resolveJitiImport", () => {
  // Integration-lite: behaviour depends on what's resolvable from
  // process.argv[1] (the vitest runner). Two valid outcomes:
  //   (a) vitest's own transitive `jiti` dep resolves → returns a URL.
  //   (b) nothing resolves → throws the documented error.
  // The URL-contract behaviour is covered by buildJitiRegisterUrl above
  // and the lookup-order behaviour by pickJitiRegisterUrl below. This
  // describe block exercises only the runtime-anchor branch.

  it("either returns a file:// URL or throws the documented error", () => {
    let result: string | undefined;
    let err: Error | undefined;
    try {
      result = resolveJitiImport();
    } catch (e) {
      err = e as Error;
    }
    if (result !== undefined) {
      expect(result.startsWith("file://")).toBe(true);
      expect(result.endsWith("/lib/jiti-register.mjs")).toBe(true);
    } else {
      expect(err).toBeDefined();
      expect(err!.message).toContain("Cannot find pi's TypeScript loader");
      expect(err!.message).toContain("pi-coding-agent");
    }
  });
});

describe("JITI_PACKAGES contract", () => {
  // The lookup-order contract: forks first, upstream last. Pinned so
  // a future contributor doesn't accidentally re-order and silently
  // change resolution priority for users mid-migration.
  it("contains the three supported provider names in lookup order", () => {
    expect(JITI_PACKAGES).toEqual(["@mariozechner/jiti", "@oh-my-pi/jiti", "jiti"]);
  });
});

describe("pickJitiRegisterUrl (test seam)", () => {
  // Mock a Node-style resolver. Returns a path when the spec matches
  // a configured "installed" package; throws like Node's resolve() does
  // for unfound modules.
  function makeResolver(installed: Record<string, string>) {
    return (spec: string): string => {
      if (spec in installed) return installed[spec];
      throw new Error(`Cannot find module '${spec}'`);
    };
  }

  it("returns @mariozechner/jiti's URL when only the legacy fork is installed", () => {
    const resolver = makeResolver({
      "@mariozechner/jiti/package.json": "/r/node_modules/@mariozechner/jiti/package.json",
    });
    const url = pickJitiRegisterUrl(resolver);
    expect(url).not.toBeNull();
    expect(url!).toContain("@mariozechner/jiti");
    expect(url!.endsWith("/lib/jiti-register.mjs")).toBe(true);
  });

  it("returns upstream jiti's URL when only upstream is installed (pi 0.73.1+)", () => {
    const resolver = makeResolver({
      "jiti/package.json": "/r/node_modules/jiti/package.json",
    });
    const url = pickJitiRegisterUrl(resolver);
    expect(url).not.toBeNull();
    // Match `/jiti/lib/...` but NOT `/@mariozechner/jiti/lib/...`
    expect(url!).toMatch(/\/jiti\/lib\/jiti-register\.mjs$/);
    expect(url!).not.toContain("@mariozechner");
    expect(url!).not.toContain("@oh-my-pi");
  });

  it("prefers @mariozechner/jiti when BOTH fork and upstream are present", () => {
    const calls: string[] = [];
    const resolver = (spec: string): string => {
      calls.push(spec);
      if (
        spec === "@mariozechner/jiti/package.json" ||
        spec === "jiti/package.json"
      ) {
        return `/r/node_modules/${spec}`;
      }
      throw new Error("nope");
    };
    const url = pickJitiRegisterUrl(resolver);
    expect(url).toContain("@mariozechner/jiti");
    // Crucially: the resolver was NOT asked for `jiti/package.json` because
    // the @mariozechner fork won first.
    expect(calls).toEqual(["@mariozechner/jiti/package.json"]);
  });

  it("prefers @oh-my-pi/jiti over upstream when fork-name #2 wins", () => {
    const resolver = makeResolver({
      "@oh-my-pi/jiti/package.json": "/r/node_modules/@oh-my-pi/jiti/package.json",
      "jiti/package.json": "/r/node_modules/jiti/package.json",
    });
    const url = pickJitiRegisterUrl(resolver);
    expect(url).toContain("@oh-my-pi/jiti");
  });

  it("returns null when no provider resolves", () => {
    const resolver = makeResolver({});
    expect(pickJitiRegisterUrl(resolver)).toBeNull();
  });
});

describe("pickJitiFromAnchor (test seam)", () => {
  function makeResolver(installed: Record<string, string>) {
    return (spec: string): string => {
      if (spec in installed) return installed[spec];
      throw new Error(`Cannot find module '${spec}'`);
    };
  }

  it("returns upstream jiti's URL when only upstream is on the anchor's chain", () => {
    const resolver = makeResolver({
      "jiti/package.json": "/anchor/node_modules/jiti/package.json",
    });
    const pathExists = (p: string): boolean =>
      p === "/anchor/node_modules/jiti/lib/jiti-register.mjs";
    const url = pickJitiFromAnchor(resolver, pathExists);
    expect(url).not.toBeNull();
    expect(url!).toMatch(/\/jiti\/lib\/jiti-register\.mjs$/);
  });

  it("skips a provider whose register file does not exist on disk", () => {
    // Resolver finds package.json but jiti-register.mjs is missing
    // (corrupt install). Expect skip-to-next, ultimately null.
    const resolver = makeResolver({
      "@mariozechner/jiti/package.json":
        "/anchor/node_modules/@mariozechner/jiti/package.json",
    });
    const pathExists = (): boolean => false;
    expect(pickJitiFromAnchor(resolver, pathExists)).toBeNull();
  });

  it("returns null when nothing resolves", () => {
    expect(
      pickJitiFromAnchor(
        () => {
          throw new Error("nope");
        },
        () => true,
      ),
    ).toBeNull();
  });
});
