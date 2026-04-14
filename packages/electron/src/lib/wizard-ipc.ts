/**
 * IPC handlers for the first-run wizard.
 * Registered in the main process, called from the wizard renderer via preload bridge.
 */
import { ipcMain, type BrowserWindow } from "electron";
import { detectPi, detectOpenSpec, detectDashboardPackage, detectSystemNode } from "./dependency-detector.js";
import { installStandalone, installDashboardGlobal } from "./dependency-installer.js";
import { readModeFile, writeModeFile, isApiKeyConfigured, writeApiKey } from "./wizard-state.js";

/**
 * Register all wizard IPC handlers. Call once from main.ts.
 */
export function registerWizardIpc(getWizardWindow: () => BrowserWindow | null): void {
  ipcMain.handle("wizard:detect", async () => {
    const [pi, openspec, dashboard, node] = await Promise.all([
      Promise.resolve(detectPi()),
      Promise.resolve(detectOpenSpec()),
      Promise.resolve(detectDashboardPackage()),
      Promise.resolve(detectSystemNode()),
    ]);
    return {
      pi: { found: pi.found, source: pi.source },
      openspec: { found: openspec.found, source: openspec.source },
      dashboard: { found: dashboard.found, source: dashboard.source },
      node: { found: node.found, source: node.source },
      apiKeyConfigured: isApiKeyConfigured(),
    };
  });

  ipcMain.handle("wizard:install-standalone", async () => {
    const win = getWizardWindow();
    await installStandalone((progress) => {
      win?.webContents.send("wizard:progress", progress);
    });
  });

  ipcMain.handle("wizard:install-dashboard-global", async () => {
    const win = getWizardWindow();
    await installDashboardGlobal((progress) => {
      win?.webContents.send("wizard:progress", progress);
    });
  });

  ipcMain.handle("wizard:save-api-key", async (_event, provider: string, key: string) => {
    writeApiKey(provider, key);
  });

  ipcMain.handle("wizard:complete", async (_event, mode: "standalone" | "power-user") => {
    writeModeFile(mode);
  });
}
