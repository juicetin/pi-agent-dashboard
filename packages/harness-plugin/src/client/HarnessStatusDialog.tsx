import React from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiClipboardCheckOutline, mdiClose, mdiOpenInNew } from "@mdi/js";
import type { HarnessDetail } from "./harness-status-data.js";
import { formatHarnessUrlLabel } from "./harness-status-data.js";

interface HarnessStatusDialogProps {
  open: boolean;
  titleId: string;
  runLabel: string;
  details: HarnessDetail[];
  onClose: () => void;
}

export function HarnessStatusDialog({ open, titleId, runLabel, details, onClose }: HarnessStatusDialogProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4"
      data-testid="harness-status-dialog-backdrop"
    >
      <button
        type="button"
        aria-label="Close harness status"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-xl border border-blue-500/30 bg-[var(--bg-secondary)] p-4 text-[var(--text)] shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300">
            <Icon path={mdiClipboardCheckOutline} size={0.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-[var(--text)]">
              Harness run status
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-blue-300">
              {runLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close harness status"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]"
            onClick={onClose}
          >
            <Icon path={mdiClose} size={0.65} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 font-mono text-xs">
          {details.map((detail) => {
            const isWeb = detail.label.toLowerCase() === "web";
            return (
              <React.Fragment key={`${detail.label}:${detail.value}`}>
                <dt className="text-blue-300/90">{detail.label}</dt>
                <dd className="min-w-0 text-[var(--text-secondary)]">
                  {isWeb ? (
                    <a
                      href={detail.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-blue-300 underline hover:text-blue-200"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="truncate">{formatHarnessUrlLabel(detail.value)}</span>
                      <Icon path={mdiOpenInNew} size={0.45} className="flex-shrink-0 opacity-70" />
                    </a>
                  ) : (
                    <span className="break-words">{detail.value}</span>
                  )}
                </dd>
              </React.Fragment>
            );
          })}
        </dl>
      </section>
    </div>,
    document.body,
  );
}
