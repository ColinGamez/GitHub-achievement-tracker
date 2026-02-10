/**
 * mergeManager.ts — Merge pull requests and clean up branches.
 *
 * Supports two merge styles:
 *   • **Reviewed merge** (default) — a comment is posted before merging
 *     to simulate a lightweight code review.
 *   • **YOLO merge** — the PR is merged immediately without review,
 *     which triggers the YOLO achievement on GitHub.
 *
 * After a successful merge the feature branch is deleted to keep the
 * repository tidy.
 */

import { config } from "./config";
import {
  octokit,
  owner,
  repo,
  withRateLimit,
  deleteBranch,
} from "./githubClient";
import { commentOnPR } from "./commentManager";
import { log, nowISO, sleep } from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result metadata after a merge operation. */
export interface MergeResult {
  /** PR number that was merged. */
  prNumber: number;
  /** The merge commit SHA. */
  mergeSha: string;
  /** Whether a YOLO merge was performed. */
  yolo: boolean;
  /** ISO-8601 merge timestamp. */
  mergedAt: string;
  /** Name of the branch that was deleted post-merge. */
  deletedBranch: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge a pull request, optionally exercising the YOLO path.
 *
 * @param prNumber   - The PR to merge.
 * @param branchName - The head branch (deleted after merge).
 * @param yolo       - Override config.yoloMode for this call.
 */
export async function mergePullRequest(
  prNumber: number,
  branchName: string,
  yolo?: boolean
): Promise<MergeResult> {
  const useYolo = yolo ?? config.yoloMode;

  if (!useYolo) {
    // Post a review-style comment before merging.
    // Adds a small delay to look natural and avoid rate limits.
    await sleep(1_500);
    await commentOnPR(prNumber);
    log.info(`Posted review comment on PR #${prNumber} before merge.`);
  } else {
    log.info(`YOLO mode: merging PR #${prNumber} without review.`);
  }

  // Small pause to let GitHub index the comment.
  await sleep(1_000);

  // Perform the merge via the API (squash merge keeps history clean).
  const { data } = await withRateLimit("merge-pr", () =>
    octokit.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: "squash",
      commit_title: `merge: PR #${prNumber}`,
      commit_message: useYolo
        ? "Merged without review (YOLO)."
        : "Merged after review.",
    })
  );

  log.info(`Merged PR #${prNumber} (sha: ${data.sha})`);

  // Clean up the feature branch.
  await deleteBranch(branchName);

  return {
    prNumber,
    mergeSha: data.sha,
    yolo: useYolo,
    mergedAt: nowISO(),
    deletedBranch: branchName,
  };
}

/**
 * Check whether a PR is currently mergeable.
 *
 * GitHub sometimes returns `mergeable: null` while it computes the
 * merge status.  We retry a few times with back-off.
 */
export async function isMergeable(prNumber: number): Promise<boolean> {
  const MAX_ATTEMPTS = 5;
  const DELAY_MS = 3_000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data } = await withRateLimit("check-mergeable", () =>
      octokit.pulls.get({ owner, repo, pull_number: prNumber })
    );

    if (data.mergeable === true) return true;
    if (data.mergeable === false) return false;

    // null → GitHub is still calculating; wait and retry.
    log.debug(
      `PR #${prNumber} mergeable status unknown (attempt ${attempt}/${MAX_ATTEMPTS}). Waiting…`
    );
    await sleep(DELAY_MS);
  }

  // Conservative default — do not merge if we cannot confirm.
  log.warn(
    `Could not determine mergeable status for PR #${prNumber} after ${MAX_ATTEMPTS} attempts.`
  );
  return false;
}
