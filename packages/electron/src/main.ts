/**
 * Electron main process entry point.
 *
 * Flow:
 * 1. Single-instance lock
 * 2. First-run wizard (if ~/.pi-dashboard/mode.json is missing)
 * 3. Discover or launch dashboard server (mDNS → health check → spawn)
 * 4. Open BrowserWindow pointing at the server URL
 * 5. System tray (minimize on close, Show/Quit menu)
 */

import { app, BrowserWindow, dialog } from "electron";
import { isFirstRun } from "./lib/wizard-state.js";
import { openWizardWindow, getWizardWindow } from "./lib/wizard-window.js";
import { registerWizardIpc } from "./lib/wizard-ipc.js";
import { ensureServer, stopServerIfNeeded, didWeStartServer } from "./lib/server-lifecycle.js";
import { loadWindowState, saveWindowState } from "./lib/window-state.js";
import { createTray, destroyTray } from "./lib/tray.js";
import { startUpdateChecker } from "./lib/update-checker.js";
import { notifyUpdatesAvailable } from "./lib/update-notifier.js";
import { initAutoUpdater, quitAndInstall } from "./lib/app-updater.js";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let cleanupUpdateChecker: (() => void) | null = null;
let cleanupAutoUpdater: (() => void) | null = null;

function createMainWindow(serverUrl: string): BrowserWindow {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (state.isMaximized) mainWindow.maximize();

  mainWindow.loadURL(serverUrl);

  // Save window state on resize/move
  mainWindow.on("resize", () => mainWindow && saveWindowState(mainWindow));
  mainWindow.on("move", () => mainWindow && saveWindowState(mainWindow));

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function startUpdaters(): void {
  // Dependency updates (pi, openspec)
  cleanupUpdateChecker = startUpdateChecker(notifyUpdatesAvailable);

  // App self-update (electron-updater + GitHub Releases)
  cleanupAutoUpdater = initAutoUpdater({
    onUpdateAvailable: (version) => {
      dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: `PI Dashboard v${version} is available.`,
        buttons: ["Download & Restart", "Later"],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) quitAndInstall();
      });
    },
    onUpdateDownloaded: (version) => {
      dialog.showMessageBox({
        type: "info",
        title: "Update Ready",
        message: `PI Dashboard v${version} has been downloaded. Restart to apply.`,
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) quitAndInstall();
      });
    },
    onError: () => { /* silently ignore update errors */ },
  });
}

async function quit(): Promise<void> {
  isQuitting = true;
  cleanupUpdateChecker?.();
  cleanupAutoUpdater?.();
  await stopServerIfNeeded();
  destroyTray();
  app.quit();
}

async function main(): Promise<void> {
  // Single-instance lock
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  await app.whenReady();

  // Register wizard IPC handlers
  registerWizardIpc(getWizardWindow);

  // First-run wizard
  if (isFirstRun()) {
    await openWizardWindow();
    // After wizard closes, re-check — user might have cancelled
    if (isFirstRun()) {
      app.quit();
      return;
    }
  }

  // Dev mode: skip discovery
  if (process.env.ELECTRON_DEV) {
    createMainWindow("http://localhost:8000");
    createTray(() => mainWindow, quit);
    startUpdaters();
    return;
  }

  // Discover or launch server
  let serverUrl: string;
  try {
    serverUrl = await ensureServer();
  } catch (err: any) {
    dialog.showErrorBox("PI Dashboard", err.message);
    app.quit();
    return;
  }

  createMainWindow(serverUrl);
  createTray(() => mainWindow, quit);
  startUpdaters();
}

// macOS: re-create window when dock icon clicked
app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

main().catch((err) => {
  console.error("Failed to start:", err);
  app.quit();
});
