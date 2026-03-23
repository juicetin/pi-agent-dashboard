/**
 * REST API endpoint types.
 */
import type {
  Workspace,
  DashboardSession,
  DashboardEvent,
  ApiResponse,
} from "./types.js";

// ── Workspace CRUD ──────────────────────────────────────────────────

export interface CreateWorkspaceRequest {
  path: string;
  name?: string;
}

export type CreateWorkspaceResponse = ApiResponse<Workspace>;

export interface UpdateWorkspaceRequest {
  name?: string;
  sortOrder?: number;
}

export type UpdateWorkspaceResponse = ApiResponse<Workspace>;
export type DeleteWorkspaceResponse = ApiResponse<void>;
export type ListWorkspacesResponse = ApiResponse<Workspace[]>;

// ── Sessions ────────────────────────────────────────────────────────

export interface ListSessionsQuery {
  workspaceId?: string;
  status?: "active" | "ended";
}

export type ListSessionsResponse = ApiResponse<DashboardSession[]>;

// ── Events ──────────────────────────────────────────────────────────

export type FetchEventContentResponse = ApiResponse<DashboardEvent>;

// ── Session Spawn ───────────────────────────────────────────────────

export interface SpawnSessionRequest {
  workspaceId: string;
}

export type SpawnSessionResponse = ApiResponse<{ message: string }>;

// ── Aggregate Stats ─────────────────────────────────────────────────

export interface AggregateStats {
  activeSessions: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

export type AggregateStatsResponse = ApiResponse<AggregateStats>;
