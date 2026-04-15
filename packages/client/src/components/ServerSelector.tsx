import React, { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@mdi/react";
import { mdiServerNetwork, mdiChevronDown, mdiCog } from "@mdi/js";
import type { KnownServer } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import { listKnownServers } from "../lib/known-servers-api.js";

/** Re-export for backward compat — consumers that imported this type */
export interface DiscoveredServerInfo {
  host: string;
  port: number;
  piPort: number;
  version: string;
  pid: number;
  isLocal: boolean;
  source: "mdns" | "fallback";
}

interface ServerEntry {
  host: string;
  port: number;
  label?: string;
  isLocal: boolean;
}

interface Props {
  /** mDNS-discovered servers — kept for Settings panel, no longer primary data source */
  servers?: DiscoveredServerInfo[];
  currentHost: string;
  currentPort: number;
  connected: boolean;
  onSwitch: (host: string, port: number) => void;
  /** Navigate to server settings */
  onManageServers?: () => void;
}

export function ServerSelector({ currentHost, currentPort, connected, onSwitch, onManageServers }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [availability, setAvailability] = useState<Map<string, boolean>>(new Map());
  const [knownServers, setKnownServers] = useState<KnownServer[]>([]);

  // Load known servers from API on mount and when dropdown opens
  const loadKnown = useCallback(async () => {
    try {
      const servers = await listKnownServers();
      setKnownServers(servers);
    } catch {
      // silently ignore — will show localhost only
    }
  }, []);

  useEffect(() => { loadKnown(); }, [loadKnown]);
  useEffect(() => { if (open) loadKnown(); }, [open, loadKnown]);

  // Build the display list: localhost first, then known servers
  const entries: ServerEntry[] = [
    { host: "localhost", port: currentPort, label: "Local", isLocal: true },
    ...knownServers
      .filter((s) => !(s.host === "localhost" || s.host === "127.0.0.1"))
      .map((s) => ({ host: s.host, port: s.port, label: s.label, isLocal: false })),
  ];

  // If current server isn't in the list, add it
  const currentKey = `${currentHost}:${currentPort}`;
  const isCurrentInList = entries.some((e) => `${e.host}:${e.port}` === currentKey);
  if (!isCurrentInList) {
    const isLocal = currentHost === "localhost" || currentHost === "127.0.0.1";
    entries.push({ host: currentHost, port: currentPort, isLocal });
  }

  // Probe non-current servers for availability when dropdown opens
  useEffect(() => {
    if (!open || entries.length <= 1) return;
    let cancelled = false;
    const others = entries.filter((s) => `${s.host}:${s.port}` !== currentKey);
    for (const s of others) {
      const key = `${s.host}:${s.port}`;
      fetch(`http://${s.host}:${s.port}/api/health`, { signal: AbortSignal.timeout(2000) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled) setAvailability((prev) => new Map(prev).set(key, d?.ok === true));
        })
        .catch(() => {
          if (!cancelled) setAvailability((prev) => new Map(prev).set(key, false));
        });
    }
    return () => { cancelled = true; };
  }, [open, knownServers, currentHost, currentPort]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Find current entry's display label
  const currentEntry = entries.find((e) => `${e.host}:${e.port}` === currentKey);
  const displayLabel = currentEntry?.label ?? (currentEntry?.isLocal ? "Local" : currentHost);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
        title="Switch server"
      >
        <Icon path={mdiServerNetwork} size={0.55} />
        <span className="truncate max-w-[180px]">{displayLabel}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        <Icon path={mdiChevronDown} size={0.45} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg shadow-xl py-1">
          {onManageServers && (
            <button
              onClick={() => { setOpen(false); onManageServers(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer border-b border-[var(--border-secondary)] mb-1"
            >
              <Icon path={mdiCog} size={0.45} />
              <span>Manage servers…</span>
            </button>
          )}
          {entries.map((entry) => {
            const key = `${entry.host}:${entry.port}`;
            const isCurrent = key === currentKey;
            return (
              <button
                key={key}
                onClick={() => {
                  if (!isCurrent) onSwitch(entry.host, entry.port);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer ${
                  isCurrent ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{entry.label ?? entry.host}</div>
                  <div className="text-[var(--text-tertiary)]">
                    {entry.host}:{entry.port}
                  </div>
                </div>
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    entry.isLocal
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-purple-500/20 text-purple-400"
                  }`}
                >
                  {entry.isLocal ? "Local" : "Remote"}
                </span>
                {isCurrent ? (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`} />
                ) : (
                  availability.has(key) && (
                    <span className={`shrink-0 text-[10px] ${availability.get(key) ? "text-green-500" : "text-red-400"}`}>
                      {availability.get(key) ? "Available" : "Unreachable"}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
