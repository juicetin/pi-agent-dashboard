import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Icon from "@mdi/react";
import { mdiClose, mdiContentCopy, mdiCheck } from "@mdi/js";
import { DialogPortal } from "./DialogPortal.js";

interface Props {
  url: string;
  onClose: () => void;
}

export function QrCodeDialog({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
        data-testid="qr-dialog-backdrop"
      >
        <div
          className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Open on Mobile
            </h2>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Close"
              data-testid="qr-dialog-close"
            >
              <Icon path={mdiClose} size={0.8} />
            </button>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <canvas
              ref={canvasRef}
              data-testid="qr-canvas"
              className="rounded"
            />
          </div>

          {/* URL + Copy */}
          <div className="flex items-center gap-2 bg-[var(--bg-surface)] rounded px-3 py-2">
            <span
              className="text-sm text-[var(--text-secondary)] truncate flex-1 select-all"
              title={url}
              data-testid="qr-url"
            >
              {url}
            </span>
            <button
              onClick={handleCopy}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
              title={copied ? "Copied!" : "Copy URL"}
              data-testid="qr-copy-btn"
            >
              <Icon path={copied ? mdiCheck : mdiContentCopy} size={0.7} />
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
            Scan to open PI Dashboard or install as an app
          </p>
        </div>
      </div>
    </DialogPortal>
  );
}
