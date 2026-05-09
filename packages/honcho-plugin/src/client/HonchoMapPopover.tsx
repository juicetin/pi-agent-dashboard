/**
 * HonchoMapPopover — anchored-popover slot.
 * Inline editor for per-cwd Honcho session name.
 * Tasks 7.5–7.7.
 */
import React, { useState, useEffect } from "react";
import { useHonchoConfig } from "./hooks.js";
import { upsertSessionMapping, deleteSessionMapping } from "./api.js";

interface Props {
  /** CWD of the session this popover is anchored to. */
  cwd?: string;
  /** Called to close the popover. */
  onClose?: () => void;
}

export function HonchoMapPopover({ cwd, onClose }: Props) {
  const { config } = useHonchoConfig();
  const existingName = cwd ? config?.hosts?.pi?.sessions?.[cwd] ?? "" : "";
  const [name, setName] = useState(existingName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(existingName);
  }, [existingName]);

  if (!cwd) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (name.trim()) {
        await upsertSessionMapping(cwd, name.trim());
      } else {
        await deleteSessionMapping(cwd);
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await deleteSessionMapping(cwd);
      setName("");
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-56 p-2 space-y-2">
      <div className="text-xs font-semibold text-[var(--text-muted)]">
        Map Honcho session name
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Session name…"
        className="w-full bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        {existingName && (
          <button
            onClick={handleClear}
            disabled={saving}
            className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 disabled:opacity-50"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          className="text-[10px] px-2 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
