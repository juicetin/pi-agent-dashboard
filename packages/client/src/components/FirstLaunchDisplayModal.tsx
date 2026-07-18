/**
 * One-shot first-launch modal. Opens when `GET /api/preferences/display`
 * returns `{ displayPrefs: undefined }` on first mount. User picks one of
 * three presets (`simple` | `standard` | `everything`); on dismiss the
 * client PATCHes `standard` so the modal does not re-open.
 *
 * `seed()` closes only after the PATCH response confirms the persisted
 * `displayPrefs`. Failed or incompatible responses leave the selected preset
 * in place and show an actionable error.
 *
 * See change: configurable-chat-display, fix-first-launch-display-modal-stuck-on-mobile.
 */

import { DISPLAY_PRESETS, type DisplayPrefs } from "@blackbelt-technology/pi-dashboard-shared/display-prefs.js";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { t as i18nT } from "../lib/i18n";
import { DialogPortal } from "./DialogPortal.js";

type PresetKey = keyof typeof DISPLAY_PRESETS;

const OPTIONS: Array<{ key: PresetKey; label: string; description: string }> = [
  { key: "simple", label: "Simple", description: "Just messages — hide reasoning, tool calls, stats." },
  { key: "standard", label: "Standard", description: "Show tools, results, stats. Hide chain-of-thought." },
  { key: "everything", label: "Show everything", description: "All signals visible, including reasoning and debug." },
];

export function FirstLaunchDisplayModal({
  apiBase,
  onClose,
}: {
  apiBase: string;
  onClose: (prefs: DisplayPrefs) => void;
}): React.ReactElement {
  const [choice, setChoice] = useState<PresetKey>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const seed = useCallback(async (key: PresetKey) => {
    setSubmitting(true);
    setError(false);
    try {
      const r = await fetch(`${apiBase}/api/preferences/display`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DISPLAY_PRESETS[key] as DisplayPrefs),
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      const body = await r.json() as { displayPrefs?: DisplayPrefs };
      if (
        !body.displayPrefs ||
        typeof body.displayPrefs.tokenStatsBar !== "boolean" ||
        !body.displayPrefs.toolCalls ||
        Array.isArray(body.displayPrefs.toolCalls)
      ) {
        throw new Error();
      }
      onClose(body.displayPrefs);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }, [apiBase, onClose]);

  // Dismissal (Esc / backdrop) seeds `standard` — same as picking it.
  const dismiss = useCallback(() => {
    if (!submitting) void seed("standard");
  }, [seed, submitting]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={dismiss}
        data-testid="first-launch-display-backdrop"
      >
        <div
          role="dialog"
          aria-labelledby="first-launch-display-title"
          className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="first-launch-display-title" className="text-base font-semibold text-[var(--text-primary)] mb-2">
            {i18nT("session.howMuchShouldTheChatView", undefined, "How much should the chat view show?")}
          </h2>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">
            {i18nT("common.youCanChangeThisAnyTime", undefined, "You can change this any time in Settings ▸ General ▸ Chat display.")}
          </p>
          <div className="space-y-2">
            {OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className={`flex items-start gap-2 p-3 rounded border cursor-pointer hover:bg-[var(--bg-hover)] ${
                  choice === opt.key
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                <input
                  type="radio"
                  name="display-preset"
                  value={opt.key}
                  checked={choice === opt.key}
                  onChange={() => setChoice(opt.key)}
                  className="mt-0.5 accent-blue-500"
                />
                <span>
                  <div className="text-sm text-[var(--text-primary)] font-medium">{opt.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{opt.description}</div>
                </span>
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-xs text-red-400">
              {i18nT(
                "session.chatDisplaySaveFailed",
                undefined,
                "Couldn't save this preference. Check your connection and dashboard version, then try again.",
              )}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              disabled={submitting}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {i18nT("common.skip", undefined, "Skip")}
            </button>
            <button
              type="button"
              onClick={() => void seed(choice)}
              disabled={submitting}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {i18nT("common.continue", undefined, "Continue")}
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
