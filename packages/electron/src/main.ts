/**
 * Electron main process entry point.
 *
 * Responsibilities:
 * 1. Single-instance lock
 * 2. Discover or launch dashboard server (mDNS → health check → spawn)
 * 3. Open BrowserWindow pointing at the server URL
 * 4. System tray integration (minimize on close, Show/Quit menu)
 * 5. First-run wizard (if ~/.pi-dashboard/mode.json is missing)
 *
 * The dashboard server always runs as a separate detached process.
 * Electron is a smart window + server bootstrapper.
 */

import { app, BrowserWindow } from "electron";

// Placeholder — will be implemented in tasks 5.x and 6.x
async function createWindow(serverUrl: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: __dirname + "/preload.js",
    },
  });

  await win.loadURL(serverUrl);
  return win;
}

async function main(): Promise<void> {
  // Single-instance lock
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  await app.whenReady();

  // TODO: First-run wizard (task 5.8)
  // TODO: Server discovery (task 6.1)
  const serverUrl = process.env.ELECTRON_DEV
    ? "http://localhost:8000"
    : "http://localhost:8000"; // Will be resolved via mDNS/health check

  await createWindow(serverUrl);
}

main().catch((err) => {
  console.error("Failed to start:", err);
  app.quit();
});
