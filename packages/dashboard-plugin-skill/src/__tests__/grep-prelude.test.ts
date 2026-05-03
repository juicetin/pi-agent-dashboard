/**
 * Mode `augment` grep-prelude test.
 *
 * Spins up a tmp dir with a fixture pi-extension source, runs grep-tui-surface.sh,
 * asserts the JSON output names every callsite category.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "..", "scripts", "grep-tui-surface.sh");

const SAMPLE_TS = `
import { Pi, Ctx } from "pi-coding-agent";

export async function run(ctx: Ctx, pi: Pi) {
  const choice = await ctx.ui.select({ title: "pick" });
  const detail = await ctx.ui.custom<{ name: string }>({ component: "X" });
  pi.registerTool({ name: "Doit", parameters: {}, handler: async () => ({}) });
  // Banned in dashboard:
  ctx.fork({ from: "head" });
}
`;

let workdir: string;
let output: { callsites: Array<{ file: string; line: number; callsite: string; category: string }> };

beforeAll(() => {
  if (!fs.existsSync(SCRIPT)) {
    throw new Error(`script missing: ${SCRIPT}`);
  }
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "grep-prelude-test-"));
  fs.mkdirSync(path.join(workdir, "src"), { recursive: true });
  fs.writeFileSync(path.join(workdir, "src", "foo.ts"), SAMPLE_TS);

  const result = cp.spawnSync("bash", [SCRIPT], { cwd: workdir, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`grep-tui-surface.sh exit ${result.status}: ${result.stderr}`);
  }
  output = JSON.parse(result.stdout);
});

describe("grep-tui-surface.sh", () => {
  it("emits the JSON envelope", () => {
    expect(output).toBeTruthy();
    expect(Array.isArray(output.callsites)).toBe(true);
  });

  it("captures tui-prompt callsite (ctx.ui.select)", () => {
    const hit = output.callsites.find((c) => c.category === "tui-prompt");
    expect(hit).toBeDefined();
    expect(hit!.callsite).toMatch(/ctx\.ui\.select/);
  });

  it("captures tui-custom callsite (ctx.ui.custom)", () => {
    const hit = output.callsites.find((c) => c.category === "tui-custom");
    expect(hit).toBeDefined();
    expect(hit!.callsite).toMatch(/ctx\.ui\.custom/);
  });

  it("captures tool-register callsite (pi.registerTool)", () => {
    const hit = output.callsites.find((c) => c.category === "tool-register");
    expect(hit).toBeDefined();
    expect(hit!.callsite).toMatch(/pi\.registerTool/);
  });

  it("captures banned callsite (ctx.fork)", () => {
    const hit = output.callsites.find((c) => c.category === "banned");
    expect(hit).toBeDefined();
    expect(hit!.callsite).toMatch(/ctx\.fork/);
  });

  it("is deterministic — second invocation produces identical JSON", () => {
    const second = cp.spawnSync("bash", [SCRIPT], { cwd: workdir, encoding: "utf8" });
    expect(second.status).toBe(0);
    expect(second.stdout).toBe(JSON.stringify(output) + "\n");
  });
});

describe("grep-tui-surface.sh — empty project", () => {
  it("emits an empty callsites array", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "grep-prelude-empty-"));
    fs.mkdirSync(path.join(empty, "src"));
    fs.writeFileSync(path.join(empty, "src", "noop.ts"), "export const x = 1;\n");
    const result = cp.spawnSync("bash", [SCRIPT], { cwd: empty, encoding: "utf8" });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { callsites: unknown[] };
    expect(parsed.callsites).toEqual([]);
  });
});
