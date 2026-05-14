import { describe, it, expect, vi } from "vitest";
import { PromptQueue } from "../prompt-queue.js";

describe("PromptQueue", () => {
  it("enqueues entries in insertion order with monotonic ids", () => {
    const q = new PromptQueue("s1");
    const id1 = q.enqueue("first");
    const id2 = q.enqueue("second");
    const id3 = q.enqueue("third");

    expect(id1).toBe("bq_s1_1");
    expect(id2).toBe("bq_s1_2");
    expect(id3).toBe("bq_s1_3");

    const snap = q.snapshot();
    expect(snap.map((p) => p.text)).toEqual(["first", "second", "third"]);
  });

  it("attaches images when provided, omits the field otherwise", () => {
    const q = new PromptQueue("s2");
    q.enqueue("text-only");
    q.enqueue("with-image", [{ type: "image", data: "AAAA", mimeType: "image/png" }]);

    const snap = q.snapshot();
    expect(snap[0]).toEqual({ id: "bq_s2_1", text: "text-only" });
    expect(snap[1]).toEqual({
      id: "bq_s2_2",
      text: "with-image",
      images: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
    });
  });

  it("snapshot is a defensive copy (mutation does not affect the queue)", () => {
    const q = new PromptQueue("s3");
    q.enqueue("a");
    const snap = q.snapshot();
    snap.push({ id: "fake", text: "leak" });
    snap[0].text = "mutated";

    const fresh = q.snapshot();
    expect(fresh).toHaveLength(1);
    expect(fresh[0].text).toBe("a");
  });

  it("size and isEmpty reflect queue state", () => {
    const q = new PromptQueue("s4");
    expect(q.isEmpty()).toBe(true);
    expect(q.size()).toBe(0);
    q.enqueue("x");
    expect(q.isEmpty()).toBe(false);
    expect(q.size()).toBe(1);
    q.clear();
    expect(q.isEmpty()).toBe(true);
    expect(q.size()).toBe(0);
  });

  it("clear empties immediately, idempotent on already-empty queue", () => {
    const q = new PromptQueue("s5");
    q.clear(); // no-op
    expect(q.isEmpty()).toBe(true);
    q.enqueue("a");
    q.enqueue("b");
    q.clear();
    expect(q.isEmpty()).toBe(true);
    expect(q.snapshot()).toEqual([]);
  });

  it("drain calls the sink in insertion order and runs onAfterStep between entries", async () => {
    const q = new PromptQueue("s6");
    q.enqueue("a");
    q.enqueue("b");
    q.enqueue("c");

    const sinkCalls: string[] = [];
    const stepSnapshots: number[] = [];
    const sink = vi.fn(async (text: string) => {
      sinkCalls.push(text);
    });

    await q.drain(sink, () => {
      stepSnapshots.push(q.size());
    });

    expect(sinkCalls).toEqual(["a", "b", "c"]);
    // After each step, queue size decreases: 2, 1, 0
    expect(stepSnapshots).toEqual([2, 1, 0]);
    expect(q.isEmpty()).toBe(true);
  });

  it("drain passes images through to the sink", async () => {
    const q = new PromptQueue("s7");
    q.enqueue("plain");
    q.enqueue("with-img", [{ type: "image", data: "ZZZ", mimeType: "image/jpeg" }]);

    const calls: Array<[string, unknown]> = [];
    await q.drain(async (text, images) => {
      calls.push([text, images]);
    });

    expect(calls).toEqual([
      ["plain", undefined],
      ["with-img", [{ type: "image", data: "ZZZ", mimeType: "image/jpeg" }]],
    ]);
  });

  it("drain honours mid-drain clear (next iteration sees empty queue)", async () => {
    const q = new PromptQueue("s8");
    q.enqueue("a");
    q.enqueue("b");
    q.enqueue("c");

    const sinkCalls: string[] = [];
    await q.drain(async (text) => {
      sinkCalls.push(text);
      if (text === "a") q.clear();
    });

    // Only "a" should have been delivered before the clear took effect
    expect(sinkCalls).toEqual(["a"]);
    expect(q.isEmpty()).toBe(true);
  });

  it("drain restores failing entry to the head and propagates the error", async () => {
    const q = new PromptQueue("s9");
    q.enqueue("a");
    q.enqueue("b");

    const sink = vi.fn(async (text: string) => {
      if (text === "b") throw new Error("boom");
    });

    await expect(q.drain(sink)).rejects.toThrow("boom");

    // "a" delivered, "b" restored to head
    expect(q.snapshot().map((p) => p.text)).toEqual(["b"]);
    expect(q.isDraining()).toBe(false);
  });

  it("remove(id) drops the matching entry and returns true", () => {
    const q = new PromptQueue("sR");
    const id1 = q.enqueue("a");
    const id2 = q.enqueue("b");
    const id3 = q.enqueue("c");

    expect(q.remove(id2)).toBe(true);
    expect(q.snapshot().map((p) => p.text)).toEqual(["a", "c"]);
    expect(q.size()).toBe(2);

    expect(q.remove(id1)).toBe(true);
    expect(q.snapshot().map((p) => p.text)).toEqual(["c"]);

    expect(q.remove(id3)).toBe(true);
    expect(q.isEmpty()).toBe(true);
  });

  it("remove(id) returns false and is a no-op for unknown id", () => {
    const q = new PromptQueue("sR2");
    q.enqueue("a");
    expect(q.remove("bq_missing")).toBe(false);
    expect(q.snapshot().map((p) => p.text)).toEqual(["a"]);
  });

  it("remove preserves order of remaining entries", () => {
    const q = new PromptQueue("sR3");
    const ids = ["a", "b", "c", "d"].map((t) => q.enqueue(t));
    q.remove(ids[1]); // remove "b"
    expect(q.snapshot().map((p) => p.text)).toEqual(["a", "c", "d"]);
    q.remove(ids[3]); // remove "d"
    expect(q.snapshot().map((p) => p.text)).toEqual(["a", "c"]);
  });

  it("concurrent drain calls are coalesced (second call returns immediately)", async () => {
    const q = new PromptQueue("s10");
    q.enqueue("a");
    q.enqueue("b");

    let inFlight = 0;
    let maxInFlight = 0;
    const sink = async (text: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    };

    await Promise.all([q.drain(sink), q.drain(sink)]);

    // Even with two concurrent drain() calls, only one actually runs
    expect(maxInFlight).toBe(1);
    expect(q.isEmpty()).toBe(true);
  });
});
