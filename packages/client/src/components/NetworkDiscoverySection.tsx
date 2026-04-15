/**
 * Settings section for mDNS network discovery.
 * Shows a scan button and discovered servers with "Add" action.
 */
import React, { useState, useCallback } from "react";
import { Icon } from "@mdi/react";
import { mdiRefresh, mdiPlus, mdiCheck, mdiClose, mdiServerNetwork } from "@mdi/js";
import type { KnownServer } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import type { DiscoveredServerInfo } from "@blackbelt-technology/pi-dashboard-shared/rest-api.js";
import { discoverServers, addKnownServer } from "../lib/known-servers-api.js";

interface Props {
  knownServers: KnownServer[];
  onServerAdded: () => void;
}

export function NetworkDiscoverySection({ knownServers, onServerAdded }: Props) {
  const [discovered, setDiscovered] = useState<DiscoveredServerInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState("");

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const servers = await discoverServers();
      setDiscovered(servers);
      setScanned(true);
    } catch {
      setDiscovered([]);
      setScanned(true);
    } finally {
      setScanning(false);
    }
  }, []);

  const isKnown = (host: string, port: number) =>
    knownServers.some((s) => s.host === host && s.port === port);

  const handleStartAdd = (server: DiscoveredServerInfo) => {
    const key = `${server.host}:${server.port}`;
    setAddingKey(key);
    setAddLabel(server.host);
  };

  const handleConfirmAdd = async (server: DiscoveredServerInfo) => {
    try {
      await addKnownServer(server.host, server.port, addLabel.trim() || undefined);
      setAddingKey(null);
      setAddLabel("");
      onServerAdded();
    } catch {
      // ignore
    }
  };

  const handleCancelAdd = () => {
    setAddingKey(null);
    setAddLabel("");
  };

  return (
    <div className="space-y-2">
      {/* Scan button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <Icon path={mdiRefresh} size={0.5} className={scanning ? "animate-spin" : ""} />
        {scanning ? "Scanning..." : "Scan network"}
      </button>

      {/* Results */}
      {scanned && discovered.length === 0 && (
        <div className="text-sm text-[var(--text-muted)] py-1">
          No servers found on the network.
        </div>
      )}

      {discovered.map((server) => {
        const key = `${server.host}:${server.port}`;
        const alreadyKnown = isKnown(server.host, server.port);
        const isAdding = addingKey === key;

        return (
          <div
            key={key}
            className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-secondary)]"
          >
            <Icon
              path={mdiServerNetwork}
              size={0.55}
              className={`shrink-0 ${server.isLocal ? "text-blue-400" : "text-purple-400"}`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                {server.host}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                :{server.port} · v{server.version}
              </div>
            </div>

            {alreadyKnown ? (
              <span className="text-xs text-green-500 shrink-0">Already added</span>
            ) : isAdding ? (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="Label"
                  className="w-28 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmAdd(server);
                    if (e.key === "Escape") handleCancelAdd();
                  }}
                />
                <button
                  onClick={() => handleConfirmAdd(server)}
                  className="text-green-400 hover:text-green-300 cursor-pointer p-0.5"
                  title="Confirm"
                >
                  <Icon path={mdiCheck} size={0.45} />
                </button>
                <button
                  onClick={handleCancelAdd}
                  className="text-[var(--text-muted)] hover:text-red-400 cursor-pointer p-0.5"
                  title="Cancel"
                >
                  <Icon path={mdiClose} size={0.45} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleStartAdd(server)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 cursor-pointer"
              >
                <Icon path={mdiPlus} size={0.45} />
                Add
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
