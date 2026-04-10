/**
 * Preload script for Electron renderer.
 * Exposes minimal APIs to the renderer via contextBridge.
 * The dashboard web client runs with nodeIntegration: false + contextIsolation: true.
 */

// Currently no APIs need to be exposed — the web client communicates
// with the server via WebSocket/HTTP, same as in a browser.
// Future: expose IPC for first-run wizard, update notifications, etc.

console.log("pi-dashboard preload loaded");
