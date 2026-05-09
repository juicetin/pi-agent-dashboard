/**
 * Mode picker — cloud / self-host toggle.
 * Task 6.7. On switch, POSTs config update with auto-set endpoint per design D5.
 */
import React from "react";
import Icon from "@mdi/react";
import { mdiCloudOutline, mdiServer } from "@mdi/js";
import type { RedactedHonchoPluginConfig, HonchoPluginConfig } from "../shared/types.js";

interface Props {
  config: RedactedHonchoPluginConfig;
  onSave: (partial: Partial<HonchoPluginConfig>) => Promise<void>;
  saving: boolean;
}

export function ModeSection({ config, onSave, saving }: Props) {
  const current = config.mode ?? "cloud";

  const handleChange = (mode: "cloud" | "self-host") => {
    // Endpoint auto-set is handled server-side in routes-config.ts (D5).
    onSave({ mode });
  };

  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Mode
      </legend>
      <div className="flex gap-4">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio"
            name="honchoMode"
            value="cloud"
            checked={current === "cloud"}
            onChange={() => handleChange("cloud")}
            disabled={saving}
            className="accent-blue-500"
          />
          <span className="text-[var(--text)] inline-flex items-center gap-1">
            <Icon path={mdiCloudOutline} size={0.5} /> Cloud (honcho.dev)
          </span>
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio"
            name="honchoMode"
            value="self-host"
            checked={current === "self-host"}
            onChange={() => handleChange("self-host")}
            disabled={saving}
            className="accent-blue-500"
          />
          <span className="text-[var(--text)] inline-flex items-center gap-1">
            <Icon path={mdiServer} size={0.5} /> Self-host (Docker)
          </span>
        </label>
      </div>
    </fieldset>
  );
}
