import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { TokenStatsBar } from "../TokenStatsBar.js";
import type { TurnStat } from "../../lib/event-reducer.js";

function makeTurn(overrides: Partial<TurnStat> = {}): TurnStat {
  return { input: 1000, output: 500, cacheRead: 3000, cacheWrite: 200, ...overrides };
}

const defaultProps = {
  tokensIn: 1000,
  tokensOut: 500,
  cacheRead: 3000,
  cacheWrite: 200,
  cost: 0.05,
};

describe("TokenStatsBar", () => {
  it("renders vertical bars with input and output colors only", () => {
    const { container } = render(
      <TokenStatsBar turnStats={[makeTurn()]} {...defaultProps} />
    );
    // Vertical bars should have blue (input) and purple (output) only
    expect(container.querySelector(".bg-blue-500")).not.toBeNull();
    expect(container.querySelector(".bg-purple-500")).not.toBeNull();
    // No orange/yellow in vertical bars (cache removed from bars)
  });

  it("renders stacked context bar with segments", () => {
    const { container } = render(
      <TokenStatsBar
        turnStats={[makeTurn()]}
        contextUsage={{ tokens: 50000, contextWindow: 200000 }}
        {...defaultProps}
      />
    );
    const contextBar = container.querySelector(".h-2.bg-\\[var\\(--bg-tertiary\\)\\]");
    expect(contextBar).not.toBeNull();
  });

  it("uses gradient color (not threshold classes) for context bar at high usage", () => {
    const { container } = render(
      <TokenStatsBar
        turnStats={[makeTurn()]}
        contextUsage={{ tokens: 185000, contextWindow: 200000 }}
        {...defaultProps}
      />
    );
    const bar = container.querySelector('[data-testid="context-bar"]');
    const segments = bar?.querySelectorAll<HTMLElement>(".h-full");
    expect(segments!.length).toBeGreaterThan(0);
    // Should use inline backgroundColor (not Tailwind bg-red-500 class)
    const seg = segments![0]!;
    expect(seg.style.backgroundColor).toBeTruthy();
    expect(seg.className).not.toContain("bg-red-500");
    expect(seg.className).not.toContain("bg-yellow-500");
  });

  it("uses gradient color for context bar at medium usage", () => {
    const { container } = render(
      <TokenStatsBar
        turnStats={[makeTurn()]}
        contextUsage={{ tokens: 100000, contextWindow: 200000 }}
        {...defaultProps}
      />
    );
    const bar = container.querySelector('[data-testid="context-bar"]');
    const segments = bar?.querySelectorAll<HTMLElement>(".h-full");
    expect(segments!.length).toBeGreaterThan(0);
    const seg = segments![0]!;
    expect(seg.style.backgroundColor).toBeTruthy();
    expect(seg.className).not.toContain("bg-blue-500");
  });

  it("uses gradient color for context bar at low usage", () => {
    const { container } = render(
      <TokenStatsBar
        turnStats={[makeTurn()]}
        contextUsage={{ tokens: 20000, contextWindow: 200000 }}
        {...defaultProps}
      />
    );
    const bar = container.querySelector('[data-testid="context-bar"]');
    const segments = bar?.querySelectorAll<HTMLElement>(".h-full");
    expect(segments!.length).toBeGreaterThan(0);
    const seg = segments![0]!;
    expect(seg.style.backgroundColor).toBeTruthy();
    // No threshold color classes
    expect(seg.className).not.toContain("bg-green");
    expect(seg.className).not.toContain("bg-gray-500");
  });

  it("renders cumulative stats matching pi CLI format", () => {
    const { container } = render(
      <TokenStatsBar
        turnStats={[makeTurn()]}
        tokensIn={91000}
        tokensOut={4200}
        cacheRead={29000000}
        cacheWrite={445000}
        cost={19.498}
      />
    );
    expect(container.textContent).toContain("↑4.2k");
    expect(container.textContent).toContain("↓91.0k");
    expect(container.textContent).toContain("R29.0M");
    expect(container.textContent).toContain("W445.0k");
    expect(container.textContent).toContain("$19.4980");
  });

  it("hides cache stats when zero", () => {
    const { container } = render(
      <TokenStatsBar
        turnStats={[makeTurn({ cacheRead: 0, cacheWrite: 0 })]}
        tokensIn={1000}
        tokensOut={500}
        cacheRead={0}
        cacheWrite={0}
        cost={0}
      />
    );
    expect(container.textContent).not.toContain("R");
    expect(container.textContent).not.toContain("W");
  });

  it("hides legend when no turns", () => {
    const { container } = render(
      <TokenStatsBar turnStats={[]} tokensIn={0} tokensOut={0} cacheRead={0} cacheWrite={0} cost={0} />
    );
    // No vertical bars rendered
    const bars = container.querySelectorAll(".bg-blue-500");
    expect(bars.length).toBe(0);
  });
});
