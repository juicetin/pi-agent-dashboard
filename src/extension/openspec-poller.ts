/**
 * Polls the openspec CLI to gather change data for the session's project.
 */
import { spawnSync } from "node:child_process";
import type { OpenSpecData, OpenSpecChange, OpenSpecArtifact } from "../shared/types.js";

const EMPTY_DATA: OpenSpecData = { initialized: false, changes: [] };

function runOpenSpec(args: string[], cwd: string): unknown | null {
  try {
    const result = spawnSync("openspec", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    });
    if (result.status !== 0 || !result.stdout) return null;
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export function pollOpenSpec(cwd: string): OpenSpecData {
  const listResult = runOpenSpec(["list", "--json"], cwd) as {
    changes?: Array<{
      name: string;
      status: string;
      completedTasks: number;
      totalTasks: number;
    }>;
  } | null;

  if (!listResult || !Array.isArray(listResult.changes)) {
    return EMPTY_DATA;
  }

  const changes: OpenSpecChange[] = listResult.changes.map((c) => {
    // Get detailed status for each change
    const statusResult = runOpenSpec(
      ["status", "--change", c.name, "--json"],
      cwd,
    ) as {
      artifacts?: Array<{ id: string; status: string }>;
    } | null;

    const artifacts: OpenSpecArtifact[] = (statusResult?.artifacts ?? []).map((a) => ({
      id: a.id,
      status: (a.status === "done" ? "done" : a.status === "ready" ? "ready" : "blocked") as OpenSpecArtifact["status"],
    }));

    return {
      name: c.name,
      status: (c.status === "complete" ? "complete" : c.status === "in-progress" ? "in-progress" : "no-tasks") as OpenSpecChange["status"],
      completedTasks: c.completedTasks ?? 0,
      totalTasks: c.totalTasks ?? 0,
      artifacts,
    };
  });

  return { initialized: true, changes };
}
