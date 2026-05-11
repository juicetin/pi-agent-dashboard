/**
 * Banner rendering the server-side bootstrap-install status.
 *
 *   status === "ready"      \u2192 hidden (or a small upgrade-recommended hint).
 *   status === "installing" \u2192 "Installing pi\u2026" with progress line.
 *   status === "failed"     \u2192 "Install failed" with [Retry] button.
 *
 * Mounted above the main layout in App.tsx so the message is visible
 * regardless of the current route.
 *
 * See change: unified-bootstrap-install \u00a76.
 */
import React, { useState } from "react";
import { Icon } from "@mdi/react";
import { mdiDownload, mdiAlert, mdiInformationOutline, mdiPackageVariantRemove } from "@mdi/js";
import type { BootstrapStateSnapshot } from "@blackbelt-technology/pi-dashboard-shared/browser-protocol.js";

interface Props {
  state: BootstrapStateSnapshot | null;
  onRetry?: () => void;
  onCleanupLegacyPi?: () => Promise<
    | { ok: true; results: Array<{ scope: string; path: string; removed: boolean; error?: string }>; remaining: unknown[] }
    | { ok: false; error: string }
  >;
}

function LegacyPiBanner({
  installs,
  onCleanup,
}: {
  installs: NonNullable<BootstrapStateSnapshot["legacyPiInstalls"]>;
  onCleanup?: Props["onCleanupLegacyPi"];
}): React.ReactElement {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopes = Array.from(new Set(installs.map((i) => i.scope))).join(", ");
  const versions = Array.from(new Set(installs.map((i) => i.version).filter(Boolean))).join(", ");
  return (
    <div
      data-testid="bootstrap-banner-legacy-pi"
      className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-sm"
    >
      <Icon path={mdiPackageVariantRemove} size={0.7} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div>
          Legacy <strong>@mariozechner/pi-coding-agent</strong>
          {versions ? ` (${versions})` : ""} detected in <em>{scopes}</em>.
          The package was renamed to <strong>@earendil-works/pi-coding-agent</strong> at v0.74 and the legacy install can conflict with the new bin.
        </div>
        <div className="mt-1 flex items-center gap-2">
          <button
            data-testid="bootstrap-banner-legacy-cleanup"
            disabled={running || !onCleanup}
            onClick={async () => {
              if (!onCleanup) return;
              setRunning(true);
              setError(null);
              const r = await onCleanup();
              setRunning(false);
              if (!r.ok) setError(r.error);
            }}
            className="text-xs px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {running ? "Removing\u2026" : `Remove legacy pi (${installs.length})`}
          </button>
          {error && <span className="text-xs text-red-300">{error}</span>}
        </div>
      </div>
    </div>
  );
}

export function BootstrapBanner({ state, onRetry, onCleanupLegacyPi }: Props): React.ReactElement | null {
  if (!state) return null;

  // Legacy pi cleanup banner takes precedence over upgrade-recommended hint,
  // because cleanup is required before upgrade-pi can succeed (EEXIST on
  // /usr/local/bin/pi symlink).
  const legacy = state.legacyPiInstalls ?? [];
  if (legacy.length > 0 && state.status === "ready") {
    return <LegacyPiBanner installs={legacy} onCleanup={onCleanupLegacyPi} />;
  }

  // Ready + version upgrade hint.
  if (state.status === "ready") {
    if (state.compatibility?.upgradeRecommended) {
      return (
        <div
          data-testid="bootstrap-banner-upgrade-hint"
          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-sm"
        >
          <Icon path={mdiInformationOutline} size={0.7} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            A newer version of <strong>@mariozechner/pi-coding-agent</strong> is recommended
            {state.compatibility.current ? ` (you have ${state.compatibility.current})` : ""}.
          </div>
        </div>
      );
    }
    if (state.compatibility?.upgradeDashboard) {
      return (
        <div
          data-testid="bootstrap-banner-upgrade-dashboard"
          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-sm"
        >
          <Icon path={mdiInformationOutline} size={0.7} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            Your pi version ({state.compatibility.current}) exceeds the dashboard's tested range.
            Consider upgrading pi-dashboard.
          </div>
        </div>
      );
    }
    return null;
  }

  if (state.status === "installing") {
    const progress = state.progress;
    return (
      <div
        data-testid="bootstrap-banner-installing"
        className="flex items-center gap-2 px-3 py-2 bg-blue-600/90 text-white text-sm"
      >
        <Icon path={mdiDownload} size={0.7} className="flex-shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div>
            <strong>Installing pi\u2026</strong> sessions will be available shortly.
          </div>
          {progress && (
            <div className="mt-0.5 text-xs opacity-90 truncate">
              {progress.step}
              {progress.output ? `: ${progress.output}` : ""}
            </div>
          )}
        </div>
      </div>
    );
  }

  // status === "failed"
  return (
    <div
      data-testid="bootstrap-banner-failed"
      className="flex items-start gap-2 px-3 py-2 bg-red-600/90 text-white text-sm"
    >
      <Icon path={mdiAlert} size={0.7} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div>
          <strong>pi install failed.</strong>{" "}
          {state.error?.message ?? "Check server logs for details."}
        </div>
        <div className="mt-1">
          {onRetry && (
            <button
              data-testid="bootstrap-banner-retry"
              onClick={onRetry}
              className="text-xs px-2 py-0.5 rounded bg-white/20 hover:bg-white/30"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
