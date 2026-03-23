import React from "react";
import type { ToolRendererProps } from "./types.js";

/** Fallback renderer: shows raw JSON args and plain text output */
export function GenericToolRenderer({ args, result }: ToolRendererProps) {
  return (
    <div className="space-y-2">
      <pre className="text-xs text-gray-400">{JSON.stringify(args, null, 2)}</pre>
      {result && (
        <>
          <div className="text-gray-500 font-medium text-xs">Output:</div>
          <pre className="whitespace-pre-wrap text-xs text-gray-400">{result}</pre>
        </>
      )}
    </div>
  );
}
