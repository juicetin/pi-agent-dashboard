import React from "react";
import type { Workspace } from "../../shared/types.js";

interface Props {
  workspaces: Workspace[];
  selectedId?: string;
  sessionCounts: Map<string, number>;
  onSelect: (workspaceId: string | undefined) => void;
  onAdd: () => void;
}

export function WorkspaceBar({ workspaces, selectedId, sessionCounts, onSelect, onAdd }: Props) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800 overflow-x-auto">
      <button
        onClick={() => onSelect(undefined)}
        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
          selectedId === undefined
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
        }`}
      >
        All
      </button>
      {workspaces.map((ws) => (
        <button
          key={ws.id}
          onClick={() => onSelect(ws.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1 ${
            selectedId === ws.id
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {ws.name}
          {(sessionCounts.get(ws.id) ?? 0) > 0 && (
            <span className="bg-blue-500/30 rounded-full px-1.5 text-[10px]">
              {sessionCounts.get(ws.id)}
            </span>
          )}
        </button>
      ))}
      <button
        onClick={onAdd}
        className="px-2 py-1 rounded-full text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800"
      >
        +
      </button>
    </div>
  );
}
