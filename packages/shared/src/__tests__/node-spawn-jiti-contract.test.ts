/**
 * Pin the jiti version contract for `shouldUrlWrapEntry()`.
 *
 * The Windows-non-tsx arm in `platform/node-spawn.ts::shouldUrlWrapEntry`
 * relies on jiti's file:/// URL handling. This was VERIFIED on:
 *   - `@mariozechner/pi-coding-agent@0.70.x` shipping `jiti@2.x` (original baseline)
 *   - `@earendil-works/pi-coding-agent@0.74.x` shipping `jiti@^2.7.0` (current baseline)
 * It was BROKEN on `pi-coding-agent@0.71.x` shipping `jiti@2.6.5`, which
 * misnormalised triple-slash file:/// URLs on Windows. Keep that data
 * point in the contract so a contributor recognises the regression
 * pattern if it recurs.
 *
 * This test ensures:
 *   1. The offline-cacache pin in `packages/electron/offline-packages.json`
 *      stays on a supported pi version under one of the two supported
 *      forks. A bump outside the verified set fires this test and
 *      forces the contributor to either:
 *        - re-verify the contract on Windows
 *        - add a per-jiti-version branch
 *        - switch the bundled loader to tsx
 *   2. The `shouldUrlWrapEntry` header comment documents the contract
 *      so future contributors discover the constraint at the call site.
 *
 * See changes: fix-electron-windows-installer-and-server-bootstrap (Defect 2),
 *              migrate-pi-fork-to-earendil (E.6).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const OFFLINE_PACKAGES_PATH = path.join(
  REPO_ROOT,
  "packages",
  "electron",
  "offline-packages.json",
);
const NODE_SPAWN_PATH = path.join(
  REPO_ROOT,
  "packages",
  "shared",
  "src",
  "platform",
  "node-spawn.ts",
);

/** Versions verified against the Windows file:/// jiti contract. */
const VERIFIED_PI_PINS: ReadonlyArray<{ name: string; versionPrefix: string }> = [
  { name: "@earendil-works/pi-coding-agent", versionPrefix: "0.74." },
  { name: "@mariozechner/pi-coding-agent", versionPrefix: "0.70." },
];

describe("jiti version contract for shouldUrlWrapEntry", () => {
  it("offline-packages.json pins pi-coding-agent at a verified version under a supported fork", () => {
    const raw = fs.readFileSync(OFFLINE_PACKAGES_PATH, "utf8");
    const manifest = JSON.parse(raw) as {
      packages: { name: string; version: string }[];
    };

    const supportedNames = VERIFIED_PI_PINS.map((p) => p.name);
    const piEntry = manifest.packages.find((p) =>
      supportedNames.includes(p.name),
    );
    if (!piEntry) {
      throw new Error(
        `No supported pi-coding-agent fork found in offline-packages.json. ` +
          `Expected one of: ${supportedNames.join(", ")}. ` +
          `The offline cacache must include pi-coding-agent. ` +
          `See changes: fix-electron-windows-installer-and-server-bootstrap (Defect 2), ` +
          `migrate-pi-fork-to-earendil (E.6).`,
      );
    }

    const verifiedPin = VERIFIED_PI_PINS.find(
      (p) => p.name === piEntry.name && piEntry.version.startsWith(p.versionPrefix),
    );
    if (!verifiedPin) {
      const allowedRanges = VERIFIED_PI_PINS
        .map((p) => `${p.name}@${p.versionPrefix}x`)
        .join(", ");
      throw new Error(
        `pi-coding-agent pinned at ${piEntry.name}@${piEntry.version}, but ` +
          `shouldUrlWrapEntry()'s Windows-non-tsx arm only supports verified pins: ` +
          `${allowedRanges}. ` +
          `Newer jiti versions (e.g. 2.6.5 in pi 0.71.x) misnormalize ` +
          `file:/// URL entries on Windows. Either re-verify the contract, ` +
          `add a per-jiti-version branch in shouldUrlWrapEntry(), or switch ` +
          `the bundled loader to tsx. See changes: ` +
          `fix-electron-windows-installer-and-server-bootstrap (Defect 2), ` +
          `migrate-pi-fork-to-earendil (E.6).`,
      );
    }

    expect(piEntry.version.startsWith(verifiedPin.versionPrefix)).toBe(true);
  });

  it("node-spawn.ts source contains the documented JITI VERSION CONTRACT block", () => {
    const source = fs.readFileSync(NODE_SPAWN_PATH, "utf8");

    // Contract block markers
    expect(source).toContain("JITI VERSION CONTRACT");
    // Documented baseline references (at least one of the verified version markers).
    const hasBaselineMarker =
      source.includes("0.74.") || source.includes("0.70.x");
    if (!hasBaselineMarker) {
      throw new Error(
        "shouldUrlWrapEntry() docstring is missing the verified-baseline marker. " +
          "It must mention at least one of: '0.74.' (current earendil baseline) " +
          "or '0.70.x' (legacy mariozechner baseline). See change: " +
          "migrate-pi-fork-to-earendil (E.7).",
      );
    }

    // Version drift markers (at least one of these identifies the broken jiti)
    const hasVersionDriftMarker =
      source.includes("0.71") || source.includes("2.6.5");
    if (!hasVersionDriftMarker) {
      throw new Error(
        "shouldUrlWrapEntry() docstring is missing the version-drift marker. " +
          "It must mention either '0.71' or '2.6.5' so contributors can " +
          "identify the known-broken jiti versions. See change: " +
          "fix-electron-windows-installer-and-server-bootstrap (Defect 2).",
      );
    }

    // Remediation guidance markers (at least one)
    const hasRemediationGuidance =
      /re-verify/i.test(source) ||
      /per-version branch/i.test(source) ||
      /per-jiti-version/i.test(source) ||
      /switch.*to tsx/i.test(source);
    if (!hasRemediationGuidance) {
      throw new Error(
        "shouldUrlWrapEntry() docstring is missing remediation guidance. " +
          "It must mention at least one of: re-verify, per-version branch, " +
          "or switch to tsx. See change: " +
          "fix-electron-windows-installer-and-server-bootstrap (Defect 2).",
      );
    }
  });
});
