/**
 * Electron-specific platform primitives (UI / lifecycle concerns that
 * require the `electron` package and cannot live in `@blackbelt-technology/pi-dashboard-shared`).
 *
 * For pure-Node cross-OS primitives (binary lookup, process control,
 * shell detection, openBrowser, isVirtualMachine), import from
 * `@blackbelt-technology/pi-dashboard-shared/platform/*`.
 *
 * See change: consolidate-platform-handlers.
 */
export * from "./tray-icon.js";
export * from "./node.js";
export * from "./app-lifecycle.js";
export * from "./menu.js";
