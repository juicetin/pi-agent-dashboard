/**
 * Pi Gateway - WebSocket server for bridge extension connections.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { ExtensionToServerMessage, ServerToExtensionMessage } from "../shared/protocol.js";
import type { SessionManager } from "./session-manager.js";

const HEARTBEAT_TIMEOUT = 45_000;

export interface PiGateway {
  start(port: number): void;
  stop(): void;
  sendToSession(sessionId: string, msg: ServerToExtensionMessage): boolean;
  onEvent?: (sessionId: string, msg: ExtensionToServerMessage) => void;
  onEmpty?: () => void;
  onConnection?: () => void;
}

export function createPiGateway(
  sessionManager: SessionManager,
): PiGateway {
  let wss: WebSocketServer | null = null;

  // Map sessionId → WebSocket
  const connections = new Map<string, WebSocket>();
  // Map sessionId → heartbeat timeout
  const heartbeatTimers = new Map<string, ReturnType<typeof setTimeout>>();

  let onEvent: ((sessionId: string, msg: ExtensionToServerMessage) => void) | undefined;
  let onEmpty: (() => void) | undefined;
  let onConnection: (() => void) | undefined;

  function checkEmpty() {
    if (connections.size === 0) {
      onEmpty?.();
    }
  }

  function resetHeartbeat(sessionId: string) {
    const existing = heartbeatTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    heartbeatTimers.set(
      sessionId,
      setTimeout(() => {
        sessionManager.unregister(sessionId);
        connections.delete(sessionId);
        heartbeatTimers.delete(sessionId);
        checkEmpty();
      }, HEARTBEAT_TIMEOUT)
    );
  }

  return {
    set onEvent(handler: ((sessionId: string, msg: ExtensionToServerMessage) => void) | undefined) {
      onEvent = handler;
    },

    set onEmpty(handler: (() => void) | undefined) {
      onEmpty = handler;
    },

    set onConnection(handler: (() => void) | undefined) {
      onConnection = handler;
    },

    start(port: number) {
      wss = new WebSocketServer({ port });

      wss.on("connection", (ws) => {
        let currentSessionId: string | null = null;

        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString()) as ExtensionToServerMessage;

            if (msg.type === "session_register") {
              currentSessionId = msg.sessionId;
              connections.set(msg.sessionId, ws);

              sessionManager.register({
                id: msg.sessionId,
                cwd: msg.cwd,
                source: msg.source,
                model: msg.model,
                thinkingLevel: msg.thinkingLevel,
              });

              resetHeartbeat(msg.sessionId);
              onConnection?.();
            }

            if (msg.type === "session_heartbeat" && msg.sessionId) {
              resetHeartbeat(msg.sessionId);
            }

            if (msg.type === "session_unregister" && msg.sessionId) {
              sessionManager.unregister(msg.sessionId);
              connections.delete(msg.sessionId);
              const timer = heartbeatTimers.get(msg.sessionId);
              if (timer) {
                clearTimeout(timer);
                heartbeatTimers.delete(msg.sessionId);
              }
              checkEmpty();
            }

            if (msg.type === "stats_update") {
              const session = sessionManager.get(msg.sessionId);
              if (session) {
                sessionManager.update(msg.sessionId, {
                  tokensIn: (session.tokensIn ?? 0) + (msg.stats.tokensIn ?? 0),
                  tokensOut: (session.tokensOut ?? 0) + (msg.stats.tokensOut ?? 0),
                  cacheRead: (session.cacheRead ?? 0) + (msg.stats.turnUsage?.cacheRead ?? 0),
                  cacheWrite: (session.cacheWrite ?? 0) + (msg.stats.turnUsage?.cacheWrite ?? 0),
                  cost: (session.cost ?? 0) + (msg.stats.cost ?? 0),
                });
              }
            }

            // Notify listeners
            onEvent?.(msg.sessionId ?? currentSessionId ?? "", msg);
          } catch {
            // Ignore malformed messages
          }
        });

        ws.on("close", () => {
          if (currentSessionId) {
            // Don't immediately unregister - wait for heartbeat timeout
            // This handles temporary disconnects
          }
        });
      });
    },

    stop() {
      for (const timer of heartbeatTimers.values()) {
        clearTimeout(timer);
      }
      heartbeatTimers.clear();
      // Forcibly terminate all extension connections
      for (const ws of connections.values()) {
        ws.terminate();
      }
      connections.clear();
      wss?.close();
      wss = null;
    },

    sendToSession(sessionId: string, msg: ServerToExtensionMessage): boolean {
      const ws = connections.get(sessionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        return true;
      }
      return false;
    },
  };
}
