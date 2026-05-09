/**
 * Honcho settings panel — settings-section slot (tab=general).
 *
 * Gates on extension install. When installed, renders:
 *   - Status header (mode, state, endpoint, cacheChars, sessionKey)
 *   - Connection section (apiKey, peerName, workspace, aiPeer, endpoint, linkedHosts, sessionStrategy)
 *   - Recall section (recallMode radio)
 *   - Mode picker (cloud / self-host)
 *   - Server section (self-host only: start/stop/restart, autoStart, ports, storageBackend)
 *   - LLM section (self-host only: model dropdown)
 *   - Doctor / Sync / Interview
 *   - Advanced collapsible
 */
import React, { useState, useCallback } from "react";
import { usePluginConfig } from "@blackbelt-technology/dashboard-plugin-runtime/context";
import { useExtensionInstalled, useHonchoConfig, useHonchoStatus } from "./hooks.js";
import { InstallGate } from "./InstallGate.js";
import { StatusHeader } from "./StatusHeader.js";
import { ConnectionSection } from "./ConnectionSection.js";
import { RecallSection } from "./RecallSection.js";
import { ModeSection } from "./ModeSection.js";
import { ServerSection } from "./ServerSection.js";
import { LlmSection } from "./LlmSection.js";
import { DoctorSection } from "./DoctorSection.js";
import { SyncInterviewSection } from "./SyncInterviewSection.js";
import { AdvancedSection } from "./AdvancedSection.js";
import { DockerMissingCallout } from "./DockerMissingCallout.js";
import { PortOverrideNotice } from "./PortOverrideNotice.js";
import { saveConfig } from "./api.js";
import type { HonchoPluginConfig, RedactedHonchoPluginConfig } from "../shared/types.js";

export function HonchoSettings() {
  const { installed, checking, recheck } = useExtensionInstalled();
  const { config, loading, refresh } = useHonchoConfig();
  const { status, refresh: refreshStatus } = useHonchoStatus();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (partial: Partial<HonchoPluginConfig>) => {
      setSaving(true);
      setSaveError(null);
      try {
        await saveConfig(partial);
        await refresh();
        await refreshStatus();
      } catch (e: any) {
        setSaveError(e.message ?? "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [refresh, refreshStatus],
  );

  if (checking || loading) {
    return (
      <div className="text-[var(--text-muted)] text-sm py-2">
        Loading Honcho settings…
      </div>
    );
  }

  if (!installed) {
    return <InstallGate onInstalled={recheck} />;
  }

  if (!config) {
    return (
      <div className="text-[var(--text-muted)] text-sm py-2">
        Could not load Honcho config.
      </div>
    );
  }

  const isSelfHost = config.mode === "self-host";

  return (
    <div className="space-y-4">
      <StatusHeader status={status} config={config} />

      {saveError && (
        <div className="text-red-400 text-xs bg-red-900/20 rounded px-2 py-1">
          {saveError}
        </div>
      )}

      <ConnectionSection config={config} onSave={handleSave} saving={saving} />
      <RecallSection config={config} onSave={handleSave} saving={saving} />
      <ModeSection config={config} onSave={handleSave} saving={saving} />

      {status?.state === "docker-missing" && <DockerMissingCallout />}
      <PortOverrideNotice config={config} />

      {isSelfHost && (
        <>
          <ServerSection config={config} status={status} onSave={handleSave} saving={saving} onRefreshStatus={refreshStatus} />
          <LlmSection config={config} onSave={handleSave} saving={saving} />
        </>
      )}

      <DoctorSection />
      <SyncInterviewSection />
      <AdvancedSection config={config} onSave={handleSave} saving={saving} />
    </div>
  );
}
