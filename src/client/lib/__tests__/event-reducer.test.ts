import { describe, it, expect } from "vitest";
import { createInitialState, reduceEvent, type SessionState } from "../event-reducer.js";
import type { DashboardEvent } from "../../../shared/types.js";

function applyEvents(events: DashboardEvent[]): SessionState {
  return events.reduce(reduceEvent, createInitialState());
}

describe("eventReducer", () => {
  it("should start with empty state", () => {
    const state = createInitialState();
    expect(state.messages).toHaveLength(0);
    expect(state.isStreaming).toBe(false);
    expect(state.status).toBe("idle");
  });

  it("should add user messages from message_start", () => {
    const state = applyEvents([
      {
        eventType: "message_start",
        timestamp: Date.now(),
        data: {
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
          },
        },
      },
    ]);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe("user");
    expect(state.messages[0].content).toBe("Hello");
  });

  it("should track streaming text from message_update", () => {
    const state = applyEvents([
      {
        eventType: "agent_start",
        timestamp: Date.now(),
        data: {},
      },
      {
        eventType: "message_update",
        timestamp: Date.now(),
        data: {
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello world" }],
          },
        },
      },
    ]);

    expect(state.isStreaming).toBe(true);
    expect(state.streamingText).toBe("Hello world");
  });

  it("should finalize assistant message on message_end", () => {
    const state = applyEvents([
      {
        eventType: "agent_start",
        timestamp: Date.now(),
        data: {},
      },
      {
        eventType: "message_update",
        timestamp: Date.now(),
        data: {
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Final answer" }],
          },
        },
      },
      {
        eventType: "message_end",
        timestamp: Date.now(),
        data: {
          message: { role: "assistant" },
        },
      },
    ]);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe("assistant");
    expect(state.messages[0].content).toBe("Final answer");
    expect(state.streamingText).toBe("");
  });

  it("should add tool message to messages[] on tool_execution_start with status running and args", () => {
    const state = applyEvents([
      {
        eventType: "tool_execution_start",
        timestamp: Date.now(),
        data: {
          toolCallId: "tc1",
          toolName: "bash",
          args: { command: "ls" },
        },
      },
    ]);

    // toolCalls Map still works
    expect(state.toolCalls.get("tc1")).toBeDefined();
    expect(state.toolCalls.get("tc1")!.toolName).toBe("bash");
    expect(state.toolCalls.get("tc1")!.status).toBe("running");
    expect(state.currentTool).toBe("bash");

    // Message added immediately on start
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe("tool-tc1");
    expect(state.messages[0].role).toBe("toolResult");
    expect(state.messages[0].toolName).toBe("bash");
    expect(state.messages[0].toolStatus).toBe("running");
    expect(state.messages[0].args).toEqual({ command: "ls" });
  });

  it("should update existing tool message result on tool_execution_update", () => {
    const state = applyEvents([
      {
        eventType: "tool_execution_start",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "bash", args: { command: "ls" } },
      },
      {
        eventType: "tool_execution_update",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "bash", partialResult: "file1.ts\nfile2.ts" },
      },
    ]);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].result).toBe("file1.ts\nfile2.ts");
    expect(state.messages[0].toolStatus).toBe("running");
  });

  it("should update existing tool message in-place on tool_execution_end (no duplicate)", () => {
    const state = applyEvents([
      {
        eventType: "tool_execution_start",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "read", args: { path: "file.ts" } },
      },
      {
        eventType: "tool_execution_end",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "read", isError: false, result: "file content here" },
      },
    ]);

    expect(state.toolCalls.get("tc1")!.status).toBe("complete");
    expect(state.currentTool).toBeUndefined();
    // Only 1 message (updated in-place, not duplicated)
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe("toolResult");
    expect(state.messages[0].toolName).toBe("read");
    expect(state.messages[0].toolStatus).toBe("complete");
    expect(state.messages[0].result).toBe("file content here");
    expect(state.messages[0].args).toEqual({ path: "file.ts" });
  });

  it("should truncate tool result to 30 lines", () => {
    const longResult = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n");
    const state = applyEvents([
      {
        eventType: "tool_execution_start",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "bash", args: { command: "cat bigfile" } },
      },
      {
        eventType: "tool_execution_end",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "bash", isError: false, result: longResult },
      },
    ]);

    const lines = state.messages[0].result!.split("\n");
    expect(lines.length).toBeLessThanOrEqual(30);
  });

  it("should truncate partial result to 30 lines on tool_execution_update", () => {
    const longResult = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n");
    const state = applyEvents([
      {
        eventType: "tool_execution_start",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "bash", args: { command: "cat bigfile" } },
      },
      {
        eventType: "tool_execution_update",
        timestamp: Date.now(),
        data: { toolCallId: "tc1", toolName: "bash", partialResult: longResult },
      },
    ]);

    const lines = state.messages[0].result!.split("\n");
    expect(lines.length).toBeLessThanOrEqual(30);
  });

  it("should set status to idle on agent_end", () => {
    const state = applyEvents([
      { eventType: "agent_start", timestamp: Date.now(), data: {} },
      { eventType: "agent_end", timestamp: Date.now(), data: { messages: [] } },
    ]);

    expect(state.status).toBe("idle");
    expect(state.isStreaming).toBe(false);
  });

  it("should handle a full conversation sequence", () => {
    const now = Date.now();
    const state = applyEvents([
      // User message
      {
        eventType: "message_start",
        timestamp: now,
        data: { message: { role: "user", content: [{ type: "text", text: "Fix the bug" }] } },
      },
      // Agent starts
      { eventType: "agent_start", timestamp: now + 1, data: {} },
      // Assistant streams
      {
        eventType: "message_update",
        timestamp: now + 2,
        data: { message: { role: "assistant", content: [{ type: "text", text: "I'll fix it" }] } },
      },
      // Tool call
      {
        eventType: "tool_execution_start",
        timestamp: now + 3,
        data: { toolCallId: "tc1", toolName: "edit", args: {} },
      },
      {
        eventType: "tool_execution_end",
        timestamp: now + 4,
        data: { toolCallId: "tc1", toolName: "edit", isError: false },
      },
      // Message finalized
      {
        eventType: "message_end",
        timestamp: now + 5,
        data: { message: { role: "assistant" } },
      },
      // Agent ends
      { eventType: "agent_end", timestamp: now + 6, data: { messages: [] } },
    ]);

    expect(state.messages).toHaveLength(3); // user + tool (added on start, updated on end) + assistant
    expect(state.status).toBe("idle");
  });

  it("should accumulate tokens and cost from stats_update", () => {
    const state = applyEvents([
      {
        eventType: "stats_update",
        timestamp: Date.now(),
        data: {
          tokensIn: 1000,
          tokensOut: 500,
          cost: 0.01,
        },
      },
      {
        eventType: "stats_update",
        timestamp: Date.now(),
        data: {
          tokensIn: 800,
          tokensOut: 300,
          cost: 0.005,
        },
      },
    ]);

    expect(state.tokensIn).toBe(1800);
    expect(state.tokensOut).toBe(800);
    expect(state.cost).toBeCloseTo(0.015);
  });

  it("should populate turnStats from stats_update with turnUsage", () => {
    const state = applyEvents([
      {
        eventType: "stats_update",
        timestamp: Date.now(),
        data: {
          tokensIn: 1000,
          tokensOut: 500,
          cost: 0.01,
          turnUsage: {
            input: 1000,
            output: 500,
            cacheRead: 200,
            cacheWrite: 100,
          },
        },
      },
    ]);

    expect(state.turnStats).toHaveLength(1);
    expect(state.turnStats[0]).toEqual({
      input: 1000,
      output: 500,
      cacheRead: 200,
      cacheWrite: 100,
    });
  });

  it("should populate contextUsage from stats_update", () => {
    const state = applyEvents([
      {
        eventType: "stats_update",
        timestamp: Date.now(),
        data: {
          tokensIn: 1000,
          tokensOut: 500,
          cost: 0.01,
          contextUsage: { tokens: 19100, contextWindow: 256000 },
        },
      },
    ]);

    expect(state.contextUsage).toEqual({ tokens: 19100, contextWindow: 256000 });
  });

  it("should cap turnStats at 50 entries", () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      eventType: "stats_update" as const,
      timestamp: Date.now() + i,
      data: {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.001,
        turnUsage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 },
      },
    }));

    const state = applyEvents(events);
    expect(state.turnStats).toHaveLength(50);
  });

  it("should handle stats_update without turnUsage gracefully", () => {
    const state = applyEvents([
      {
        eventType: "stats_update",
        timestamp: Date.now(),
        data: { tokensIn: 500, tokensOut: 200, cost: 0.005 },
      },
    ]);

    expect(state.turnStats).toHaveLength(0);
    expect(state.tokensIn).toBe(500);
    expect(state.tokensOut).toBe(200);
  });
});
