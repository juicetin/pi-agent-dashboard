import { describe, it, expect } from "vitest";
import { formatTokens, formatRelativeTime } from "../format.js";

describe("formatTokens", () => {
  it("should return '0' for zero", () => {
    expect(formatTokens(0)).toBe("0");
  });

  it("should return raw number below 1000", () => {
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(999)).toBe("999");
  });

  it("should format thousands with k suffix", () => {
    expect(formatTokens(1000)).toBe("1k");
    expect(formatTokens(1200)).toBe("1.2k");
    expect(formatTokens(12400)).toBe("12.4k");
    expect(formatTokens(100000)).toBe("100k");
  });

  it("should drop decimal when it would be .0", () => {
    expect(formatTokens(5000)).toBe("5k");
    expect(formatTokens(10000)).toBe("10k");
  });

  it("should handle undefined/NaN gracefully", () => {
    expect(formatTokens(undefined as any)).toBe("0");
    expect(formatTokens(NaN)).toBe("0");
  });
});

describe("formatRelativeTime", () => {
  it("should show seconds for < 60s", () => {
    expect(formatRelativeTime(30_000)).toBe("30s");
    expect(formatRelativeTime(5_000)).toBe("5s");
  });

  it("should show minutes for < 60m", () => {
    expect(formatRelativeTime(60_000)).toBe("1m");
    expect(formatRelativeTime(180_000)).toBe("3m");
    expect(formatRelativeTime(3_540_000)).toBe("59m");
  });

  it("should show hours for >= 60m", () => {
    expect(formatRelativeTime(3_600_000)).toBe("1h");
    expect(formatRelativeTime(7_200_000)).toBe("2h");
  });

  it("should show days for >= 24h", () => {
    expect(formatRelativeTime(86_400_000)).toBe("1d");
    expect(formatRelativeTime(172_800_000)).toBe("2d");
  });

  it("should return '0s' for zero or negative", () => {
    expect(formatRelativeTime(0)).toBe("0s");
    expect(formatRelativeTime(-1000)).toBe("0s");
  });
});
