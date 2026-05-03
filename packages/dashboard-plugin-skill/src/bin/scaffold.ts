#!/usr/bin/env node
/**
 * Bin entry: read JSON answers from stdin, render templates to disk.
 *
 * Usage (the SKILL.md drives this from a pi session):
 *   echo '{ "mode": "new", "id": "acme", ... }' | pi-dashboard-plugin-scaffold
 */
import * as fs from "node:fs";
import { render, FsSink } from "../render.js";
import type { Answers } from "../render.js";

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main(): Promise<void> {
  const raw = (await readStdin()).trim();
  if (!raw) {
    console.error("usage: echo '<answers-json>' | pi-dashboard-plugin-scaffold");
    process.exit(2);
  }

  let answers: Answers;
  try {
    answers = JSON.parse(raw) as Answers;
  } catch (err) {
    console.error("invalid JSON answers on stdin:", (err as Error).message);
    process.exit(2);
  }

  if (!answers.outDir) {
    console.error("answers.outDir is required");
    process.exit(2);
  }

  // For new mode, refuse to overwrite existing dir.
  if (answers.mode === "new" && fs.existsSync(answers.outDir)) {
    console.error(`outDir already exists: ${answers.outDir}`);
    process.exit(1);
  }

  const sink = new FsSink(answers.outDir);
  render(answers, sink);

  console.log(`scaffold complete: ${answers.outDir}`);
}

void main();
