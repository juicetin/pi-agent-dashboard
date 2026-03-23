import React from "react";

interface Props {
  uiEvent: Record<string, unknown>;
}

export function ExtensionUI({ uiEvent }: Props) {
  const method = uiEvent.method as string;

  if (method === "confirm") {
    const result = uiEvent.result as boolean | undefined;
    return (
      <div className="mx-4 my-1 p-2 bg-gray-800/50 rounded text-xs">
        <span className="text-gray-400">{uiEvent.title as string}</span>
        {result !== undefined && (
          <span className="ml-2">{result ? "✅ Allowed" : "❌ Denied"}</span>
        )}
        {result === undefined && <span className="ml-2">⏳ Pending</span>}
      </div>
    );
  }

  if (method === "select") {
    return (
      <div className="mx-4 my-1 p-2 bg-gray-800/50 rounded text-xs">
        <span className="text-gray-400">{uiEvent.title as string}: </span>
        <span>{uiEvent.selected as string ?? "⏳"}</span>
      </div>
    );
  }

  if (method === "notify") {
    const level = (uiEvent.level as string) ?? "info";
    const colors: Record<string, string> = {
      info: "text-blue-400",
      success: "text-green-400",
      warning: "text-yellow-400",
      error: "text-red-400",
    };
    return (
      <div className={`mx-4 my-1 text-xs ${colors[level] ?? "text-gray-400"}`}>
        {uiEvent.message as string}
      </div>
    );
  }

  if (method === "input") {
    return (
      <div className="mx-4 my-1 p-2 bg-gray-800/50 rounded text-xs">
        <span className="text-gray-400">{uiEvent.title as string}: </span>
        <span>{(uiEvent.value as string) ?? "⏳"}</span>
      </div>
    );
  }

  return null;
}
