/**
 * Creates and manages the first-run wizard window.
 */
import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let wizardWindow: BrowserWindow | null = null;

/**
 * Open the first-run wizard window.
 * Returns a promise that resolves when the wizard is closed.
 */
export function openWizardWindow(): Promise<void> {
  return new Promise((resolve) => {
    wizardWindow = new BrowserWindow({
      width: 640,
      height: 520,
      resizable: false,
      titleBarStyle: "hiddenInset",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "preload.js"),
      },
    });

    const wizardHtml = path.join(__dirname, "..", "renderer", "wizard.html");
    wizardWindow.loadFile(wizardHtml);

    wizardWindow.on("closed", () => {
      wizardWindow = null;
      resolve();
    });
  });
}

export function getWizardWindow(): BrowserWindow | null {
  return wizardWindow;
}
