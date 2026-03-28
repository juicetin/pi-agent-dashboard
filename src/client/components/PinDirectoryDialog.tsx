import React, { useState } from "react";

interface Props {
  onPin: (path: string) => void;
  onCancel: () => void;
}

export function PinDirectoryDialog({ onPin, onCancel }: Props) {
  const [dirPath, setDirPath] = useState("");

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-[60]">
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6 w-full max-w-md border border-[var(--border-secondary)]">
        <h3 className="text-lg font-semibold mb-4">Pin Directory</h3>

        <div>
          <label className="text-sm text-[var(--text-secondary)] block mb-1">Directory Path</label>
          <input
            type="text"
            value={dirPath}
            onChange={(e) => setDirPath(e.target.value)}
            placeholder="/path/to/project"
            className="w-full bg-[var(--bg-tertiary)] rounded px-3 py-2 text-sm border border-[var(--border-secondary)] focus:border-blue-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirPath.trim()) {
                onPin(dirPath.trim());
              }
              if (e.key === "Escape") {
                onCancel();
              }
            }}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            Cancel
          </button>
          <button
            onClick={() => dirPath.trim() && onPin(dirPath.trim())}
            disabled={!dirPath.trim()}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            Pin
          </button>
        </div>
      </div>
    </div>
  );
}
