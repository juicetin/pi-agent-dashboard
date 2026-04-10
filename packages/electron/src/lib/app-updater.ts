/**
 * Electron app auto-updater using electron-updater + GitHub Releases.
 * Checks on launch and every 24 hours.
 */

// electron-updater is a runtime dependency that only works in packaged apps.
// In dev mode, we skip it entirely.

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

export interface AppUpdateCallbacks {
  onUpdateAvailable: (version: string) => void;
  onUpdateDownloaded: (version: string) => void;
  onError: (error: Error) => void;
}

let intervalTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the auto-updater. Only works in packaged Electron apps.
 * Returns a cleanup function.
 */
export function initAutoUpdater(callbacks: AppUpdateCallbacks): () => void {
  // Skip in dev mode
  if (process.env.ELECTRON_DEV || !(process as any).resourcesPath) {
    return () => {};
  }

  let autoUpdater: any;
  try {
    // Dynamic import to avoid crashes in dev mode where electron-updater isn't available
    autoUpdater = require("electron-updater").autoUpdater;
  } catch {
    return () => {};
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info: any) => {
    callbacks.onUpdateAvailable(info.version);
  });

  autoUpdater.on("update-downloaded", (info: any) => {
    callbacks.onUpdateDownloaded(info.version);
  });

  autoUpdater.on("error", (err: Error) => {
    callbacks.onError(err);
  });

  // Initial check after 60s
  const initialTimer = setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 60_000);

  // Periodic check
  intervalTimer = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL_MS);

  return () => {
    clearTimeout(initialTimer);
    if (intervalTimer) clearInterval(intervalTimer);
  };
}

/**
 * Download and install the pending update.
 * The app will restart after installation.
 */
export function downloadAndInstall(): void {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.downloadUpdate();
    // After download completes, autoInstallOnAppQuit will handle restart
  } catch { /* not available */ }
}

/**
 * Quit and install the downloaded update immediately.
 */
export function quitAndInstall(): void {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.quitAndInstall();
  } catch { /* not available */ }
}
