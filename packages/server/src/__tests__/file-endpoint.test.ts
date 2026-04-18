/**
 * Tests for the file read endpoint logic.
 * Uses lightweight path validation tests since integration tests
 * require a full server (covered by manual testing).
 */
import { describe, it, expect } from "vitest";
import path from "node:path";

/**
 * Extracted path containment check — same logic used in the endpoint.
 */
function isPathContained(cwd: string, relPath: string): boolean {
  const resolved = path.resolve(cwd, relPath);
  return resolved.startsWith(cwd + path.sep) || resolved === cwd;
}

// Platform-agnostic absolute paths. On Windows `path.resolve("/project")`
// prepends the current drive letter; using path.resolve for both fixture
// inputs keeps the test cwd and the containment check consistent.
const PROJECT = path.resolve("/project");
const PROJECT_SUB = path.resolve("/project/sub");
const OUTSIDE_ABS = path.resolve("/etc/passwd");

describe("file endpoint path validation", () => {
  it("should allow a simple relative path", () => {
    expect(isPathContained(PROJECT, "readme.md")).toBe(true);
  });

  it("should allow a nested relative path", () => {
    expect(isPathContained(PROJECT, "openspec/changes/foo/proposal.md")).toBe(true);
  });

  it("should allow a subdirectory path", () => {
    expect(isPathContained(PROJECT, "openspec/changes/foo/specs")).toBe(true);
  });

  it("should reject path traversal with ../", () => {
    expect(isPathContained(PROJECT, "../../etc/passwd")).toBe(false);
  });

  it("should reject path traversal that resolves outside cwd", () => {
    expect(isPathContained(PROJECT_SUB, "../other/file.md")).toBe(false);
  });

  it("should allow path with ../ that stays inside cwd", () => {
    expect(isPathContained(PROJECT, "a/../b/file.md")).toBe(true);
  });

  it("should reject absolute path outside cwd", () => {
    expect(isPathContained(PROJECT, OUTSIDE_ABS)).toBe(false);
  });

  it("should allow cwd itself", () => {
    expect(isPathContained(PROJECT, ".")).toBe(true);
  });
});
