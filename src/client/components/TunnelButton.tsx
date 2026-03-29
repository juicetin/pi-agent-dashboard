import React, { useState, useCallback } from "react";
import Icon from "@mdi/react";
import { mdiTunnel } from "@mdi/js";
import { useLocation } from "wouter";
import type { TunnelStatus } from "../../shared/rest-api.js";
import { QrCodeDialog } from "./QrCodeDialog.js";

export function TunnelButton() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/tunnel-status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return data as TunnelStatus;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const handleClick = useCallback(async () => {
    const s = await fetchStatus();
    if (!s) return;

    if (s.status === "active") {
      setQrUrl(s.url);
    } else if (s.status === "unavailable") {
      navigate("/tunnel-setup");
    }
  }, [fetchStatus, navigate]);

  const color = status?.status === "active"
    ? "text-green-400"
    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]";

  const title = status?.status === "active"
    ? `Tunnel: ${status.url} (click for QR code)`
    : status?.status === "unavailable"
      ? "Tunnel: zrok not installed (click for setup guide)"
      : "Tunnel status";

  return (
    <>
      <button
        onClick={handleClick}
        onMouseEnter={() => { if (!status) fetchStatus(); }}
        className={color}
        title={title}
        data-testid="tunnel-btn"
      >
        <Icon path={mdiTunnel} size={0.6} />
      </button>
      {qrUrl && (
        <QrCodeDialog url={qrUrl} onClose={() => setQrUrl(null)} />
      )}
    </>
  );
}
