/**
 * Browser Gateway - WebSocket handler for browser client connections.
 * Runs on the HTTP server port via upgrade handling.
 */
import { WebSocketServer, WebSocket } from "ws";
import type {
  ServerToBrowserMessage,
  BrowserToServerMessage,
} from "../shared/browser-protocol.js";
import type { SessionManager } from "./session-manager.js";
import type { EventStore } from "./event-store.js";
import type { PiGateway } from "./pi-gateway.js";

const REPLAY_BATCH_SIZE = 200;

export interface BrowserGateway {
  wss: WebSocketServer;
  broadcastEvent(sessionId: string, seq: number, event: any): void;
  broadcastSessionAdded(session: any): void;
  broadcastSessionUpdated(sessionId: string, updates: any): void;
  broadcastSessionRemoved(sessionId: string): void;
  sendToSubscribers(sessionId: string, msg: ServerToBrowserMessage): void;
}

export function createBrowserGateway(
  sessionManager: SessionManager,
  eventStore: EventStore,
  piGateway: PiGateway,
): BrowserGateway {
  const wss = new WebSocketServer({ noServer: true });

  // Track subscriptions: ws → Set<sessionId>
  const subscriptions = new Map<WebSocket, Set<string>>();

  function getSubscribers(sessionId: string): WebSocket[] {
    const result: WebSocket[] = [];
    for (const [ws, subs] of subscriptions) {
      if (subs.has(sessionId) && ws.readyState === WebSocket.OPEN) {
        result.push(ws);
      }
    }
    return result;
  }

  function sendTo(ws: WebSocket, msg: ServerToBrowserMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcast(msg: ServerToBrowserMessage) {
    for (const [ws] of subscriptions) {
      sendTo(ws, msg);
    }
  }

  wss.on("connection", (ws) => {
    const subs = new Set<string>();
    subscriptions.set(ws, subs);

    // Send current sessions on connect
    const activeSessions = sessionManager.listActive();
    for (const session of activeSessions) {
      sendTo(ws, { type: "session_added", session });
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as BrowserToServerMessage;

        switch (msg.type) {
          case "subscribe": {
            subs.add(msg.sessionId);
            // Replay events from lastSeq
            const events = eventStore.getEvents(msg.sessionId, (msg.lastSeq ?? 0) + 1);
            for (let i = 0; i < events.length; i += REPLAY_BATCH_SIZE) {
              const batch = events.slice(i, i + REPLAY_BATCH_SIZE);
              sendTo(ws, {
                type: "event_replay",
                sessionId: msg.sessionId,
                events: batch.map((e) => ({ seq: e.seq, event: e.event })),
                isLast: i + REPLAY_BATCH_SIZE >= events.length,
              });
            }
            break;
          }

          case "unsubscribe":
            subs.delete(msg.sessionId);
            break;

          case "send_prompt":
            piGateway.sendToSession(msg.sessionId, {
              type: "send_prompt",
              sessionId: msg.sessionId,
              text: msg.text,
              images: msg.images,
            });
            break;

          case "abort":
            piGateway.sendToSession(msg.sessionId, {
              type: "abort",
              sessionId: msg.sessionId,
            });
            break;

          case "request_commands":
            piGateway.sendToSession(msg.sessionId, {
              type: "request_commands",
              sessionId: msg.sessionId,
            });
            break;

          case "list_files":
            piGateway.sendToSession(msg.sessionId, {
              type: "list_files",
              sessionId: msg.sessionId,
              query: msg.query,
            });
            break;

          case "fetch_content": {
            const event = eventStore.getEvent(msg.sessionId, msg.seq);
            if (event) {
              sendTo(ws, {
                type: "event",
                sessionId: msg.sessionId,
                seq: msg.seq,
                event,
              });
            }
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      subscriptions.delete(ws);
    });
  });

  return {
    wss,

    broadcastEvent(sessionId: string, seq: number, event: any) {
      const subscribers = getSubscribers(sessionId);
      const msg: ServerToBrowserMessage = {
        type: "event",
        sessionId,
        seq,
        event,
      };
      for (const ws of subscribers) {
        sendTo(ws, msg);
      }
    },

    broadcastSessionAdded(session: any) {
      broadcast({ type: "session_added", session });
    },

    broadcastSessionUpdated(sessionId: string, updates: any) {
      broadcast({ type: "session_updated", sessionId, updates });
    },

    broadcastSessionRemoved(sessionId: string) {
      broadcast({ type: "session_removed", sessionId });
    },

    sendToSubscribers(sessionId: string, msg: ServerToBrowserMessage) {
      const subscribers = getSubscribers(sessionId);
      for (const ws of subscribers) {
        sendTo(ws, msg);
      }
    },
  };
}
