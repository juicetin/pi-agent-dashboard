/**
 * System tray integration.
 * Minimizes to tray on window close, with Show/Quit context menu.
 */
import { Tray, Menu, nativeImage, type BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;

/**
 * Create the system tray icon with context menu.
 * The `onQuit` callback is invoked when the user explicitly quits.
 */
export function createTray(
  getWindow: () => BrowserWindow | null,
  onQuit: () => void,
): Tray {
  // Use a small template image (16x16). On macOS, template images auto-adapt to dark/light.
  // For now, use a simple text-based tray icon.
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("PI Dashboard");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        const win = getWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: onQuit,
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    const win = getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
