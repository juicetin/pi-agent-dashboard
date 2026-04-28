import React, { useEffect, useCallback } from "react";
import { Icon } from "@mdi/react";
import { mdiDownload, mdiPackageVariantClosed } from "@mdi/js";
import { DialogPortal } from "./DialogPortal.js";

interface PackageInstallConfirmDialogProps {
  source: string;
  packageName?: string;
  scope: "global" | "local";
  /** When set, the scope radio is hidden and the locked scope is used unconditionally.
   *  See change: unify-package-management-ui. */
  lockScope?: "global" | "local";
  /** Called when the user changes the scope via the radio. Required when `lockScope` is undefined. */
  onScopeChange?: (scope: "global" | "local") => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PackageInstallConfirmDialog({
  source,
  packageName,
  scope,
  lockScope,
  onScopeChange,
  onConfirm,
  onCancel,
}: PackageInstallConfirmDialogProps) {
  const showScopePicker = lockScope === undefined && onScopeChange !== undefined;
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  }, [onCancel]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        data-testid="package-install-confirm-dialog"
      >
        <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-xl w-[90vw] max-w-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
              <Icon path={mdiPackageVariantClosed} size={0.8} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Install Package</h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                This will install the package and reload all active sessions.
              </p>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded p-3 mb-4 space-y-1.5">
            {packageName && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Name</span>
                <span className="text-[var(--text-primary)] font-medium">{packageName}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Source</span>
              <span className="text-[var(--text-primary)] font-mono text-[11px]">{source}</span>
            </div>
            {!showScopePicker && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Scope</span>
                <span className="text-[var(--text-primary)]">{scope === "global" ? "Global" : "Local (project)"}</span>
              </div>
            )}
          </div>

          {showScopePicker && (
            <div
              className="mb-4 p-3 rounded border border-[var(--border-secondary)] bg-[var(--bg-surface)]"
              data-testid="package-install-scope-picker"
              role="radiogroup"
              aria-label="Install scope"
            >
              <div className="text-[11px] text-[var(--text-muted)] mb-2">Install to</div>
              <div className="flex flex-col gap-1.5">
                {(["local", "global"] as const).map((opt) => (
                  <label
                    key={opt}
                    className="flex items-start gap-2 cursor-pointer"
                    data-testid={`package-install-scope-${opt}`}
                  >
                    <input
                      type="radio"
                      name="package-install-scope"
                      value={opt}
                      checked={scope === opt}
                      onChange={() => onScopeChange?.(opt)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs text-[var(--text-primary)] font-medium">
                        {opt === "global" ? "Global" : "Local (this folder only)"}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {opt === "global"
                          ? "~/.pi/agent/settings.json — available to every pi session."
                          : "<cwd>/.pi/settings.json — available only when running in this folder."}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded border border-[var(--border-secondary)] hover:border-[var(--border-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-3 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:bg-[var(--accent-primary)]/80 font-medium flex items-center gap-1"
            >
              <Icon path={mdiDownload} size={0.4} />
              Install
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
