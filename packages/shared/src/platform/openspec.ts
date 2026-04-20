/**
 * openspec.ts — thin namespace entry point for openspec Recipe-based wrappers.
 *
 * Implementation in `tools.ts`. This file preserves the
 * `import * as openspec from ".../platform/openspec.js"` call pattern.
 *
 * See change: prep-for-develop-merge phase 3c.
 */
export {
  OPENSPEC_ARCHIVE_COMPLETED,
  OPENSPEC_LIST,
  OPENSPEC_RECIPES,
  OPENSPEC_STATUS,
  archiveCompleted,
  list,
  listOr,
  status,
  statusOr,
} from "./tools.js";
