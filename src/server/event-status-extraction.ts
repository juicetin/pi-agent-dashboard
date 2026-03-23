/**
 * Extract session status/tool updates from forwarded events.
 * Returns partial DashboardSession updates, or null if the event is not relevant.
 */
import type { DashboardEvent, DashboardSession } from "../shared/types.js";

type SessionUpdates = Partial<Pick<DashboardSession, "status" | "currentTool">>;

export function extractSessionUpdates(event: DashboardEvent): SessionUpdates | null {
  switch (event.eventType) {
    case "agent_start":
      return { status: "streaming", currentTool: undefined };

    case "agent_end":
      return { status: "idle", currentTool: undefined };

    case "tool_execution_start":
      return { currentTool: (event.data.toolName as string) ?? undefined };

    case "tool_execution_end":
      return { currentTool: undefined };

    default:
      return null;
  }
}
