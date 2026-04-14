/**
 * IPC handlers for the first-run wizard.
 * Registered in the main process, called from the wizard renderer via preload bridge.
 */
import { ipcMain, type BrowserWindow } from "electron";
import { detectPi, detectOpenSpec, detectDashboardPackage, detectSystemNode, detectBridgeExtension, detectPiDashboardCli } from "./dependency-detector.js";
import { installStandalone, installDashboardGlobal } from "./dependency-installer.js";
import { readModeFile, writeModeFile, isApiKeyConfigured, writeApiKey } from "./wizard-state.js";
import { registerBundledBridgeExtension } from "./bridge-register.js";

/**
 * Register all wizard IPC handlers. Call once from main.ts.
 */
export function registerWizardIpc(getWizardWindow: () => BrowserWindow | null): void {
  ipcMain.handle("wizard:detect", async () => {
    const [pi, openspec, dashboard, node, bridge, piDashboardCli] = await Promise.all([
      Promise.resolve(detectPi()),
      Promise.resolve(detectOpenSpec()),
      Promise.resolve(detectDashboardPackage()),
      Promise.resolve(detectSystemNode()),
      Promise.resolve(detectBridgeExtension()),
      Promise.resolve(detectPiDashboardCli()),
    ]);
    return {
      pi: { found: pi.found, source: pi.source },
      openspec: { found: openspec.found, source: openspec.source },
      dashboard: { found: dashboard.found, source: dashboard.source },
      node: { found: node.found, source: node.source },
      bridge: { found: bridge.found, source: bridge.source },
      piDashboardCli: { found: piDashboardCli.found, source: piDashboardCli.source },
      apiKeyConfigured: isApiKeyConfigured(),
    };
  });

  ipcMain.handle("wizard:install-standalone", async (_event, skipPackages?: string[]) => {
    const win = getWizardWindow();
    await installStandalone((progress) => {
      win?.webContents.send("wizard:progress", progress);
    }, skipPackages);
  });

  ipcMain.handle("wizard:install-dashboard-global", async () => {
    const win = getWizardWindow();
    await installDashboardGlobal((progress) => {
      win?.webContents.send("wizard:progress", progress);
    });
  });

  ipcMain.handle("wizard:register-bundled-bridge", async () => {
    registerBundledBridgeExtension();
  });

  ipcMain.handle("wizard:save-api-key", async (_event, provider: string, key: string) => {
    writeApiKey(provider, key);
  });

  ipcMain.handle("wizard:complete", async (_event, mode: "standalone" | "power-user") => {
    writeModeFile(mode);
    // Power-user: ensure the bundled bridge extension is registered in pi's settings
    if (mode === "power-user") {
      try {
        registerBundledBridgeExtension();
      } catch { /* non-fatal — server will re-register on start */ }
    }
  });
}
