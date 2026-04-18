/**
 * Platform-specific Electron app lifecycle tweaks.
 *
 * Handles:
 *   - Linux: enable auto ozone-platform-hint (required for Wayland sessions)
 *   - macOS: "close = hide to tray" instead of quit (dock-hide behavior)
 *   - non-macOS: quit when last window closes
 *
 * Each tweak is a small pure-ish function so callers can compose them
 * without the inline `if (process.platform === ...)` noise in main.ts.
 *
 * See change: consolidate-platform-handlers.
 */
import type { App, BrowserWindow } from "electron";

export interface LifecycleOpts {
  /** Override platform (defaults to process.platform). */
  platform?: NodeJS.Platform;
  /** Override env (defaults to process.env). */
  env?: NodeJS.ProcessEnv;
}

/**
 * Configure the ozone-platform hint on Linux so Electron picks the right
 * windowing backend (X11 vs Wayland). No-op on other platforms. Must be
 * called BEFORE `app.whenReady()` to take effect.
 */
export function configureLinuxOzoneHint(app: App, opts: LifecycleOpts = {}): void {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  if (platform === "linux" && !env.ELECTRON_OZONE_PLATFORM_HINT) {
    app.commandLine.appendSwitch("ozone-platform-hint", "auto");
  }
}

/**
 * Install a `window.close` handler that hides the window to the system
 * tray instead of quitting on macOS. The caller passes `isQuittingRef`
 * (a getter returning true when the user has explicitly quit via the
 * tray menu) so we know when to actually let the window close.
 */
export function installDarwinHideOnClose(
  window: BrowserWindow,
  isQuittingRef: () => boolean,
  opts: LifecycleOpts = {},
): void {
  const platform = opts.platform ?? process.platform;
  if (platform !== "darwin") return;
  window.on("close", (event) => {
    if (!isQuittingRef()) {
      event.preventDefault();
      window.hide();
    }
  });
}

/**
 * Predicate: should the app quit when the last window closes?
 * Windows/Linux: yes. macOS: no (the dock keeps the app alive).
 */
export function shouldQuitOnAllWindowsClosed(opts: LifecycleOpts = {}): boolean {
  const platform = opts.platform ?? process.platform;
  return platform !== "darwin";
}
