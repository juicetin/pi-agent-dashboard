/**
 * git.ts — thin namespace entry point for git Recipe-based wrappers.
 *
 * The implementation now lives in `tools.ts` alongside binary-lookup,
 * runner, npm, and openspec. This file continues to exist so callers
 * can `import * as git from ".../platform/git.js"` and access git
 * functions via `git.currentBranch(...)`, `git.diff(...)`, etc.
 *
 * See change: prep-for-develop-merge phase 3c.
 */
export {
  GH_PR_NUMBER,
  GIT_CURRENT_BRANCH,
  GIT_DIFF,
  GIT_HEAD_SHA,
  GIT_IS_REPO,
  GIT_RECIPES,
  GIT_REMOTE_URL,
  GIT_STATUS_PORCELAIN,
  currentBranch,
  currentBranchOr,
  diff,
  diffOr,
  headSha,
  headShaOr,
  isGitRepo,
  isGitRepoOr,
  prNumber,
  prNumberOr,
  remoteUrl,
  remoteUrlOr,
  statusPorcelain,
  statusPorcelainOr,
} from "./tools.js";
