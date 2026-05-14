/**
 * Bridge-owned mid-turn prompt queue.
 *
 * Holds prompts that arrive while the agent is streaming, so the bridge can:
 *   1. emit them as visible queue state to the dashboard (`queue_state`),
 *   2. drain them on `agent_end` by calling `pi.sendUserMessage` one by one,
 *   3. clear them on user request via `clear_queue`.
 *
 * See change: surface-mid-turn-prompt-queue.
 */
import type { ImageContent, PendingPrompt } from "@blackbelt-technology/pi-dashboard-shared/types.js";

/**
 * A drain sink. Called once per queued entry, in insertion order, by `drain()`.
 * If the sink throws, the drain stops and the failing entry is left at the
 * head of the queue (caller can retry or drop). The sink is responsible for
 * any pi.sendUserMessage invocation.
 */
export type PromptQueueSink = (text: string, images?: ImageContent[]) => Promise<void> | void;

export class PromptQueue {
  private readonly entries: PendingPrompt[] = [];
  private counter = 0;
  private draining = false;

  constructor(private readonly sessionId: string) {}

  /** Push a new entry; returns the minted id. */
  enqueue(text: string, images?: ImageContent[]): string {
    this.counter += 1;
    const id = `bq_${this.sessionId}_${this.counter}`;
    const entry: PendingPrompt = images && images.length > 0 ? { id, text, images } : { id, text };
    this.entries.push(entry);
    return id;
  }

  /** True if no entries are queued. */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** Number of queued entries. */
  size(): number {
    return this.entries.length;
  }

  /** True if `drain()` is currently running. */
  isDraining(): boolean {
    return this.draining;
  }

  /**
   * Defensive copy of the current snapshot. Safe to send over the wire.
   * Mutating the returned array does NOT affect the queue.
   */
  snapshot(): PendingPrompt[] {
    return this.entries.map((e) => ({ ...e }));
  }

  /**
   * Drop all entries. Idempotent on already-empty queues.
   * If a drain is in progress, the next iteration will see an empty queue
   * and stop cleanly.
   */
  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Remove a single entry by id. Idempotent: returns false if no entry
   * with that id exists. Safe to call mid-drain (does not affect entries
   * already shifted off).
   */
  remove(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    return true;
  }

  /**
   * Drain the queue: for each entry (in insertion order), shift it off the
   * head and call `sink(text, images)`. `onAfterStep` (if provided) is called
   * AFTER each successful sink invocation so the caller can emit an updated
   * queue_state snapshot between entries.
   *
   * Honors mid-drain `clear()`: the next loop iteration sees an empty queue
   * and exits. Concurrent `enqueue()` during a drain is allowed and those
   * new entries WILL be drained in the same pass.
   *
   * If `sink` throws, the failing entry is restored to the head, the drain
   * stops, and the error propagates to the caller.
   */
  async drain(sink: PromptQueueSink, onAfterStep?: () => void): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.entries.length > 0) {
        const next = this.entries.shift()!;
        try {
          await sink(next.text, next.images);
        } catch (err) {
          // Put it back so the caller can decide to retry later.
          this.entries.unshift(next);
          throw err;
        }
        onAfterStep?.();
      }
    } finally {
      this.draining = false;
    }
  }
}
