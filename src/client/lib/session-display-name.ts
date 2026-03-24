import type { DashboardSession } from "../../shared/types.js";

/** Get display name for a session: custom name if set, otherwise last segment of cwd */
export function getSessionDisplayName(session: DashboardSession): string {
  if (session.name && session.name.trim()) {
    return session.name.trim();
  }
  return session.cwd.split("/").pop() || session.id.slice(0, 8);
}
