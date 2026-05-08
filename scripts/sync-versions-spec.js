/**
 * sync-versions-spec.js — pure helper extracted from sync-versions.js for unit
 * tests. Lives as a separate module so importing it does not trigger the
 * script's top-level filesystem scan + version mutation.
 *
 * The exported function decides whether a cross-package dependency specifier
 * is a "plain semver range" that the release-time bump should rewrite to
 * `^<current-version>`. Everything else is preserved as a deliberate override
 * (e.g. `"*"`, `"latest"`, git URLs, file: paths, complex ranges).
 */

/**
 * Returns true when `spec` is one of:
 *
 *   X.Y.Z
 *   ^X.Y.Z
 *   ~X.Y.Z
 *   X.Y.Z-prerelease[+build]   (with caret/tilde optional)
 *
 * Returns false for `"*"`, `"latest"`, `"workspace:*"`, git URLs, file: paths,
 * http(s):// tarballs, ranges like `">=1.0"`, OR-unions like `"1.0 || 2.0"`,
 * empty strings, and any non-string input.
 */
export function isRewritableSemverSpec(spec) {
	if (typeof spec !== "string" || spec === "") return false;
	return /^[\^~]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(spec);
}
