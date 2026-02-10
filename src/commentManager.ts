/**
 * commentManager.ts — Post contextual comments on issues and pull requests.
 *
 * Comments serve two purposes:
 *   1. Simulate realistic code-review interactions (non-spammy).
 *   2. Contribute toward the Quickdraw achievement by responding
 *      quickly after an issue or PR is created.
 *
 * Every comment is drawn from a curated pool of meaningful review
 * phrases — nothing generic like "bump" or "+1".
 */

import {
  octokit,
  owner,
  repo,
  withRateLimit,
} from "./githubClient";
import { log, getRandomComment, nowISO } from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata returned after posting a comment. */
export interface PostedComment {
  /** Comment ID. */
  id: number;
  /** The issue or PR number the comment was posted on. */
  targetNumber: number;
  /** Whether the target was a PR (true) or issue (false). */
  isPR: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Post a comment on an issue.
 *
 * Quickdraw achievement: GitHub awards Quickdraw when you close an issue
 * or comment very soon after creation.  The orchestrator calls this
 * immediately after opening an issue to maximise the chance.
 */
export async function commentOnIssue(
  issueNumber: number
): Promise<PostedComment> {
  const body = getRandomComment();

  const { data } = await withRateLimit("comment-issue", () =>
    octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    })
  );

  const result: PostedComment = {
    id: data.id,
    targetNumber: issueNumber,
    isPR: false,
    createdAt: data.created_at ?? nowISO(),
  };

  log.info(`Commented on issue #${issueNumber} (comment ${data.id})`);
  return result;
}

/**
 * Post a review comment on a pull request (as a regular issue comment).
 *
 * Using the Issues comment endpoint is intentional: it appears in the
 * PR timeline just like a conversation comment and is simpler than
 * submitting a full pull-request review (which requires a commit SHA
 * and diff position).
 */
export async function commentOnPR(
  prNumber: number
): Promise<PostedComment> {
  const body = getRandomComment();

  const { data } = await withRateLimit("comment-pr", () =>
    octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber, // PRs share the issue number space
      body,
    })
  );

  const result: PostedComment = {
    id: data.id,
    targetNumber: prNumber,
    isPR: true,
    createdAt: data.created_at ?? nowISO(),
  };

  log.info(`Commented on PR #${prNumber} (comment ${data.id})`);
  return result;
}

/**
 * Post a "quick response" comment within seconds of an issue being
 * opened.  This intentionally targets the Quickdraw achievement by
 * minimising the time between issue creation and the first interaction.
 *
 * @param issueNumber - The issue to comment on.
 * @param delayMs     - Optional delay to appear more natural (default 0).
 */
export async function quickResponseComment(
  issueNumber: number,
  delayMs: number = 0
): Promise<PostedComment> {
  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return commentOnIssue(issueNumber);
}
