import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabaseAsync, type Database } from "../db.js";
import { createEventStore, type EventStore } from "../event-store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("EventStore", () => {
  let db: Database;
  let store: EventStore;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-events-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    store = createEventStore(db);

    // Create a test session
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at) VALUES (?, ?, ?, ?, ?)",
      ["s1", "/project", "tui", "active", Date.now()]
    );
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at) VALUES (?, ?, ?, ?, ?)",
      ["s2", "/other", "zed", "active", Date.now()]
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should insert events with auto-assigned sequence numbers", () => {
    const seq1 = store.insertEvent("s1", {
      eventType: "message_start",
      timestamp: Date.now(),
      data: { role: "user" },
    });
    const seq2 = store.insertEvent("s1", {
      eventType: "message_end",
      timestamp: Date.now(),
      data: { role: "user" },
    });

    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
  });

  it("should assign independent sequences per session", () => {
    const s1seq1 = store.insertEvent("s1", {
      eventType: "agent_start",
      timestamp: Date.now(),
      data: {},
    });
    const s2seq1 = store.insertEvent("s2", {
      eventType: "agent_start",
      timestamp: Date.now(),
      data: {},
    });
    const s1seq2 = store.insertEvent("s1", {
      eventType: "agent_end",
      timestamp: Date.now(),
      data: {},
    });

    expect(s1seq1).toBe(1);
    expect(s2seq1).toBe(1);
    expect(s1seq2).toBe(2);
  });

  it("should query events by session and seq range", () => {
    for (let i = 0; i < 5; i++) {
      store.insertEvent("s1", {
        eventType: `event_${i}`,
        timestamp: Date.now(),
        data: { index: i },
      });
    }

    const events = store.getEvents("s1", 3);
    expect(events).toHaveLength(3);
    expect(events[0].seq).toBe(3);
    expect(events[2].seq).toBe(5);
  });

  it("should fetch single event by sessionId and seq", () => {
    store.insertEvent("s1", {
      eventType: "test_event",
      timestamp: 1234567890,
      data: { hello: "world" },
    });

    const event = store.getEvent("s1", 1);
    expect(event).toBeDefined();
    expect(event!.eventType).toBe("test_event");
    expect(event!.data.hello).toBe("world");
  });

  it("should return undefined for non-existent event", () => {
    const event = store.getEvent("s1", 999);
    expect(event).toBeUndefined();
  });

  it("should return all events when minSeq is 0", () => {
    store.insertEvent("s1", {
      eventType: "e1",
      timestamp: Date.now(),
      data: {},
    });
    store.insertEvent("s1", {
      eventType: "e2",
      timestamp: Date.now(),
      data: {},
    });

    const events = store.getEvents("s1", 0);
    expect(events).toHaveLength(2);
  });
});
