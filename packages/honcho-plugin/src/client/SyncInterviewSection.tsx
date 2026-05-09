/**
 * Sync + Interview section.
 * Tasks 6.10 + 6.11.
 */
import React, { useState } from "react";
import Icon from "@mdi/react";
import { mdiSync, mdiBrain, mdiLoading } from "@mdi/js";
import { triggerSync, submitInterview } from "./api.js";

export function SyncInterviewSection() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [interviewText, setInterviewText] = useState("");
  const [interviewing, setInterviewing] = useState(false);
  const [interviewResult, setInterviewResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await triggerSync();
      setSyncResult(r.ok ? `Forwarded to ${r.forwarded} session(s)` : "Sync failed");
    } catch (e: any) {
      setSyncResult(e.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleInterview = async () => {
    if (!interviewText.trim()) return;
    setInterviewing(true);
    setInterviewResult(null);
    try {
      const r = await submitInterview(interviewText.trim());
      if (r.ok) {
        setInterviewResult("Preference saved");
        setInterviewText("");
      } else {
        setInterviewResult(r.error ?? "Interview failed");
      }
    } catch (e: any) {
      setInterviewResult(e.message ?? "Interview failed");
    } finally {
      setInterviewing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Sync */}
      <fieldset className="space-y-1">
        <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Sync
        </legend>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs px-3 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)] disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Icon path={syncing ? mdiLoading : mdiSync} size={0.5} spin={syncing} />
          {syncing ? "Syncing…" : "Force refresh"}
        </button>
        {syncResult && (
          <div className="text-xs text-[var(--text-muted)]">{syncResult}</div>
        )}
      </fieldset>

      {/* Interview */}
      <fieldset className="space-y-1">
        <legend className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Interview — Save a preference
        </legend>
        <div className="flex gap-2">
          <input
            type="text"
            value={interviewText}
            onChange={(e) => setInterviewText(e.target.value)}
            placeholder="e.g. I prefer TypeScript over JavaScript"
            className="flex-1 bg-[var(--bg-secondary)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleInterview()}
          />
          <button
            onClick={handleInterview}
            disabled={interviewing || !interviewText.trim()}
            className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {/* mdiBrain at 0.6 to match mdiLoading at 0.5 visually (brain viewbox padding). */}
            <Icon
              path={interviewing ? mdiLoading : mdiBrain}
              size={interviewing ? 0.5 : 0.6}
              spin={interviewing}
            />
            Save
          </button>
        </div>
        {interviewResult && (
          <div className="text-xs text-[var(--text-muted)]">{interviewResult}</div>
        )}
      </fieldset>
    </div>
  );
}
