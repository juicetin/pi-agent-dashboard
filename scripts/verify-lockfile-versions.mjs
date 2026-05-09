#!/usr/bin/env node
/**
 * verify-lockfile-versions.mjs — sanity gate for release prepare job.
 *
 * Walks package-lock.json and asserts every recorded cross-ref dep
 * specifier on a @blackbelt-technology/* workspace package is exactly
 * "^<current-root-version>". Exits non-zero with a per-mismatch
 * report if any specifier drifted.
 *
 * Runs immediately after `npm install --package-lock-only` in
 * `.github/workflows/publish.yml`'s `prepare` job. See change:
 * fix-release-lockfile-drift.
 */

import { readFileSync } from "node:fs";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const expected = `^${root.version}`;
const failures = [];

for (const [k, v] of Object.entries(lock.packages || {})) {
	if (!k.startsWith("packages/")) continue;
	const deps = { ...(v.dependencies || {}), ...(v.devDependencies || {}) };
	for (const [name, spec] of Object.entries(deps)) {
		if (!name.startsWith("@blackbelt-technology/")) continue;
		if (spec !== expected) {
			failures.push(`  ${k} → ${name}: ${spec} (expected ${expected})`);
		}
	}
}

if (failures.length) {
	console.error("::error::Lockfile cross-ref drift detected. See change: fix-release-lockfile-drift.");
	for (const line of failures) console.error(line);
	process.exit(1);
}

console.log(`✓ All cross-ref specifiers match ${expected}`);
