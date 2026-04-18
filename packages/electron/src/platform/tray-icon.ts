/**
 * Platform-specific tray icon selection.
 *
 * macOS uses "template" images that auto-adapt to the menu bar's light/dark
 * theme. Windows uses the `.ico` format for proper scaling in the system
 * tray. Linux uses the standard `.png` app icon.
 *
 * See change: consolidate-platform-handlers.
 */
import { nativeImage, type NativeImage } from "electron";

export interface TrayIconOpts {
  /** Resolver that turns a bundled-resource filename into an absolute path. */
  resourcePath: (filename: string) => string;
  /** Override platform (defaults to process.platform). */
  platform?: NodeJS.Platform;
}

/**
 * Resolve the correct system tray icon for the current platform.
 * On macOS the returned image has `setTemplateImage(true)` applied.
 */
export function getTrayIcon(opts: TrayIconOpts): NativeImage {
  const platform = opts.platform ?? process.platform;
  if (platform === "darwin") {
    const icon = nativeImage.createFromPath(opts.resourcePath("trayTemplate.png"));
    icon.setTemplateImage(true);
    return icon;
  }
  if (platform === "win32") {
    return nativeImage.createFromPath(opts.resourcePath("icon.ico"));
  }
  return nativeImage.createFromPath(opts.resourcePath("icon.png"));
}
