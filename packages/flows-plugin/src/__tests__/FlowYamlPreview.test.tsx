/**
 * Tests for the flow YAML preview content-view claim's dismissal contract.
 *
 * The claim overlays the chat at the current /session/:id URL, gated by the
 * plugin UI-state predicate. On back it MUST clear its own UI state (revealing
 * the chat) AND invoke the shell-provided onClose. The shell wires onClose to a
 * no-op so dismissal stays on the session instead of navigating to "/".
 *
 * See change: fix-settings-back-to-launching-route.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import {
  UiPrimitiveProvider,
  createUiPrimitiveRegistry,
  registerUiPrimitive,
} from "@blackbelt-technology/dashboard-plugin-runtime";
import { UI_PRIMITIVE_KEYS } from "@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/ui-primitives.js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { FlowYamlPreviewClaim } from "../client/FlowYamlPreview.js";
import {
  useFlowsUiActions,
  getFlowsUiStateSnapshot,
  __resetFlowsUiStateForTests,
} from "../client/FlowsUiStateContext.js";

const registry = createUiPrimitiveRegistry();
// Stub markdownContent primitive — the preview body renders through it.
registerUiPrimitive(
  registry,
  UI_PRIMITIVE_KEYS.markdownContent,
  (({ content }: { content: string }) => <div data-testid="md">{content}</div>) as never,
);

const session = { id: "abc" } as unknown as DashboardSession;

function Harness({ onClose }: { onClose: () => void }) {
  const actions = useFlowsUiActions();
  // Seed the preview content so the claim renders.
  React.useEffect(() => {
    actions.setFlowYamlPreview({ content: "name: demo", title: "demo.yaml" });
  }, [actions]);
  return (
    <UiPrimitiveProvider value={registry}>
      <FlowYamlPreviewClaim session={session} routeParams={{}} onClose={onClose} />
    </UiPrimitiveProvider>
  );
}

describe("FlowYamlPreviewClaim dismissal", () => {
  beforeEach(() => __resetFlowsUiStateForTests());
  afterEach(() => {
    cleanup();
    __resetFlowsUiStateForTests();
  });

  it("back clears UI state AND calls the shell onClose", () => {
    const onClose = vi.fn();
    const { getByTitle } = render(<Harness onClose={onClose} />);

    // Preview is active before back.
    expect(getFlowsUiStateSnapshot().flowYamlPreview).not.toBeNull();

    act(() => {
      fireEvent.click(getByTitle("Back"));
    });

    // Plugin cleared its own state → predicate goes false → chat reappears.
    expect(getFlowsUiStateSnapshot().flowYamlPreview).toBeNull();
    expect(getFlowsUiStateSnapshot().sourceOpenAgent).toBeNull();
    // Shell onClose invoked (wired to a no-op in App; never navigates to "/").
    expect(onClose).toHaveBeenCalledOnce();
  });
});
