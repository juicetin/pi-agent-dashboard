/**
 * WorkspaceHeader — header row for a workspace container.
 * Shows: name (editable inline), folder count, collapse chevron, and a
 * kebab menu (rename / delete). See change: folder-workspaces.
 */
import React, { useState, useRef, useEffect } from "react";
import Icon from "@mdi/react";
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiDotsVertical,
  mdiCheck,
  mdiClose,
} from "@mdi/js";

interface Props {
  id: string;
  name: string;
  collapsed: boolean;
  folderCount: number;
  onToggleCollapsed: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

const NAME_MAX = 80;

export function WorkspaceHeader({
  id,
  name,
  collapsed,
  folderCount,
  onToggleCollapsed,
  onRename,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Close menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed.length > NAME_MAX) {
      setDraft(name);
      setEditing(false);
      return;
    }
    if (trimmed !== name) onRename(trimmed);
    setEditing(false);
  }

  function cancelRename() {
    setDraft(name);
    setEditing(false);
  }

  function confirmDelete() {
    setMenuOpen(false);
    if (folderCount > 0) {
      // Confirm-gate non-empty workspaces. Native confirm keeps this
      // change small; can promote to a styled ConfirmDialog later.
      const ok = window.confirm(
        `Delete workspace "${name}"? Its ${folderCount} folder${folderCount === 1 ? "" : "s"} will return to top-level behavior.`,
      );
      if (!ok) return;
    }
    onDelete();
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--bg-tertiary)] rounded-t-lg select-none"
      data-testid={`workspace-header-${id}`}
    >
      <button
        onClick={onToggleCollapsed}
        className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] shrink-0"
        title={collapsed ? "Expand workspace" : "Collapse workspace"}
        data-testid={`workspace-toggle-${id}`}
        aria-label={collapsed ? "Expand workspace" : "Collapse workspace"}
      >
        <Icon path={collapsed ? mdiChevronRight : mdiChevronDown} size={0.6} />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") cancelRename();
          }}
          maxLength={NAME_MAX}
          className="flex-1 min-w-0 px-2 py-0.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--accent-blue)] text-[var(--text-primary)] focus:outline-none"
          data-testid={`workspace-rename-input-${id}`}
          aria-label="Workspace name"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="flex-1 min-w-0 text-left text-xs font-semibold text-[var(--text-primary)] truncate hover:text-[var(--text-secondary)]"
          title="Click to rename"
          data-testid={`workspace-name-${id}`}
        >
          {name}
        </button>
      )}

      <span className="text-[10px] text-[var(--text-muted)] shrink-0">
        ({folderCount})
      </span>

      {editing ? (
        <>
          <button
            onClick={commitRename}
            className="text-green-500 hover:text-green-400 shrink-0"
            title="Save"
            data-testid={`workspace-rename-save-${id}`}
          >
            <Icon path={mdiCheck} size={0.55} />
          </button>
          <button
            onClick={cancelRename}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] shrink-0"
            title="Cancel"
            data-testid={`workspace-rename-cancel-${id}`}
          >
            <Icon path={mdiClose} size={0.55} />
          </button>
        </>
      ) : (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] px-0.5"
            title="Workspace actions"
            data-testid={`workspace-menu-btn-${id}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon path={mdiDotsVertical} size={0.55} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-36 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded shadow-lg z-50 py-1"
              role="menu"
              data-testid={`workspace-menu-${id}`}
            >
              <button
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                data-testid={`workspace-menu-rename-${id}`}
              >
                Rename
              </button>
              <button
                onClick={confirmDelete}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[var(--bg-primary)]"
                data-testid={`workspace-menu-delete-${id}`}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
