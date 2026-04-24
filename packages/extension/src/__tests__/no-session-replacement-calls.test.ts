/**
 * Repo-level invariant: the bridge MUST NOT call pi's session-replacement
 * APIs (`pi.newSession(...)`, `ctx.fork(...)`, `ctx.switchSession(...)`)
 * from any code under `packages/extension/src/`.
 *
 * Rationale: pi 0.69.0+ invalidates captured pre-replacement `pi`/`ctx`/
 * session-bound objects on next access after these calls. The bridge
 * holds long-lived caches (`cachedCtx`, `cachedModelRegistry`,
 * `cachedHasUI` in `bridge.ts`; `modelRegistry` in `provider-register.ts`)
 * that depend on pi being the ONLY originator of session replacement, so
 * we can re-capture inside the resulting `session_start` handler keyed on
 * `event.reason ∈ {"new","fork","resume"}`.
 *
 * If this test fails: do NOT add the call. Either drive the user-facing
 * action through the dashboard server (which prompts the user, who
 * triggers replacement via pi's UI), or wrap your post-switch work in
 * the `withSession` callback that pi 0.69+ exposes on each replacement
 * API and capture the freshly-emitted ReplacedSessionContext there.
 *
 * See change: pi-zero-seventy-compat.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

/**
 * Each pattern matches `<receiver>.<method>(` allowing for whitespace and
 * tolerating common variations like `await pi.newSession(...)`. Prefixed
 * with a non-word boundary so we don't flag method names embedded in
 * longer identifiers.
 */
const PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "pi.newSession",     re: /(?:^|[^.\w])pi\.newSession\s*\(/ },
  { name: "ctx.fork",          re: /(?:^|[^.\w])ctx\.fork\s*\(/ },
  { name: "ctx.switchSession", re: /(?:^|[^.\w])ctx\.switchSession\s*\(/ },
];

/**
 * Per-line opt-out marker. Use only for documented exceptions (e.g. a
 * future migration cell that intentionally drives a replacement and
 * fully re-binds via `withSession`):
 *   await pi.newSession({ withSession: ... }); // ban:session-replacement-ok
 */
const OPT_OUT_MARKER = "ban:session-replacement-ok";

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "__tests__") continue;
      yield* walk(full);
    } else if (entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      yield full;
    }
  }
}

describe("no session-replacement API calls in packages/extension/src/", () => {
  it("bridge code never invokes pi.newSession / ctx.fork / ctx.switchSession", async () => {
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const srcDir = path.resolve(here, "..");
    const repoRoot = path.resolve(here, "..", "..", "..", "..");

    const violations: Array<{ file: string; line: number; pattern: string; text: string }> = [];

    for await (const file of walk(srcDir)) {
      const content = await fs.readFile(file, "utf-8");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (line.includes(OPT_OUT_MARKER)) return;
        for (const { name, re } of PATTERNS) {
          if (re.test(line)) {
            violations.push({
              file: path.relative(repoRoot, file),
              line: idx + 1,
              pattern: name,
              text: line.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const msg =
        `Bridge code MUST NOT call pi session-replacement APIs.\n` +
        `pi 0.69.0+ invalidates captured pre-replacement pi/ctx after these calls;\n` +
        `the bridge relies on pi being the sole originator of replacement so it can\n` +
        `re-capture state inside the resulting session_start handler.\n\n` +
        `Offenders (${violations.length}):\n` +
        violations
          .map((v) => `  ${v.file}:${v.line}  [${v.pattern}]  ${v.text}`)
          .join("\n");
      expect(violations, msg).toEqual([]);
    }
  });
});
