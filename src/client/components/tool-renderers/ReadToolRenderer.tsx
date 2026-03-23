import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ToolRendererProps } from "./types.js";
import { OpenFileButton } from "./OpenFileButton.js";
import { detectLanguage } from "./lang-detect.js";

export function ReadToolRenderer({ args, status, result, context }: ToolRendererProps) {
  const filePath = args?.path as string | undefined;
  const offset = args?.offset as number | undefined;
  const limit = args?.limit as number | undefined;
  const language = detectLanguage(filePath);

  const subtitle = [
    offset && `from line ${offset}`,
    limit && `${limit} lines`,
  ].filter(Boolean).join(", ");

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-300 font-mono">{filePath ?? "file"}</span>
        {subtitle && <span className="text-[10px] text-gray-600">({subtitle})</span>}
        <OpenFileButton filePath={filePath} line={offset} context={context} />
      </div>

      {status === "running" && !result && (
        <div className="text-xs text-gray-600 italic">Reading…</div>
      )}

      {result && (
        <div className="max-h-80 overflow-auto rounded text-xs">
          {language ? (
            <SyntaxHighlighter
              style={oneDark}
              language={language}
              PreTag="div"
              showLineNumbers={true}
              startingLineNumber={offset ?? 1}
              customStyle={{ margin: 0, padding: "0.5rem", fontSize: "0.7rem" }}
            >
              {result}
            </SyntaxHighlighter>
          ) : (
            <pre className="whitespace-pre-wrap text-gray-400 p-2 bg-gray-950 rounded">{result}</pre>
          )}
        </div>
      )}
    </div>
  );
}
