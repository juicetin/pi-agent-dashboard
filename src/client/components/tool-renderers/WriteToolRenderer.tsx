import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ToolRendererProps } from "./types.js";
import { OpenFileButton } from "./OpenFileButton.js";
import { detectLanguage } from "./lang-detect.js";

export function WriteToolRenderer({ args, status, result, context }: ToolRendererProps) {
  const filePath = args?.path as string | undefined;
  const content = args?.content as string | undefined;
  const language = detectLanguage(filePath);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-300 font-mono">{filePath ?? "file"}</span>
        <OpenFileButton filePath={filePath} context={context} />
      </div>

      {status === "running" && !content && (
        <div className="text-xs text-gray-600 italic">Writing…</div>
      )}

      {content && (
        <div className="max-h-80 overflow-auto rounded text-xs">
          {language ? (
            <SyntaxHighlighter
              style={oneDark}
              language={language}
              PreTag="div"
              showLineNumbers={true}
              customStyle={{ margin: 0, padding: "0.5rem", fontSize: "0.7rem" }}
            >
              {content}
            </SyntaxHighlighter>
          ) : (
            <pre className="whitespace-pre-wrap text-gray-400 p-2 bg-gray-950 rounded">{content}</pre>
          )}
        </div>
      )}

      {result && status !== "running" && (
        <div className="text-xs text-gray-500 italic">{result}</div>
      )}
    </div>
  );
}
