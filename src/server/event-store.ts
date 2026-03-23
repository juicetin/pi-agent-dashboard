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
      const result = db.raw.exec(
        "SELECT COALESCE(MAX(seq), 0) as max_seq FROM events WHERE session_id = ?",
        [sessionId]
      );
      const maxSeq = result.length > 0 ? (result[0].values[0][0] as number) : 0;
      const nextSeq = maxSeq + 1;

      db.raw.run(
        "INSERT INTO events (session_id, seq, event_type, timestamp, data) VALUES (?, ?, ?, ?, ?)",
        [
          sessionId,
          nextSeq,
          event.eventType,
          event.timestamp,
          JSON.stringify(event.data),
        ]
      );

      return nextSeq;
    },

    getEvents(sessionId: string, minSeq: number): StoredEvent[] {
      const result = db.raw.exec(
        "SELECT seq, event_type, timestamp, data FROM events WHERE session_id = ? AND seq >= ? ORDER BY seq",
        [sessionId, minSeq > 0 ? minSeq : 1]
      );

      if (result.length === 0) return [];

      return result[0].values.map((row) => ({
        seq: row[0] as number,
        event: {
          eventType: row[1] as string,
          timestamp: row[2] as number,
          data: JSON.parse(row[3] as string),
        },
      }));
    },

    getEvent(sessionId: string, seq: number): DashboardEvent | undefined {
      const result = db.raw.exec(
        "SELECT event_type, timestamp, data FROM events WHERE session_id = ? AND seq = ?",
        [sessionId, seq]
      );

      if (result.length === 0 || result[0].values.length === 0) return undefined;

      const row = result[0].values[0];
      return {
        eventType: row[0] as string,
        timestamp: row[1] as number,
        data: JSON.parse(row[2] as string),
      };
    },

    deleteEventsBefore(timestamp: number): number {
      db.raw.run("DELETE FROM events WHERE timestamp < ?", [timestamp]);
      // sql.js doesn't have changes() easily, return 0
      return 0;
    },
  };
}
