import React, { useState, type ReactNode } from "react";
import Icon from "@mdi/react";
import { mdiLoading, mdiCheck, mdiAlertCircle, mdiChevronRight, mdiChevronDown } from "@mdi/js";
import { getToolRenderer, type ToolContext } from "./tool-renderers/index.js";

interface Props {
  toolName: string;
  toolCallId: string;
  args?: Record<string, unknown>;
  status: "running" | "complete" | "error";
  result?: string;
  context: ToolContext;
}

const toolSummaries: Record<string, (args?: Record<string, unknown>) => string> = {
  read: (args) => `Read ${args?.path ?? "file"}`,
  bash: (args) => `$ ${String(args?.command ?? "").slice(0, 60)}`,
  edit: (args) => `Edit ${args?.path ?? "file"}`,
  write: (args) => `Write ${args?.path ?? "file"}`,
  grep: (args) => `Grep ${args?.pattern ?? ""}`,
  find: (args) => `Find ${args?.glob ?? ""}`,
  ls: (args) => `ls ${args?.path ?? "."}`,
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

export function ToolCallStep({ toolName, toolCallId, args, status, result, context }: Props) {
  const [expanded, setExpanded] = useState(false);
  const Renderer = getToolRenderer(toolName);

  return (
    <div className="mx-4 my-1 border-l-2 border-gray-700/50 pl-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 w-full text-left"
      >
        <span className={`inline-flex ${status === "error" ? "text-red-400" : status === "complete" ? "text-green-400" : "text-yellow-400"}`}>
          {statusIcons[status]}
        </span>
        <span className="truncate">{getSummary(toolName, args)}</span>
        <span className="ml-auto text-gray-600 inline-flex">
          <Icon path={expanded ? mdiChevronDown : mdiChevronRight} size={0.6} />
        </span>
      </button>
      {expanded && (
        <div className="mt-1 ml-4 p-2 bg-gray-900 rounded-xl shadow-md border border-white/5 text-xs text-gray-400 overflow-x-auto">
          <Renderer
            toolName={toolName}
            args={args}
            status={status}
            result={result}
            context={context}
          />
        </div>
      )}
    </div>
  );
}
