import React from "react";
import Icon from "@mdi/react";
import { mdiCheckCircle, mdiCloseCircle, mdiLoading } from "@mdi/js";

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
          <span className="ml-2 inline-flex items-center gap-0.5">{result ? <><Icon path={mdiCheckCircle} size={0.55} className="text-green-400" /> Allowed</> : <><Icon path={mdiCloseCircle} size={0.55} className="text-red-400" /> Denied</>}</span>
        )}
        {result === undefined && <span className="ml-2 inline-flex items-center gap-0.5"><Icon path={mdiLoading} size={0.55} spin /> Pending</span>}
      </div>
    );
  }

  if (method === "select") {
    return (
      <div className="mx-4 my-1 p-2 bg-gray-800/50 rounded text-xs">
        <span className="text-gray-400">{uiEvent.title as string}: </span>
        <span className="inline-flex items-center">{uiEvent.selected as string ?? <Icon path={mdiLoading} size={0.55} spin />}</span>
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
        <span className="inline-flex items-center">{(uiEvent.value as string) ?? <Icon path={mdiLoading} size={0.55} spin />}</span>
      </div>
    );
  }

  return null;
}
