/**
 * Connection section — apiKey, peerName, workspace, aiPeer, endpoint, linkedHosts, sessionStrategy.
 * Task 6.5.
 */
import React, { useState, useEffect } from "react";
import type { RedactedHonchoPluginConfig, HonchoPluginConfig, SessionStrategy } from "../shared/types.js";

const SESSION_STRATEGIES: SessionStrategy[] = [
  "per-directory",
  "git-branch",
  "pi-session",
  "per-repo",
  "global",
];

interface Props {
  config: RedactedHonchoPluginConfig;
  onSave: (partial: Partial<HonchoPluginConfig>) => Promise<void>;
  saving: boolean;
}

export function ConnectionSection({ config, onSave, saving }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [peerName, setPeerName] = useState(config.peerName ?? "");
  const [workspace, setWorkspace] = useState(config.workspace ?? "");
  const [aiPeer, setAiPeer] = useState(config.aiPeer ?? "");
  const [endpoint, setEndpoint] = useState(config.hosts?.pi?.endpoint ?? "");
  const [linkedHosts, setLinkedHosts] = useState(config.linkedHosts ?? "");
  const [sessionStrategy, setSessionStrategy] = useState<SessionStrategy>(
    config.hosts?.pi?.sessionStrategy ?? "per-directory",
  );

  // Sync from config on refresh
  useEffect(() => {
    setPeerName(config.peerName ?? "");
    setWorkspace(config.workspace ?? "");
    setAiPeer(config.aiPeer ?? "");
    setEndpoint(config.hosts?.pi?.endpoint ?? "");
    setLinkedHosts(config.linkedHosts ?? "");
    setSessionStrategy(config.hosts?.pi?.sessionStrategy ?? "per-directory");
  }, [config]);

  const handleSave = () => {
    const partial: Partial<HonchoPluginConfig> = {
      peerName,
      workspace,
      aiPeer,
      linkedHosts,
      hosts: {
        pi: {
          endpoint,
          sessionStrategy,
        },
      },
    };
    // Only send apiKey if the user typed a new one
    if (apiKey) {
      partial.apiKey = apiKey;
    }
    onSave(partial);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Connection
      </legend>

      {/* API Key */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">API Key</span>
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.apiKeySet ? config.apiKeyMasked ?? "••••" : "Not set"}
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
        />
        <button
          onClick={() => setShowKey(!showKey)}
          className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs"
        >
          {showKey ? "Hide" : "Show"}
        </button>
      </label>

      {/* Peer Name */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">Peer Name</span>
        <input
          type="text"
          value={peerName}
          onChange={(e) => setPeerName(e.target.value)}
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
        />
      </label>

      {/* Workspace */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">Workspace</span>
        <input
          type="text"
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
        />
      </label>

      {/* AI Peer */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">AI Peer</span>
        <input
          type="text"
          value={aiPeer}
          onChange={(e) => setAiPeer(e.target.value)}
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
        />
      </label>

      {/* Endpoint */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">Endpoint</span>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://api.honcho.dev"
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
        />
      </label>

      {/* Linked Hosts */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">Linked Hosts</span>
        <input
          type="text"
          value={linkedHosts}
          onChange={(e) => setLinkedHosts(e.target.value)}
          placeholder="host1, host2"
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
        />
      </label>

      {/* Session Strategy */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-28 text-[var(--text-muted)]">Session Strategy</span>
        <select
          value={sessionStrategy}
          onChange={(e) => setSessionStrategy(e.target.value as SessionStrategy)}
          className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
        >
          {SESSION_STRATEGIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Connection"}
      </button>
    </fieldset>
  );
}
