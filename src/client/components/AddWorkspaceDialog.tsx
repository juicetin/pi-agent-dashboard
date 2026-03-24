import React, { useState } from "react";

interface Props {
  onAdd: (path: string, name?: string) => void;
  onCancel: () => void;
}

export function AddWorkspaceDialog({ onAdd, onCancel }: Props) {
  const [wsPath, setWsPath] = useState("");
  const [name, setName] = useState("");

  const derivedName = name || wsPath.split("/").filter(Boolean).pop() || "";

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-50">
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6 w-full max-w-md border border-[var(--border-secondary)]">
        <h3 className="text-lg font-semibold mb-4">Add Workspace</h3>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1">Path</label>
            <input
              type="text"
              value={wsPath}
              onChange={(e) => setWsPath(e.target.value)}
              placeholder="/path/to/project"
              className="w-full bg-[var(--bg-tertiary)] rounded px-3 py-2 text-sm border border-[var(--border-secondary)] focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1">
              Name <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={derivedName}
              className="w-full bg-[var(--bg-tertiary)] rounded px-3 py-2 text-sm border border-[var(--border-secondary)] focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            Cancel
          </button>
          <button
            onClick={() => wsPath.trim() && onAdd(wsPath.trim(), name.trim() || undefined)}
            disabled={!wsPath.trim()}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
