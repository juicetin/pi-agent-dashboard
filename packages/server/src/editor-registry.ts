/**
 * Static editor registry and detection logic.
 * Detects available editors by checking for running processes + CLI on PATH.
 */
import { execSync } from "node:child_process";

export interface EditorEntry {
  id: string;
  name: string;
  cli: string;
  processPattern: { darwin: string; linux: string; win32?: string };
  /** Windows CLI name when different from Unix (e.g., "code.cmd") */
  winCli?: string;
}

export interface DetectedEditor {
  id: string;
  name: string;
}

export const EDITORS: EditorEntry[] = [
  {
    id: "zed",
    name: "Zed",
    cli: "zed",
    processPattern: { darwin: "/Applications/Zed.app", linux: "zed" },
    // Zed not available on Windows
  },
  {
    id: "vscode",
    name: "VS Code",
    cli: "code",
    winCli: "code.cmd",
    processPattern: {
      darwin: "/Applications/Visual Studio Code.app",
      linux: "code",
      win32: "Code.exe",
    },
  },
  {
    id: "idea",
    name: "IntelliJ",
    cli: "idea",
    winCli: "idea64.exe",
    processPattern: {
      darwin: "/Applications/IntelliJ IDEA",
      linux: "idea",
      win32: "idea64.exe",
    },
  },
];

export function isProcessRunning(pattern: string): boolean {
  try {
    execSync(`pgrep -f "${pattern}"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function isCliAvailable(cli: string): boolean {
  const cmd = process.platform === "win32" ? `where ${cli}` : `which ${cli}`;
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function isProcessRunningWin32(pattern: string): boolean {
  try {
    const result = execSync(`tasklist /FI "IMAGENAME eq ${pattern}" /NH`, { encoding: "utf-8", stdio: "pipe" });
    return result.includes(pattern);
  } catch {
    return false;
  }
}

export function detectEditors(_cwd: string): DetectedEditor[] {
  const platform = process.platform;
  const results: DetectedEditor[] = [];

  for (const editor of EDITORS) {
    let pattern: string | undefined;
    let cli: string;

    if (platform === "win32") {
      pattern = editor.processPattern.win32;
      if (!pattern) continue; // Editor not available on Windows
      cli = editor.winCli || editor.cli;
    } else {
      const key = platform === "darwin" ? "darwin" : "linux";
      pattern = editor.processPattern[key];
      cli = editor.cli;
    }

    const running = platform === "win32"
      ? isProcessRunningWin32(pattern)
      : isProcessRunning(pattern);

    if (running && isCliAvailable(cli)) {
      results.push({ id: editor.id, name: editor.name });
    }
  }
  return results;
}
