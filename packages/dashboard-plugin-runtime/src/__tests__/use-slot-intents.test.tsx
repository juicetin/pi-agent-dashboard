/**
 * Tests for useSlotIntents hook.
 *
 * See change: adopt-server-driven-intent-rendering.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { intentStore, useSlotIntents } from "../intent-store.js";
import type { IntentNode } from "@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/intent-types.js";

const sampleIntent: IntentNode = {
  primitive: "ui:action-list",
  props: { actions: [{ label: "Run X" }] },
};

function Probe({ slot, sessionId, onRender }: {
  slot: any;
  sessionId: string | null;
  onRender: (size: number, first: IntentNode | undefined) => void;
}) {
  const intents = useSlotIntents(slot, sessionId);
  const first = Array.from(intents.values())[0];
  onRender(intents.size, first);
  return <div data-testid="count">{intents.size}</div>;
}

beforeEach(() => {
  intentStore.__resetForTests();
});

afterEach(() => {
  cleanup();
  intentStore.__resetForTests();
});

describe("useSlotIntents", () => {
  it("starts with size 0 when no intents are set", () => {
    let lastSize = -1;
    render(<Probe slot="session-card-action-bar" sessionId="abc" onRender={(s) => (lastSize = s)} />);
    expect(lastSize).toBe(0);
  });

  it("re-renders when a matching intent is set", () => {
    let lastSize = -1;
    const { getByTestId } = render(
      <Probe slot="session-card-action-bar" sessionId="abc" onRender={(s) => (lastSize = s)} />,
    );
    expect(getByTestId("count").textContent).toBe("0");

    act(() => {
      intentStore.set(
        { pluginId: "flows", sessionId: "abc", slot: "session-card-action-bar" },
        sampleIntent,
      );
    });
    expect(getByTestId("count").textContent).toBe("1");
    expect(lastSize).toBe(1);
  });

  it("does NOT re-render when an unrelated slot is set", () => {
    let renderCount = 0;
    render(<Probe slot="session-card-action-bar" sessionId="abc" onRender={() => renderCount++} />);
    const initialRenders = renderCount;

    act(() => {
      intentStore.set(
        { pluginId: "flows", sessionId: "xyz", slot: "session-card-badge" },
        sampleIntent,
      );
    });

    // The slot snapshot got invalidated globally so React calls getSnapshot
    // again, but the returned EMPTY_SLOT reference is stable so React's
    // bailout should kick in. Allow at most one extra render for the
    // snapshot rebuild.
    expect(renderCount).toBeLessThanOrEqual(initialRenders + 1);
  });

  it("reflects clearForSession", () => {
    const { getByTestId } = render(
      <Probe slot="session-card-action-bar" sessionId="abc" onRender={() => {}} />,
    );
    act(() => {
      intentStore.set(
        { pluginId: "flows", sessionId: "abc", slot: "session-card-action-bar" },
        sampleIntent,
      );
    });
    expect(getByTestId("count").textContent).toBe("1");

    act(() => intentStore.clearForSession("abc"));
    expect(getByTestId("count").textContent).toBe("0");
  });
});
