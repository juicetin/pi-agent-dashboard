/**
 * Install gate — shown when pi-memory-honcho extension is not installed.
 * Tasks 6.2 + 6.3.
 *
 * Uses the dashboard's WebSocket progress channel to show real-time install
 * status (POST → 202 + operationId → package_progress events → completion).
 */
import React, { useEffect, useRef } from "react";
import Icon from "@mdi/react";
import {
  mdiBrain,
  mdiAlertCircle,
  mdiCheckCircle,
  mdiLoading,
} from "@mdi/js";
import { usePackageInstall } from "./usePackageInstall.js";

const EXTENSION_SOURCE = "npm:pi-memory-honcho";

export function InstallGate({ onInstalled }: { onInstalled: () => void }) {
  const { phase, message, error, install, reset } = usePackageInstall();
  const notifiedRef = useRef(false);

  const handleInstall = () => {
    install(EXTENSION_SOURCE);
  };

  // On success, re-check extension state after a short delay.
  useEffect(() => {
    if (phase === "success" && !notifiedRef.current) {
      notifiedRef.current = true;
      const t = setTimeout(onInstalled, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onInstalled]);

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-[var(--text)] inline-flex items-center gap-1.5">
        <Icon path={mdiBrain} size={0.6} />
        Honcho memory not installed
      </h3>
      <p className="text-xs text-[var(--text-muted)]">
        Install the pi-memory-honcho extension to enable persistent cross-session memory.
      </p>

      {/* Error state */}
      {phase === "error" && error && (
        <div className="text-red-400 text-xs bg-red-900/20 rounded px-2 py-1 flex items-start gap-1.5">
          <Icon path={mdiAlertCircle} size={0.5} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Success state */}
      {phase === "success" && (
        <div className="text-green-400 text-xs bg-green-900/20 rounded px-2 py-1 flex items-center gap-1.5">
          <Icon path={mdiCheckCircle} size={0.5} style={{ flexShrink: 0 }} />
          <span>Installed! Running pi sessions must reload to register the extension.</span>
        </div>
      )}

      {/* Installing state — progress indicator */}
      {phase === "installing" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Icon path={mdiLoading} size={0.5} spin color="rgb(96, 165, 250)" />
            <span className="text-xs text-[var(--text)]">Installing pi-memory-honcho…</span>
          </div>
          {message && (
            <div
              className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-secondary)] rounded px-2 py-1 truncate"
              title={message}
            >
              {message}
            </div>
          )}
          {/* Indeterminate progress bar */}
          <div className="h-1 w-full bg-[var(--bg-secondary)] rounded overflow-hidden">
            <div className="h-full bg-blue-500 rounded animate-indeterminate" />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {phase === "idle" && (
        <button
          onClick={handleInstall}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white"
        >
          Install pi-memory-honcho
        </button>
      )}

      {phase === "error" && (
        <button
          onClick={() => { reset(); handleInstall(); }}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white"
        >
          Retry Install
        </button>
      )}

      {phase !== "success" && (
        <p className="text-[10px] text-[var(--text-muted)]">
          Running pi sessions must reload after install.
        </p>
      )}

      {/* CSS animation for indeterminate progress bar */}
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 40%; }
          50% { transform: translateX(60%); width: 40%; }
          100% { transform: translateX(200%); width: 40%; }
        }
        .animate-indeterminate {
          animation: indeterminate 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
