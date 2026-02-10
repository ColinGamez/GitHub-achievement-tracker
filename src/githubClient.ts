/**
 * githubClient.ts — Thin wrapper around Octokit.
 *
 * Provides a pre-configured Octokit instance plus low-level helper
 * methods that are shared by the higher-level manager modules
 * (issueManager, prManager, etc.).
 *
 * All API calls flow through this module so that authentication,
 * rate-limit handling, and logging are centralised.
 */

import { Octokit } from "@octokit/rest";
import { config } from "./config";
import { log, sleep } from "./utils";

// ---------------------------------------------------------------------------
// Octokit singleton
// ---------------------------------------------------------------------------

/** Authenticated Octokit instance used by all managers. */
export const octokit = new Octokit({
  auth: config.githubToken,
  userAgent: "github-activity-orchestrator/1.0.0",
  log: {
    debug: (msg: string) => log.debug("[octokit]", msg),
    info: (msg: string) => log.debug("[octokit]", msg), // demote to debug
    warn: (msg: string) => log.warn("[octokit]", msg),
    error: (msg: string) => log.error("[octokit]", msg),
  },
});

// Convenience aliases used everywhere.
export const owner = config.owner;
export const repo = config.repo;

// ---------------------------------------------------------------------------
// Rate-limit aware request wrapper
// ---------------------------------------------------------------------------

/**
 * Execute an async GitHub API call with basic rate-limit awareness.
 *
 * If the call fails with a 403 (secondary rate-limit) or 429, we wait
 * for the amount of time GitHub tells us to and retry once.  All other
 * errors propagate immediately.
 */
export async function withRateLimit<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (isRateLimited(err)) {
      const waitMs = retryAfterMs(err);
      log.warn(
        `Rate-limited during "${label}". Waiting ${Math.ceil(waitMs / 1000)}s before retry…`
      );
      await sleep(waitMs);
      return fn(); // single retry
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Check whether an Octokit error is a rate-limit response. */
function isRateLimited(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const status = (err as Record<string, unknown>).status;
  return status === 403 || status === 429;
}

/** Extract Retry-After (or a sensible default) from a rate-limit error. */
function retryAfterMs(err: unknown): number {
  const DEFAULT_WAIT = 60_000; // 60 s
  if (typeof err !== "object" || err === null) return DEFAULT_WAIT;

  const headers = (err as Record<string, unknown>).response as
    | Record<string, unknown>
    | undefined;
  if (!headers) return DEFAULT_WAIT;

  const raw = (headers as Record<string, unknown>)["retry-after"];
  if (typeof raw === "string") {
    const seconds = parseInt(raw, 10);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  return DEFAULT_WAIT;
}

// ---------------------------------------------------------------------------
// Common low-level helpers
// ---------------------------------------------------------------------------

/**
 * Get the SHA of the default branch's HEAD.
 * Used when creating new branches.
 */
export async function getDefaultBranchSha(): Promise<{
  branch: string;
  sha: string;
}> {
  const { data: repoData } = await withRateLimit("get-repo", () =>
    octokit.repos.get({ owner, repo })
  );

  const defaultBranch = repoData.default_branch;

  const { data: refData } = await withRateLimit("get-ref", () =>
    octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` })
  );

  return { branch: defaultBranch, sha: refData.object.sha };
}

/**
 * Create a new branch from a given SHA.
 */
export async function createBranch(
  branchName: string,
  sha: string
): Promise<void> {
  await withRateLimit("create-branch", () =>
    octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
    })
  );
  log.info(`Created branch: ${branchName}`);
}

/**
 * Create or update a file on a given branch via the Contents API.
 *
 * Returns the commit SHA of the new commit.
 */
export async function commitFile(opts: {
  branch: string;
  path: string;
  content: string;
  message: string;
}): Promise<string> {
  // Check if file already exists (to get its SHA for an update).
  let existingSha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: opts.path,
      ref: opts.branch,
    });
    if (!Array.isArray(data) && data.type === "file") {
      existingSha = data.sha;
    }
  } catch {
    // 404 → file does not exist yet, which is fine.
  }

  const { data } = await withRateLimit("commit-file", () =>
    octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: opts.path,
      message: opts.message,
      content: Buffer.from(opts.content, "utf-8").toString("base64"),
      branch: opts.branch,
      ...(existingSha ? { sha: existingSha } : {}),
    })
  );

  const commitSha = data.commit.sha ?? "unknown";
  log.info(`Committed ${opts.path} on ${opts.branch} (${commitSha})`);
  return commitSha;
}

/**
 * Delete a branch. Fires-and-forgets; failures are logged but not thrown.
 */
export async function deleteBranch(branchName: string): Promise<void> {
  try {
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
    log.debug(`Deleted branch: ${branchName}`);
  } catch {
    log.debug(`Could not delete branch ${branchName} (may already be gone).`);
  }
}
