import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabaseAsync, type Database } from "../db.js";
import { createEventStore, type EventStore } from "../event-store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Event Retention", () => {
  let db: Database;
  let store: EventStore;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-retention-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    store = createEventStore(db);

    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at) VALUES (?, ?, ?, ?, ?)",
      ["s1", "/project", "tui", "active", Date.now()]
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should delete events older than retention period", () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const recentTimestamp = Date.now();

    // Insert old events
    store.insertEvent("s1", {
      eventType: "old_event",
      timestamp: thirtyOneDaysAgo,
      data: {},
    });
    store.insertEvent("s1", {
      eventType: "old_event_2",
      timestamp: thirtyOneDaysAgo - 1000,
      data: {},
    });

    // Insert recent events
    store.insertEvent("s1", {
      eventType: "recent_event",
      timestamp: recentTimestamp,
      data: {},
    });

    // Delete events older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    store.deleteEventsBefore(cutoff);

    const remaining = store.getEvents("s1", 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].event.eventType).toBe("recent_event");
  });
});
