import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

describe("plugin requirement probe wiring", () => {
  it("passes the shared ToolRegistry to startup and refresh probes", () => {
    expect(serverSource).toContain(
      `requirementDeps: {\n            listInstalled: () => packageManagerWrapper.listInstalled("global"),\n            toolRegistry: getDefaultRegistry(),`,
    );
    expect(serverSource).toContain(
      `refreshRequirementProbesFor(null, {\n        listInstalled: () => packageManagerWrapper.listInstalled("global"),\n        toolRegistry: getDefaultRegistry(),`,
    );
  });
});
