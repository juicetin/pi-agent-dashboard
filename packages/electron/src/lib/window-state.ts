/**
 * Persists BrowserWindow size and position across restarts.
 * Stores in ~/.pi-dashboard/window-state.json.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { BrowserWindow, Rectangle } from "electron";

const STATE_FILE = path.join(os.homedir(), ".pi-dashboard", "window-state.json");

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

const DEFAULTS: WindowState = { width: 1280, height: 800 };

export function loadWindowState(): WindowState {
  try {
    if (!existsSync(STATE_FILE)) return { ...DEFAULTS };
    const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return {
      x: typeof data.x === "number" ? data.x : undefined,
      y: typeof data.y === "number" ? data.y : undefined,
      width: typeof data.width === "number" ? data.width : DEFAULTS.width,
      height: typeof data.height === "number" ? data.height : DEFAULTS.height,
      isMaximized: data.isMaximized === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveWindowState(win: BrowserWindow): void {
  const isMaximized = win.isMaximized();
  const bounds: Rectangle = isMaximized ? (loadWindowState() as Rectangle) : win.getBounds();
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  };
  try {
    mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* ignore */ }
}
