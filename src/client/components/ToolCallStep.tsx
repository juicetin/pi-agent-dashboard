import React, { useState } from "react";

interface Props {
  toolName: string;
  toolCallId: string;
  args?: Record<string, unknown>;
  status: "running" | "complete" | "error";
  result?: string;
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

const statusIcons: Record<string, string> = {
  running: "⏳",
  complete: "✓",
  error: "✗",
};

export function ToolCallStep({ toolName, toolCallId, args, status, result }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mx-4 my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 w-full text-left"
      >
        <span className={status === "error" ? "text-red-400" : status === "complete" ? "text-green-400" : "text-yellow-400"}>
          {statusIcons[status]}
        </span>
        <span className="truncate">{getSummary(toolName, args)}</span>
        <span className="ml-auto text-gray-600">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-4 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-x-auto space-y-2">
          <pre>{JSON.stringify(args, null, 2)}</pre>
          {result && (
            <>
              <div className="text-gray-500 font-medium">Output:</div>
              <pre className="whitespace-pre-wrap">{result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
