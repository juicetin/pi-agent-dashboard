/**
 * Content-view claim renderer for the `flow-yaml-preview` route.
 *
 * Replaces the shell's `flowYamlPreview` state + MarkdownPreviewView
 * call site at App.tsx:1008-1014. The shell will navigate into this
 * route when the user clicks "view yaml" or "view agent source"; the
 * content (yaml string + title) is set by the plugin's UI-state
 * context (see Part F.4 / F.5 callbacks).
 *
 * See change: pluginize-flows-via-registry.
 */
import React from "react";
import { Icon } from "@mdi/react";
import { mdiArrowLeft } from "@mdi/js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { UI_PRIMITIVE_KEYS } from "@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/ui-primitives.js";
import { useUiPrimitive } from "@blackbelt-technology/dashboard-plugin-runtime";
import { useFlowsUiState, useFlowsUiActions } from "./FlowsUiStateContext.js";

/**
 * Slot-consumer wrapper for the `content-view` claim with route
 * `flow-yaml-preview`. Reads the preview content from the plugin's
 * internal UI-state context. On dismiss, clears `flowYamlPreview` and
 * `sourceOpenAgent` (the same cleanup the shell does today at App.tsx:
 * 1012) and calls the slot's `onClose` to navigate back to the default
 * content view.
 */
export function FlowYamlPreviewClaim({
  onClose,
}: {
  // session prop is part of the slot contract but unused here \u2014 the
  // preview content is already in the plugin's UI-state context.
  session: DashboardSession;
  routeParams: Record<string, string>;
  onClose: () => void;
}) {
  const MarkdownContent = useUiPrimitive(UI_PRIMITIVE_KEYS.markdownContent);
  const { flowYamlPreview } = useFlowsUiState();
  const actions = useFlowsUiActions();

  if (!flowYamlPreview) return null;

  const handleBack = () => {
    actions.setFlowYamlPreview(null);
    actions.setSourceOpenAgent(null);
    onClose();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center gap-2">
        <button
          onClick={handleBack}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          title="Back"
        >
          <Icon path={mdiArrowLeft} size={0.7} />
        </button>
        <div className="font-medium text-sm truncate">{flowYamlPreview.title}</div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <MarkdownContent content={flowYamlPreview.content} />
      </div>
    </div>
  );
}
