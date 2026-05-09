/**
 * Doctor section — runs preflight checks and displays results.
 * Task 6.9.
 */
import React, { useState } from "react";
import Icon from "@mdi/react";
import {
  mdiCheckCircle,
  mdiAlert,
  mdiCloseCircle,
  mdiHeartPulse,
  mdiLoading,
} from "@mdi/js";
import { runDoctor } from "./api.js";
import type { DoctorCheck } from "../shared/types.js";

const STATUS_ICON: Record<string, { path: string; color: string }> = {
  ok:   { path: mdiCheckCircle, color: "rgb(134, 239, 172)" },
  warn: { path: mdiAlert,       color: "rgb(253, 224, 71)"  },
  fail: { path: mdiCloseCircle, color: "rgb(252, 165, 165)" },
};

export function DoctorSection() {
  const [checks, setChecks] = useState<DoctorCheck[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runDoctor();
      setChecks(result.checks);
    } catch (e: any) {
      setError(e.message ?? "Doctor failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Diagnostics
      </legend>
      <button
        onClick={handleRun}
        disabled={running}
        className="text-xs px-3 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)] disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        <Icon
          path={running ? mdiLoading : mdiHeartPulse}
          size={0.5}
          spin={running}
        />
        {running ? "Running…" : "Run preflight"}
      </button>
      {error && <div className="text-red-400 text-xs">{error}</div>}
      {checks && (
        <div className="space-y-0.5">
          {checks.map((c) => {
            const ic = STATUS_ICON[c.status];
            return (
              <div key={c.id} className="flex items-start gap-1.5 text-xs">
                {ic ? (
                  <Icon
                    path={ic.path}
                    size={0.5}
                    color={ic.color}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                ) : (
                  <span>•</span>
                )}
                <span className="text-[var(--text)]">{c.id}</span>
                {c.detail && (
                  <span className="text-[var(--text-muted)]">— {c.detail}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
