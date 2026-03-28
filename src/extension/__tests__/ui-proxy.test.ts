import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUiProxy, type UiProxyOptions } from "../ui-proxy.js";

function createMockUi() {
  return {
    confirm: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves by default
    select: vi.fn().mockImplementation(() => new Promise(() => {})),
    input: vi.fn().mockImplementation(() => new Promise(() => {})),
    editor: vi.fn().mockImplementation(() => new Promise(() => {})),
    notify: vi.fn(),
  };
}

function createMockConnection() {
  return {
    send: vi.fn(),
  };
}

describe("createUiProxy", () => {
  let mockUi: ReturnType<typeof createMockUi>;
  let mockConnection: ReturnType<typeof createMockConnection>;
  let proxy: ReturnType<typeof createUiProxy>;
  let sessionId: string;

  beforeEach(() => {
    mockUi = createMockUi();
    mockConnection = createMockConnection();
    sessionId = "test-session";
  });

  function setup(hasUI: boolean) {
    proxy = createUiProxy({
      ui: mockUi as any,
      hasUI,
      getSessionId: () => sessionId,
      send: mockConnection.send,
    });
  }

  describe("confirm forwarding", () => {
    it("should send extension_ui_request for confirm", () => {
      setup(false);
      proxy.wrappedUi.confirm("Delete?", "This is permanent");

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "extension_ui_request",
          sessionId: "test-session",
          method: "confirm",
          params: { title: "Delete?", message: "This is permanent" },
        }),
      );
    });

    it("should resolve when dashboard responds with confirmed", async () => {
      setup(false);
      const promise = proxy.wrappedUi.confirm("Delete?", "Sure?");

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { confirmed: true } });

      expect(await promise).toBe(true);
    });

    it("should resolve false when cancelled", async () => {
      setup(false);
      const promise = proxy.wrappedUi.confirm("Delete?", "Sure?");

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, cancelled: true });

      expect(await promise).toBe(false);
    });
  });

  describe("select forwarding", () => {
    it("should send extension_ui_request for select", () => {
      setup(false);
      proxy.wrappedUi.select("Pick:", ["A", "B", "C"]);

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "extension_ui_request",
          method: "select",
          params: { title: "Pick:", options: ["A", "B", "C"] },
        }),
      );
    });

    it("should resolve with selected value", async () => {
      setup(false);
      const promise = proxy.wrappedUi.select("Pick:", ["A", "B"]);

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { value: "B" } });

      expect(await promise).toBe("B");
    });

    it("should resolve undefined when cancelled", async () => {
      setup(false);
      const promise = proxy.wrappedUi.select("Pick:", ["A"]);

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, cancelled: true });

      expect(await promise).toBeUndefined();
    });
  });

  describe("input forwarding", () => {
    it("should send extension_ui_request for input", () => {
      setup(false);
      proxy.wrappedUi.input("Name:", "placeholder");

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "extension_ui_request",
          method: "input",
          params: { title: "Name:", placeholder: "placeholder" },
        }),
      );
    });

    it("should resolve with entered value", async () => {
      setup(false);
      const promise = proxy.wrappedUi.input("Name:");

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { value: "hello" } });

      expect(await promise).toBe("hello");
    });
  });

  describe("editor forwarding", () => {
    it("should send extension_ui_request for editor", () => {
      setup(false);
      proxy.wrappedUi.editor("Edit:", "prefill text");

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "extension_ui_request",
          method: "editor",
          params: { title: "Edit:", prefill: "prefill text" },
        }),
      );
    });
  });

  describe("notify forwarding", () => {
    it("should call original notify AND send to dashboard", () => {
      setup(true);
      proxy.wrappedUi.notify("Done!", "success");

      expect(mockUi.notify).toHaveBeenCalledWith("Done!", "success");
      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "extension_ui_request",
          method: "notify",
          params: { message: "Done!", level: "success" },
        }),
      );
    });

    it("should call original notify in headless mode too", () => {
      setup(false);
      proxy.wrappedUi.notify("Info", "info");

      expect(mockUi.notify).toHaveBeenCalledWith("Info", "info");
      expect(mockConnection.send).toHaveBeenCalled();
    });
  });

  describe("race pattern (hasUI=true)", () => {
    it("should race TUI and dashboard for confirm", async () => {
      // Make original resolve after a tick
      mockUi.confirm.mockResolvedValue(true);
      setup(true);
      const result = await proxy.wrappedUi.confirm("Title", "Msg");
      // Original wins (resolves immediately)
      expect(result).toBe(true);
    });

    it("should let dashboard win the race if faster", async () => {
      // Original never resolves
      setup(true);
      const promise = proxy.wrappedUi.confirm("Title", "Msg");

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { confirmed: false } });

      expect(await promise).toBe(false);
    });
  });

  describe("headless-only mode (hasUI=false)", () => {
    it("should NOT call original dialog methods", () => {
      setup(false);
      proxy.wrappedUi.confirm("Title", "Msg");
      expect(mockUi.confirm).not.toHaveBeenCalled();
    });

    it("should only await dashboard response", async () => {
      setup(false);
      const promise = proxy.wrappedUi.select("Pick:", ["A"]);

      expect(mockUi.select).not.toHaveBeenCalled();

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { value: "A" } });

      expect(await promise).toBe("A");
    });
  });

  describe("unknown requestId", () => {
    it("should silently ignore responses with unknown requestId", () => {
      setup(false);
      // No pending requests — should not throw
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId: "unknown-id", result: {} });
    });
  });

  describe("pending request cleanup", () => {
    it("should remove pending request after resolution", async () => {
      setup(false);
      const promise = proxy.wrappedUi.confirm("Title", "Msg");

      const requestId = mockConnection.send.mock.calls[0][0].requestId;
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { confirmed: true } });
      await promise;

      // Second response with same ID should be ignored (already cleaned up)
      proxy.handleResponse({ type: "extension_ui_response", sessionId, requestId, result: { confirmed: false } });
      // No error thrown — silently ignored
    });
  });
});
