import React from "react";
import { createTwoFilesPatch } from "diff";
import type { ToolRendererProps } from "./types.js";
import { OpenFileButton } from "./OpenFileButton.js";

function DiffView({ oldText, newText, filePath }: { oldText: string; newText: string; filePath: string }) {
  const patch = createTwoFilesPatch(filePath, filePath, oldText, newText, "before", "after", { context: 3 });
  const lines = patch.split("\n");

  return (
    <div className="font-mono text-xs leading-relaxed overflow-auto max-h-80">
      {lines.map((line, i) => {
        let className = "text-gray-500 px-2"; // default (header lines)
        if (line.startsWith("+++") || line.startsWith("---")) {
          className = "text-gray-500 px-2 font-bold";
        } else if (line.startsWith("@@")) {
          className = "text-blue-400 px-2 bg-blue-900/20";
        } else if (line.startsWith("+")) {
          className = "text-green-400 px-2 bg-green-900/20";
        } else if (line.startsWith("-")) {
          className = "text-red-400 px-2 bg-red-900/20";
        }
        return (
          <div key={i} className={className}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}

export function EditToolRenderer({ args, status, result, context }: ToolRendererProps) {
  const filePath = args?.path as string | undefined;
  const oldText = args?.oldText as string | undefined;
  const newText = args?.newText as string | undefined;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-300 font-mono">{filePath ?? "file"}</span>
        <OpenFileButton filePath={filePath} context={context} />
      </div>

      {oldText != null && newText != null ? (
        <div className="rounded bg-gray-950 overflow-hidden">
          <DiffView oldText={oldText} newText={newText} filePath={filePath ?? "file"} />
        </div>
      ) : (
        <pre className="text-xs text-gray-400">{JSON.stringify(args, null, 2)}</pre>
      )}

      {result && status !== "running" && (
        <div className="text-xs text-gray-500 italic">{result}</div>
      )}
    </div>
  );
}
