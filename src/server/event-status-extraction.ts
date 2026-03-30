/**
 * Extract session status/tool updates from forwarded events.
 * Returns partial DashboardSession updates, or null if the event is not relevant.
 */
import type { DashboardEvent, DashboardSession } from "../shared/types.js";

// Use null (not undefined) for fields that must be cleared — undefined is
// dropped during JSON serialisation so the browser would keep the stale value.
type SessionUpdates = Partial<Pick<DashboardSession, "status" | "currentTool" | "model" | "thinkingLevel">>;

export function extractSessionUpdates(event: DashboardEvent): SessionUpdates | null {
  switch (event.eventType) {
    case "agent_start":
      return { status: "streaming", currentTool: null as any };

    case "agent_end":
      return { status: "idle", currentTool: null as any };

    case "tool_execution_start":
      return { currentTool: (event.data.toolName as string) ?? null };

    case "tool_execution_end":
      return { currentTool: null as any };

    case "model_select": {
      const model = event.data.model as { provider?: string; id?: string } | undefined;
      if (model?.provider && model?.id) {
        const updates: SessionUpdates = { model: `${model.provider}/${model.id}` };
        const thinkingLevel = event.data.thinkingLevel as string | undefined;
        if (thinkingLevel !== undefined) {
          updates.thinkingLevel = thinkingLevel;
        }
        return updates;
      }
      return null;
    }

    default:
      return null;
  }
}
