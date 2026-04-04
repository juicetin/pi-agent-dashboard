import React, { useState, type ReactNode } from "react";
import { Icon } from "@mdi/react";
import { mdiLoading, mdiCheck, mdiAlertCircle, mdiChevronRight, mdiChevronDown } from "@mdi/js";
import { getToolRenderer, type ToolContext } from "./tool-renderers/index.js";
import { getInteractiveRenderer } from "./interactive-renderers/registry.js";
import { useMobile } from "../hooks/useMobile.js";
import { ElapsedBadge } from "./ElapsedBadge.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

interface Props {
  toolName: string;
  toolCallId: string;
  args?: Record<string, unknown>;
  status: "running" | "complete" | "error";
  result?: string;
  context: ToolContext;
  startedAt?: number;
  duration?: number;
}

const toolSummaries: Record<string, (args?: Record<string, unknown>) => string> = {
  read: (args) => `Read ${args?.path ?? "file"}`,
  bash: (args) => `$ ${String(args?.command ?? "").slice(0, 60)}`,
  edit: (args) => `Edit ${args?.path ?? "file"}`,
  write: (args) => `Write ${args?.path ?? "file"}`,
  grep: (args) => `Grep ${args?.pattern ?? ""}`,
  find: (args) => `Find ${args?.glob ?? ""}`,
  ls: (args) => `ls ${args?.path ?? "."}`,
  ask_user: (args) => `${String(args?.title ?? "ask_user").slice(0, 80)}`,
};

function getSummary(toolName: string, args?: Record<string, unknown>): string {
  const fn = toolSummaries[toolName];
  if (fn) return fn(args);
  return toolName;
}

const statusIcons: Record<string, ReactNode> = {
  running: <Icon path={mdiLoading} size={0.55} spin />,
  complete: <Icon path={mdiCheck} size={0.55} />,
  error: <Icon path={mdiAlertCircle} size={0.55} />,
};

/** Parse ask_user result text and map to the shape interactive renderers expect */
function parseAskUserResult(method: string, result?: string): Record<string, unknown> | undefined {
  if (!result) return undefined;
  // Result format: 'User responded: "value"' or 'User responded: true'
  const match = result.match(/^User responded:\s*(.+)$/s);
  if (!match) return undefined;
  let raw: unknown;
  try { raw = JSON.parse(match[1]); } catch { raw = match[1]; }
  // Map raw value to the shape each renderer expects
  switch (method) {
    case "confirm": return { confirmed: raw };
    case "select": return { value: raw };
    case "input": return { value: raw };
    case "multiselect": return { values: raw };
    default: return { value: raw };
  }
}

export function ToolCallStep({ toolName, toolCallId, args, status, result, context, startedAt, duration }: Props) {
  const isMobile = useMobile();
  const [expanded, setExpanded] = useState(false);
  const Renderer = getToolRenderer(toolName);

  // Render ask_user tool calls using interactive renderers (same as live UI)
  if (toolName === "ask_user" && args?.method) {
    const method = args.method as string;
    const InteractiveRenderer = getInteractiveRenderer(method);
    const isError = status === "error";
    const resolvedStatus = status === "complete" ? "resolved" : status === "error" ? "cancelled" : "pending";
    const responseValue = parseAskUserResult(method, result);
    const noop = () => {};

    return (
      <ErrorBoundary>
        <InteractiveRenderer
          requestId={toolCallId}
          method={method}
          params={args as Record<string, unknown>}
          status={resolvedStatus}
          result={responseValue}
          onRespond={noop}
          onCancel={noop}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className={`${isMobile ? "mx-2" : "mx-4"} border-l-2 border-[var(--border-secondary)] pl-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] w-full text-left ${isMobile ? "min-h-[44px] py-2" : ""}`}
      >
        <span className={`inline-flex ${status === "error" ? "text-red-400" : status === "complete" ? "text-green-400" : "text-yellow-400"}`}>
          {statusIcons[status]}
        </span>
        <span className="truncate">{getSummary(toolName, args)}</span>
        <ElapsedBadge startedAt={startedAt} duration={duration} />
        <span className="ml-auto text-[var(--text-muted)] inline-flex">
          <Icon path={expanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
        </span>
      </button>
      {expanded && (
        <div className="mt-1 ml-4 p-2 bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] overflow-x-auto">
          <ErrorBoundary>
            <Renderer
              toolName={toolName}
              args={args}
              status={status}
              result={result}
              context={context}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
