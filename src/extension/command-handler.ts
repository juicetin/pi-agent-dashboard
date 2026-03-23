/**
 * Handles server→extension messages by dispatching to pi API.
 */
import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type {
  ServerToExtensionMessage,
  ExtensionToServerMessage,
} from "../shared/protocol.js";
import type { FileEntry } from "../shared/types.js";

/** Escape regex special characters for fd pattern */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Search files using fd */
function searchFiles(cwd: string, query: string): FileEntry[] {
  const args = [
    "--base-directory", cwd,
    "--max-results", "20",
    "--type", "f",
    "--type", "d",
    "--full-path",
    "--hidden",
    "--exclude", ".git",
  ];

  if (query) {
    args.push(escapeRegex(query));
  }

  try {
    const result = spawnSync("fd", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });

    if (result.status !== 0 || !result.stdout) {
      return [];
    }

    return result.stdout.trim().split("\n").filter(Boolean).map((line) => {
      const normalized = line.replace(/\\/g, "/");
      const isDirectory = normalized.endsWith("/");
      return { path: normalized, isDirectory };
    });
  } catch {
    return [];
  }
}

export interface CommandHandler {
  handle(msg: ServerToExtensionMessage): ExtensionToServerMessage | undefined;
}

export function createCommandHandler(
  pi: ExtensionAPI,
  sessionId: string,
): CommandHandler {
  return {
    handle(msg: ServerToExtensionMessage): ExtensionToServerMessage | undefined {
      // Ignore messages for other sessions
      if (msg.sessionId !== sessionId) return undefined;

      switch (msg.type) {
        case "send_prompt":
          if (msg.images && msg.images.length > 0) {
            pi.sendUserMessage([
              { type: "text", text: msg.text },
              ...msg.images,
            ]);
          } else {
            pi.sendUserMessage(msg.text);
          }
          return undefined;

        case "abort":
          // ctx.abort() is not available on ExtensionAPI directly,
          // we'd need ctx from an event handler. For now, this is a placeholder.
          return undefined;

        case "request_commands": {
          const commands = pi.getCommands();
          return {
            type: "commands_list",
            sessionId,
            commands,
          };
        }

        case "list_files": {
          const files = searchFiles(process.cwd(), msg.query);
          return {
            type: "files_list",
            sessionId,
            query: msg.query,
            files,
          };
        }

        case "request_state_sync":
          // State sync is handled by the bridge on reconnect
          return undefined;

        default:
          return undefined;
      }
    },
  };
}
