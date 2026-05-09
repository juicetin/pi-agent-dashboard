/**
 * Recall section — recallMode radio (hybrid / context / tools).
 * Task 6.6.
 */
import React from "react";
import type { RedactedHonchoPluginConfig, HonchoPluginConfig, RecallMode } from "../shared/types.js";

const RECALL_MODES: { value: RecallMode; label: string }[] = [
  { value: "hybrid", label: "Hybrid" },
  { value: "context", label: "Context only" },
  { value: "tools", label: "Tools only" },
];

interface Props {
  config: RedactedHonchoPluginConfig;
  onSave: (partial: Partial<HonchoPluginConfig>) => Promise<void>;
  saving: boolean;
}

export function RecallSection({ config, onSave, saving }: Props) {
  const current = config.hosts?.pi?.recallMode ?? "hybrid";

  const handleChange = (mode: RecallMode) => {
    onSave({ hosts: { pi: { recallMode: mode } } });
  };

  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Recall Mode
      </legend>
      <div className="flex gap-4">
        {RECALL_MODES.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="radio"
              name="recallMode"
              value={value}
              checked={current === value}
              onChange={() => handleChange(value)}
              disabled={saving}
              className="accent-blue-500"
            />
            <span className="text-[var(--text)]">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
