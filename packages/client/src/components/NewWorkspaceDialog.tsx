/**
 * NewWorkspaceDialog — single text input to create a workspace.
 * Validates: trimmed, 1–80 chars. Calls `onCreate(name)` on submit.
 * See change: folder-workspaces.
 */
import React, { useState, useRef, useEffect } from "react";

interface Props {
  onCreate: (name: string) => void;
  onCancel: () => void;
}

const NAME_MAX = 80;

export function NewWorkspaceDialog({ onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= NAME_MAX;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid) return;
    onCreate(trimmed);
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-[60]">
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6 w-full max-w-md border border-[var(--border-secondary)]">
        <h3 className="text-lg font-semibold mb-4">New Workspace</h3>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            placeholder="Workspace name"
            maxLength={NAME_MAX}
            className="w-full px-3 py-2 text-sm rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            data-testid="new-workspace-input"
            aria-label="Workspace name"
          />
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            {trimmed.length}/{NAME_MAX}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs rounded border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              data-testid="new-workspace-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="px-3 py-1.5 text-xs rounded border border-[var(--accent-blue)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--accent-blue)]"
              data-testid="new-workspace-create"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
