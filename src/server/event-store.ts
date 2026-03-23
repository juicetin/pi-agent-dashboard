/**
 * Event store backed by SQLite.
 * Handles event persistence with per-session sequence numbers.
 */
import type { Database } from "./db.js";
import type { DashboardEvent } from "../shared/types.js";

export interface StoredEvent {
  seq: number;
  event: DashboardEvent;
}

export interface EventStore {
  /** Insert an event, returns assigned sequence number */
  insertEvent(sessionId: string, event: DashboardEvent): number;
  /** Get events for a session starting from minSeq (inclusive) */
  getEvents(sessionId: string, minSeq: number): StoredEvent[];
  /** Get a single event by sessionId and seq */
  getEvent(sessionId: string, seq: number): DashboardEvent | undefined;
  /** Delete events older than the given timestamp */
  deleteEventsBefore(timestamp: number): number;
}

export function createEventStore(db: Database): EventStore {
  return {
    insertEvent(sessionId: string, event: DashboardEvent): number {
      // Get next seq for this session
      const row = db.raw.prepare(
        "SELECT COALESCE(MAX(seq), 0) as max_seq FROM events WHERE session_id = ?"
      ).get(sessionId) as { max_seq: number } | undefined;
      const maxSeq = row?.max_seq ?? 0;
      const nextSeq = maxSeq + 1;

      db.raw.prepare(
        "INSERT INTO events (session_id, seq, event_type, timestamp, data) VALUES (?, ?, ?, ?, ?)"
      ).run(sessionId, nextSeq, event.eventType, event.timestamp, JSON.stringify(event.data));

      return nextSeq;
    },

    getEvents(sessionId: string, minSeq: number): StoredEvent[] {
      const rows = db.raw.prepare(
        "SELECT seq, event_type, timestamp, data FROM events WHERE session_id = ? AND seq >= ? ORDER BY seq"
      ).all(sessionId, minSeq > 0 ? minSeq : 1) as Array<{
        seq: number;
        event_type: string;
        timestamp: number;
        data: string;
      }>;

      return rows.map((row) => ({
        seq: row.seq,
        event: {
          eventType: row.event_type,
          timestamp: row.timestamp,
          data: JSON.parse(row.data),
        },
      }));
    },

    getEvent(sessionId: string, seq: number): DashboardEvent | undefined {
      const row = db.raw.prepare(
        "SELECT event_type, timestamp, data FROM events WHERE session_id = ? AND seq = ?"
      ).get(sessionId, seq) as { event_type: string; timestamp: number; data: string } | undefined;

      if (!row) return undefined;

      return {
        eventType: row.event_type,
        timestamp: row.timestamp,
        data: JSON.parse(row.data),
      };
    },

    deleteEventsBefore(timestamp: number): number {
      const result = db.raw.prepare("DELETE FROM events WHERE timestamp < ?").run(timestamp);
      return result.changes;
    },
  };
}
