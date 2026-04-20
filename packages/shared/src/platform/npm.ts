/**
 * npm.ts — thin namespace entry point for npm Recipe-based wrappers.
 *
 * Implementation in `tools.ts`. This file preserves the
 * `import * as npm from ".../platform/npm.js"` call pattern.
 *
 * See change: prep-for-develop-merge phase 3c.
 */
export {
  NPM_INSTALL,
  NPM_INSTALL_GLOBAL,
  NPM_OUTDATED,
  NPM_OUTDATED_GLOBAL,
  NPM_RECIPES,
  NPM_ROOT_GLOBAL,
  NPM_VIEW_VERSION,
  _resetNpmRootCache,
  install,
  installGlobal,
  outdated,
  outdatedGlobal,
  outdatedGlobalOr,
  outdatedOr,
  rootGlobal,
  rootGlobalOr,
  viewVersion,
  viewVersionOr,
} from "./tools.js";
