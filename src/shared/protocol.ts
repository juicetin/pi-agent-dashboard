/**
 * Extension ↔ Server WebSocket protocol messages.
 */
import type { DashboardEvent, CommandInfo, SessionSource, ImageContent, FileEntry, TurnUsage, ContextUsage } from "./types.js";

// ── Extension → Server ──────────────────────────────────────────────

export interface SessionRegisterMessage {
  type: "session_register";
  sessionId: string;
  cwd: string;
  source: SessionSource;
  model?: string;
  thinkingLevel?: string;
}

export interface SessionUnregisterMessage {
  type: "session_unregister";
  sessionId: string;
}

export interface SessionHeartbeatMessage {
  type: "session_heartbeat";
  sessionId: string;
}

export interface EventForwardMessage {
  type: "event_forward";
  sessionId: string;
  event: DashboardEvent;
}

export interface CommandsListMessage {
  type: "commands_list";
  sessionId: string;
  commands: CommandInfo[];
}

export interface ExtensionUiEventMessage {
  type: "extension_ui_event";
  sessionId: string;
  uiEvent: Record<string, unknown>;
}

export interface StatsUpdateMessage {
  type: "stats_update";
  sessionId: string;
  stats: {
    tokensIn: number;
    tokensOut: number;
    cost: number;
    turnUsage?: TurnUsage;
    contextUsage?: ContextUsage;
  };
}

export interface FilesListMessage {
  type: "files_list";
  sessionId: string;
  query: string;
  files: FileEntry[];
}

export interface GitInfoUpdateMessage {
  type: "git_info_update";
  sessionId: string;
  gitBranch: string;
  gitBranchUrl?: string;
  gitPrNumber?: number;
  gitPrUrl?: string;
}

export type ExtensionToServerMessage =
  | SessionRegisterMessage
  | SessionUnregisterMessage
  | SessionHeartbeatMessage
  | EventForwardMessage
  | CommandsListMessage
  | ExtensionUiEventMessage
  | StatsUpdateMessage
  | FilesListMessage
  | GitInfoUpdateMessage;

// ── Server → Extension ──────────────────────────────────────────────

export interface SendPromptToExtensionMessage {
  type: "send_prompt";
  sessionId: string;
  text: string;
  images?: ImageContent[];
}

export interface AbortToExtensionMessage {
  type: "abort";
  sessionId: string;
}

export interface RequestCommandsMessage {
  type: "request_commands";
  sessionId: string;
}

export interface RequestStateSyncMessage {
  type: "request_state_sync";
  sessionId: string;
}

export interface ListFilesMessage {
  type: "list_files";
  sessionId: string;
  query: string;
}

export type ServerToExtensionMessage =
  | SendPromptToExtensionMessage
  | AbortToExtensionMessage
  | RequestCommandsMessage
  | RequestStateSyncMessage
  | ListFilesMessage;
