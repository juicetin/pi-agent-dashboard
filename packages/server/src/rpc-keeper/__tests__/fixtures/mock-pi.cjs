#!/usr/bin/env node
/**
 * Mock pi for keeper integration tests.
 *
 * Reads JSON-line input from stdin and appends each line to the file at
 * `process.env.MOCK_PI_LOG`. Exits 0 on stdin EOF.
 *
 * Behavior modes (via env):
 *   MOCK_PI_MODE=normal (default) — read until EOF, log lines, exit 0
 *   MOCK_PI_MODE=crash             — exit non-zero immediately (tests
 *                                    keeper crash-detection window)
 *
 * CommonJS-pure, only Node built-ins.
 */
"use strict";

const fs = require("fs");

const mode = process.env.MOCK_PI_MODE || "normal";
const logPath = process.env.MOCK_PI_LOG;

if (mode === "crash") {
  process.stderr.write("[mock-pi] crash mode: exiting 1 immediately\n");
  process.exit(1);
}

if (!logPath) {
  process.stderr.write("[mock-pi] FATAL: MOCK_PI_LOG env var required\n");
  process.exit(2);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  // eslint-disable-next-line no-cond-assign
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl);
    buf = buf.slice(nl + 1);
    fs.appendFileSync(logPath, line + "\n");
  }
});
process.stdin.on("end", () => {
  if (buf.length > 0) {
    fs.appendFileSync(logPath, buf + "\n");
  }
  process.exit(0);
});
process.stdin.on("error", () => process.exit(0));
