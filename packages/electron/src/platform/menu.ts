/**
 * Platform decisions for the Electron app menu.
 *
 * The menu template itself (with `about`, `doctor`, etc.) lives in
 * `packages/electron/src/lib/app-menu.ts` because its handlers close over
 * Electron-API-specific dialog/clipboard invocations. This module owns
 * only the platform-shape decision: does this OS use the macOS "app
 * menu in first position" layout, or the flat Windows/Linux layout?
 *
 * See change: consolidate-platform-handlers.
 */

export interface MenuLayoutOpts {
  /** Override platform (defaults to process.platform). */
  platform?: NodeJS.Platform;
}

/**
 * True if the app should render the macOS-style menu layout:
 *   [App] [Edit] [View] [Window]
 *
 * False for Windows/Linux, which use the flat layout:
 *   [View] [About] [Doctor]
 */
export function usesMacMenuLayout(opts: MenuLayoutOpts = {}): boolean {
  const platform = opts.platform ?? process.platform;
  return platform === "darwin";
}
