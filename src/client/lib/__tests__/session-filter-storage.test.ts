import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getHiddenSessionIds,
  setHiddenSessionIds,
  getActiveOnly,
  setActiveOnly,
  pruneStaleHiddenIds,
} from "../session-filter-storage.js";

// Node 25's built-in localStorage overrides jsdom's and lacks standard methods.
// Mock window.localStorage with a simple Map-based implementation.
const store = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
} as unknown as Storage;

Object.defineProperty(window, "localStorage", { value: mockStorage, writable: true });

describe("session-filter-storage", () => {
  beforeEach(() => {
    store.clear();
  });

  describe("getHiddenSessionIds / setHiddenSessionIds", () => {
    it("should return empty set when nothing stored", () => {
      expect(getHiddenSessionIds()).toEqual(new Set());
    });

    it("should round-trip a set of IDs", () => {
      const ids = new Set(["a", "b", "c"]);
      setHiddenSessionIds(ids);
      expect(getHiddenSessionIds()).toEqual(ids);
    });

    it("should return empty set for invalid JSON", () => {
      store.set("dashboard:hiddenSessions", "not-json");
      expect(getHiddenSessionIds()).toEqual(new Set());
    });

    it("should return empty set for non-array JSON", () => {
      store.set("dashboard:hiddenSessions", '{"a":1}');
      expect(getHiddenSessionIds()).toEqual(new Set());
    });

    it("should filter out non-string values", () => {
      store.set("dashboard:hiddenSessions", '["a", 123, null, "b"]');
      expect(getHiddenSessionIds()).toEqual(new Set(["a", "b"]));
    });
  });

  describe("getActiveOnly / setActiveOnly", () => {
    it("should return false when nothing stored", () => {
      expect(getActiveOnly()).toBe(false);
    });

    it("should round-trip true", () => {
      setActiveOnly(true);
      expect(getActiveOnly()).toBe(true);
    });

    it("should round-trip false", () => {
      setActiveOnly(false);
      expect(getActiveOnly()).toBe(false);
    });
  });

  describe("pruneStaleHiddenIds", () => {
    it("should remove IDs not in known set", () => {
      setHiddenSessionIds(new Set(["a", "b", "c"]));
      const result = pruneStaleHiddenIds(new Set(["a", "c", "d"]));
      expect(result).toEqual(new Set(["a", "c"]));
      expect(getHiddenSessionIds()).toEqual(new Set(["a", "c"]));
    });

    it("should return empty set when no overlap", () => {
      setHiddenSessionIds(new Set(["x", "y"]));
      const result = pruneStaleHiddenIds(new Set(["a", "b"]));
      expect(result).toEqual(new Set());
    });

    it("should handle empty hidden set", () => {
      const result = pruneStaleHiddenIds(new Set(["a"]));
      expect(result).toEqual(new Set());
    });
  });
});
