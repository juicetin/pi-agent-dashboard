import { describe, it, expect, vi } from "vitest";
import { createCommandHandler } from "../command-handler.js";
import type { ServerToExtensionMessage } from "../../shared/protocol.js";

describe("CommandHandler", () => {
  function createMockPi() {
    return {
      sendUserMessage: vi.fn(),
      getCommands: vi.fn().mockReturnValue([
        { name: "test", description: "Test cmd", source: "extension" as const },
      ]),
      on: vi.fn(),
    };
  }

  it("should call sendUserMessage on send_prompt when idle", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    const msg: ServerToExtensionMessage = {
      type: "send_prompt",
      sessionId: "s1",
      text: "Hello agent",
    };

    handler.handle(msg);

    expect(pi.sendUserMessage).toHaveBeenCalledWith("Hello agent");
  });

  it("should ignore messages for different sessionIds", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    const msg: ServerToExtensionMessage = {
      type: "send_prompt",
      sessionId: "s2",
      text: "Hello",
    };

    handler.handle(msg);
    expect(pi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("should send images with valid mimeType via sendUserMessage", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    handler.handle({
      type: "send_prompt",
      sessionId: "s1",
      text: "check this",
      images: [
        { type: "image", data: "abc123", mimeType: "image/png" },
      ],
    });

    expect(pi.sendUserMessage).toHaveBeenCalledWith([
      { type: "text", text: "check this" },
      { type: "image", data: "abc123", mimeType: "image/png" },
    ]);
  });

  it("should drop images with invalid mimeType and send text only", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    handler.handle({
      type: "send_prompt",
      sessionId: "s1",
      text: "check this",
      images: [
        { type: "image", data: "abc123", mimeType: "image/bmp" },
      ],
    });

    // Invalid mimeType → dropped, sends text only
    expect(pi.sendUserMessage).toHaveBeenCalledWith("check this");
  });

  it("should drop images with undefined or null mimeType", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    handler.handle({
      type: "send_prompt",
      sessionId: "s1",
      text: "check this",
      images: [
        { type: "image", data: "abc123", mimeType: undefined as any },
        { type: "image", data: "abc123", mimeType: null as any },
      ],
    });

    expect(pi.sendUserMessage).toHaveBeenCalledWith("check this");
  });

  it("should drop images with empty or non-string data", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    handler.handle({
      type: "send_prompt",
      sessionId: "s1",
      text: "check this",
      images: [
        { type: "image", data: "", mimeType: "image/png" },
      ],
    });

    expect(pi.sendUserMessage).toHaveBeenCalledWith("check this");
  });

  it("should drop non-object image entries", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    handler.handle({
      type: "send_prompt",
      sessionId: "s1",
      text: "check this",
      images: [null as any, "bad" as any],
    });

    expect(pi.sendUserMessage).toHaveBeenCalledWith("check this");
  });

  it("should keep valid images and drop invalid ones", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    handler.handle({
      type: "send_prompt",
      sessionId: "s1",
      text: "check this",
      images: [
        { type: "image", data: "good", mimeType: "image/jpeg" },
        { type: "image", data: "bad", mimeType: "image/bmp" },
        { type: "image", data: "also-good", mimeType: "image/webp" },
      ],
    });

    expect(pi.sendUserMessage).toHaveBeenCalledWith([
      { type: "text", text: "check this" },
      { type: "image", data: "good", mimeType: "image/jpeg" },
      { type: "image", data: "also-good", mimeType: "image/webp" },
    ]);
  });

  it("should handle request_commands message", () => {
    const pi = createMockPi();
    const handler = createCommandHandler(pi as any, "s1");

    const msg: ServerToExtensionMessage = {
      type: "request_commands",
      sessionId: "s1",
    };

    const result = handler.handle(msg);
    expect(pi.getCommands).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.type).toBe("commands_list");
  });
});
