/**
 * Subscription message handlers: subscribe, unsubscribe.
 */
import type { WebSocket } from "ws";
import type { ServerToBrowserMessage, BrowserToServerMessage } from "../../shared/browser-protocol.js";
import type { BrowserHandlerContext } from "./handler-context.js";
import { extractStatsFromEvents } from "../event-status-extraction.js";
import type { StoredEvent } from "../memory-event-store.js";

const REPLAY_BATCH_SIZE = 50;
/** Max events to replay per session subscription (limits memory spikes) */
const MAX_REPLAY_EVENTS = 500;
/** Max buffered bytes before pausing replay sends (1MB) */
const BACKPRESSURE_THRESHOLD = 1_024 * 1_024;

/**
 * Send stored events to a WebSocket in batches with backpressure handling.
 * Yields between batches to let the event loop flush data and avoid OOM.
 */
async function sendEventBatches(
  ws: WebSocket,
  sessionId: string,
  stored: StoredEvent[],
  sendTo: (ws: WebSocket, msg: ServerToBrowserMessage) => void,
): Promise<void> {
  for (let i = 0; i < stored.length; i += REPLAY_BATCH_SIZE) {
    if (ws.readyState !== ws.OPEN) return;
    const batch = stored.slice(i, i + REPLAY_BATCH_SIZE);
    sendTo(ws, {
      type: "event_replay",
      sessionId,
      events: batch.map((e) => ({ seq: e.seq, event: e.event })),
      isLast: i + REPLAY_BATCH_SIZE >= stored.length,
    });
    // Yield to event loop between batches to allow GC and buffer flushing
    if (ws.bufferedAmount > BACKPRESSURE_THRESHOLD) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (ws.readyState !== ws.OPEN || ws.bufferedAmount < BACKPRESSURE_THRESHOLD) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        setTimeout(check, 10);
      });
    } else {
      await new Promise<void>((r) => setImmediate(r));
    }
  }
}

export function handleSubscribe(
  msg: Extract<BrowserToServerMessage, { type: "subscribe" }>,
  subs: Set<string>,
  ctx: BrowserHandlerContext,
): void {
  const { ws, sessionManager, eventStore, directoryService, sendTo, broadcast, getSubscribers, replayPendingUiRequests } = ctx;
  subs.add(msg.sessionId);

  if (eventStore.hasEvents(msg.sessionId)) {
    let events = eventStore.getEvents(msg.sessionId, (msg.lastSeq ?? 0) + 1);
    // Limit replay size to avoid memory spikes from serializing too many events
    if (events.length > MAX_REPLAY_EVENTS) {
      events = events.slice(events.length - MAX_REPLAY_EVENTS);
    }
    sendEventBatches(ws, msg.sessionId, events, sendTo).then(() => {
      replayPendingUiRequests(ws, msg.sessionId);
    });
  } else if (directoryService) {
    const session = sessionManager.get(msg.sessionId);
    if (session?.sessionFile) {
      sendTo(ws, {
        type: "event_replay",
        sessionId: msg.sessionId,
        events: [],
        isLast: false,
      });
      directoryService.loadSessionEvents(msg.sessionId, session.sessionFile).then(async (result) => {
        if (result.success) {
          for (const evt of result.events) {
            eventStore.insertEvent(msg.sessionId, evt);
          }
          const statsUpdates = extractStatsFromEvents(result.events);
          const metaUpdates: Record<string, unknown> = { dataUnavailable: false, ...statsUpdates };
          sessionManager.update(msg.sessionId, metaUpdates);
          broadcast({ type: "session_updated", sessionId: msg.sessionId, updates: metaUpdates });
          let stored = eventStore.getEvents(msg.sessionId, 1);
          if (stored.length > MAX_REPLAY_EVENTS) {
            stored = stored.slice(stored.length - MAX_REPLAY_EVENTS);
          }
          const subscribers = getSubscribers(msg.sessionId);
          for (const sub of subscribers) {
            await sendEventBatches(sub, msg.sessionId, stored, sendTo);
            replayPendingUiRequests(sub, msg.sessionId);
          }
        } else {
          sendTo(ws, { type: "event_replay", sessionId: msg.sessionId, events: [], isLast: true });
          sessionManager.update(msg.sessionId, { dataUnavailable: true });
          broadcast({ type: "session_updated", sessionId: msg.sessionId, updates: { dataUnavailable: true } });
        }
      }).catch(() => {
        sendTo(ws, { type: "event_replay", sessionId: msg.sessionId, events: [], isLast: true });
        sessionManager.update(msg.sessionId, { dataUnavailable: true });
        broadcast({ type: "session_updated", sessionId: msg.sessionId, updates: { dataUnavailable: true } });
      });
    } else {
      sendTo(ws, { type: "event_replay", sessionId: msg.sessionId, events: [], isLast: true });
      if (session) {
        sessionManager.update(msg.sessionId, { dataUnavailable: true });
        broadcast({ type: "session_updated", sessionId: msg.sessionId, updates: { dataUnavailable: true } });
      }
    }
  } else {
    sendTo(ws, { type: "event_replay", sessionId: msg.sessionId, events: [], isLast: true });
  }
}
