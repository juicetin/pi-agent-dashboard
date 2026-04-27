/**
 * Enrich rows returned by `packageManagerWrapper.listInstalled()` with
 * version, description, displayName, isRecommended, and isBundled fields.
 *
 * The raw rows from pi's `DefaultPackageManager.listConfiguredPackages()`
 * carry only `{ source, scope, filtered, installedPath }`. The Settings
 * Packages tab needs more to render a friendly identity and badges
 * without a second fetch.
 *
 * Pure helpers (`extractBasenameFromSource`, `computeIsBundled`) are
 * exported for unit tests; the I/O-bearing enricher (`enrichInstalled`)
 * reads the on-disk `package.json` for each row.
 *
 * See change: consolidate-packages-settings-ui.
 */
import fs from "node:fs";
import path from "node:path";
import {
	RECOMMENDED_EXTENSIONS,
	BUNDLED_EXTENSION_IDS,
	type RecommendedExtension,
} from "@blackbelt-technology/pi-dashboard-shared/recommended-extensions.js";
import { sourcesMatch } from "@blackbelt-technology/pi-dashboard-shared/source-matching.js";
import type { InstalledPackage } from "@blackbelt-technology/pi-dashboard-shared/rest-api.js";

/** Raw row shape returned by pi's listConfiguredPackages(). */
export interface RawInstalledRow {
	source: string;
	scope: "user" | "project";
	filtered: boolean;
	installedPath?: string;
}

/** Read package.json#version and #description from a directory.
 * Swallows all errors and returns `{}` on any failure. Exported for tests. */
export function readPackageJsonMeta(installedPath: string | undefined): {
	version?: string;
	description?: string;
} {
	if (!installedPath) return {};
	try {
		const pj = path.join(installedPath, "package.json");
		if (!fs.existsSync(pj)) return {};
		const raw = fs.readFileSync(pj, "utf-8");
		const parsed = JSON.parse(raw);
		const version = typeof parsed?.version === "string" ? parsed.version : undefined;
		const description = typeof parsed?.description === "string" ? parsed.description : undefined;
		return { version, description };
	} catch {
		return {};
	}
}

/** Pull a friendly basename out of a raw source string when no
 * RECOMMENDED_EXTENSIONS match is available. Pure. */
export function extractBasenameFromSource(source: string): string {
	// npm:<name>[@<ver>]
	const npmMatch = source.match(/^npm:(@?[^@]+)(?:@.*)?$/);
	if (npmMatch) return npmMatch[1];

	// git: strip .git suffix and trailing slash, take last path segment
	const gitMatch = source.match(/[/:]([^/:]+?)(?:\.git)?\/?$/);
	if (gitMatch) return gitMatch[1];

	// local file:// or path: take last path segment
	const localMatch = source.match(/[/\\]([^/\\]+)\/?$/);
	if (localMatch) return localMatch[1];

	return source;
}

/** Find the recommended manifest entry whose source matches the row.
 * Pure. */
export function matchRecommendedEntry(
	source: string,
	manifest: readonly RecommendedExtension[] = RECOMMENDED_EXTENSIONS,
): RecommendedExtension | undefined {
	return manifest.find((entry) => sourcesMatch(entry.source, source));
}

/** Compute isBundled. Pure (takes injected resourcesPath + existsSync).
 * Outside Electron (no resourcesPath), always false. */
export function computeIsBundled(
	id: string,
	resourcesPath: string | undefined,
	existsFn: (p: string) => boolean = fs.existsSync,
	bundledIds: readonly string[] = BUNDLED_EXTENSION_IDS,
): boolean {
	if (!resourcesPath) return false;
	if (!bundledIds.includes(id)) return false;
	const dir = path.join(resourcesPath, "bundled-extensions", id);
	return existsFn(dir);
}

/** Enrich a single raw row. Pure dependency injection for tests. */
export function enrichInstalledRow(
	row: RawInstalledRow,
	opts: {
		resourcesPath?: string;
		manifest?: readonly RecommendedExtension[];
		bundledIds?: readonly string[];
		readMeta?: (p: string | undefined) => { version?: string; description?: string };
		existsFn?: (p: string) => boolean;
	} = {},
): InstalledPackage {
	const readMeta = opts.readMeta ?? readPackageJsonMeta;
	const existsFn = opts.existsFn ?? fs.existsSync;
	const manifest = opts.manifest ?? RECOMMENDED_EXTENSIONS;
	const bundledIds = opts.bundledIds ?? BUNDLED_EXTENSION_IDS;

	const meta = readMeta(row.installedPath);
	const recommended = matchRecommendedEntry(row.source, manifest);

	const displayName =
		recommended?.displayName ?? extractBasenameFromSource(row.source);
	const description = recommended?.fallbackDescription ?? meta.description;
	const isRecommended = !!recommended;
	const isBundled = recommended
		? computeIsBundled(recommended.id, opts.resourcesPath, existsFn, bundledIds)
		: false;

	return {
		source: row.source,
		scope: row.scope,
		filtered: row.filtered,
		installedPath: row.installedPath,
		version: meta.version,
		description,
		displayName,
		isRecommended,
		isBundled,
	};
}

/** Enrich a list of raw rows. Reads the Electron resourcesPath at
 * runtime (or undefined in CLI mode). */
export function enrichInstalledRows(
	rows: RawInstalledRow[],
	resourcesPath: string | undefined = (process as { resourcesPath?: string })
		.resourcesPath,
): InstalledPackage[] {
	return rows.map((row) => enrichInstalledRow(row, { resourcesPath }));
}
