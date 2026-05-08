/**
 * Unit tests for `scripts/sync-versions-spec.js::isRewritableSemverSpec`.
 *
 * Lives in `packages/shared/__tests__/` because the repo's vitest projects all
 * scope to `packages/`; the helper itself stays in `scripts/` (pure JS, no
 * runtime deps) so the release script can `import` it without crossing into
 * a workspace package boundary.
 *
 * The classifier decides which dependency specifiers are eligible for the
 * release bump's `^<version>` rewrite. False values are deliberate human
 * overrides and MUST be preserved (the bug this guards: a future hotfix
 * pin like `"*"` being silently rewritten on the next release).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error — pure JS helper one level above the package; no .d.ts
import { isRewritableSemverSpec } from "../../../../scripts/sync-versions-spec.js";

describe("isRewritableSemverSpec", () => {
  describe("rewritable forms (returns true)", () => {
    it.each([
      ["plain", "0.5.0"],
      ["caret", "^0.5.0"],
      ["tilde", "~0.5.0"],
      ["caret + prerelease", "^0.5.0-alpha.1"],
      ["plain + prerelease", "0.5.0-rc.0"],
      ["caret + build", "^0.5.0+sha.abc"],
      ["caret + prerelease + build", "^0.5.0-alpha.1+sha.abc"],
      ["multi-digit", "10.20.30"],
    ])("returns true for %s (%s)", (_label, spec) => {
      expect(isRewritableSemverSpec(spec)).toBe(true);
    });
  });

  describe("preserved forms (returns false)", () => {
    it.each([
      ["wildcard", "*"],
      ["latest tag", "latest"],
      ["dist-tag", "next"],
      ["workspace protocol", "workspace:*"],
      ["workspace caret", "workspace:^0.5.0"],
      ["github URL", "github:owner/repo#sha"],
      ["github tarball URL", "https://github.com/o/r/tarball/main"],
      ["git+ssh URL", "git+ssh://git@github.com/o/r.git"],
      ["file path", "file:../foo"],
      ["plain http tarball", "http://example.com/x.tgz"],
      ["range gte", ">=1.0.0"],
      ["range or-union", "1.0.0 || 2.0.0"],
      ["range hyphen", "1.0.0 - 2.0.0"],
      ["range x", "1.x"],
      ["range x-dotted", "1.x.x"],
      ["empty", ""],
      ["whitespace only", "   "],
      ["partial caret", "^"],
    ])("returns false for %s (%s)", (_label, spec) => {
      expect(isRewritableSemverSpec(spec)).toBe(false);
    });
  });

  describe("non-string inputs", () => {
    it("returns false for undefined", () => {
      expect(isRewritableSemverSpec(undefined)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isRewritableSemverSpec(null)).toBe(false);
    });

    it("returns false for number", () => {
      expect(isRewritableSemverSpec(0.5)).toBe(false);
    });

    it("returns false for object", () => {
      expect(isRewritableSemverSpec({ version: "1.0.0" })).toBe(false);
    });
  });
});
