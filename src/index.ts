/**
 * index.ts — Main entry point for the GitHub Activity Orchestrator.
 *
 * Orchestration loop:
 *   For each iteration (bounded by config.maxIssuesPerRun / maxPrsPerRun):
 *     1. Create an issue.
 *     2. Post a quick-response comment on the issue (Quickdraw).
 *     3. Create a branch, commit a file (optionally co-authored), and open a PR.
 *     4. Optionally comment on the PR.
 *     5. Merge the PR (YOLO or reviewed).
 *     6. Record all event timestamps for analytics.
 *
 * The orchestrator is designed to be idempotent: running it multiple
 * times will create new issues/PRs without conflicting with previous runs.
 *
 * Exit codes:
 *   0 — success
 *   1 — unrecoverable error
 */

import { config } from "./config";
import { createIssue } from "./issueManager";
import { createPullRequest } from "./prManager";
import { quickResponseComment, commentOnPR } from "./commentManager";
import { mergePullRequest, isMergeable } from "./mergeManager";
import {
  startRun,
  endRun,
  recordIssueCreated,
  recordIssueClosed,
  recordPROpened,
  recordPRMerged,
  recordCommentPosted,
  recordCoAuthoredCommit,
  recordIssueToComment,
  recordPRToMerge,
  printConsoleSummary,
  writeMarkdownReport,
} from "./analytics";
import { log, sleep } from "./utils";

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log.info("=== GitHub Activity Orchestrator ===");
  log.info(`Target: ${config.owner}/${config.repo}`);
  log.info(`Max issues/run: ${config.maxIssuesPerRun}`);
  log.info(`Max PRs/run:    ${config.maxPrsPerRun}`);
  log.info(`Auto-merge:     ${config.autoMerge}`);
  log.info(`YOLO mode:      ${config.yoloMode}`);
  log.info(`Co-author:      ${config.coAuthorName || "(none)"}`);
  log.info("");

  // Start analytics tracking for this run.
  startRun();

  const iterations = Math.min(config.maxIssuesPerRun, config.maxPrsPerRun);

  for (let i = 0; i < iterations; i++) {
    log.info(`--- Iteration ${i + 1} of ${iterations} ---`);

    try {
      await runSingleWorkflow();
    } catch (err) {
      log.error(`Iteration ${i + 1} failed:`, err);
      // Continue with the next iteration rather than aborting the run.
    }

    // Small inter-iteration pause to stay well within rate limits.
    if (i < iterations - 1) {
      log.debug("Pausing between iterations…");
      await sleep(3_000);
    }
  }

  // Finalise analytics.
  const record = endRun();

  // Console summary.
  printConsoleSummary();

  // Write Markdown analytics report.
  try {
    writeMarkdownReport();
  } catch (err) {
    log.warn("Could not write Markdown report:", err);
  }

  log.info("=== Orchestrator run complete ===");
  log.info(
    `This run: ${record.issuesCreated} issues, ${record.prsOpened} PRs, ${record.prsMerged} merged.`
  );
}

// ---------------------------------------------------------------------------
// Single workflow: Issue → Comment → Branch → Commit → PR → Merge
// ---------------------------------------------------------------------------

async function runSingleWorkflow(): Promise<void> {
  // ---- 1. Create issue -----------------------------------------------------
  const issue = await createIssue();
  recordIssueCreated();

  // ---- 2. Quick-response comment (Quickdraw) --------------------------------
  const comment = await quickResponseComment(issue.number);
  recordCommentPosted();
  recordIssueToComment(issue.createdAt, comment.createdAt);

  // ---- 3. Create branch + commit + PR --------------------------------------
  // Small delay so the issue and comment are indexed before we reference them.
  await sleep(2_000);

  const pr = await createPullRequest(issue.number, issue.title);
  recordPROpened();

  // Record co-authored commit if configured.
  if (config.coAuthorName && config.coAuthorEmail) {
    recordCoAuthoredCommit();
  }

  // ---- 4. Optional PR comment -----------------------------------------------
  // Post a review-style comment on the PR for realism.
  await sleep(1_500);
  await commentOnPR(pr.number);
  recordCommentPosted();

  // ---- 5. Merge (if enabled) ------------------------------------------------
  if (config.autoMerge) {
    // Wait for GitHub to compute merge status.
    await sleep(3_000);

    const canMerge = await isMergeable(pr.number);
    if (canMerge) {
      const mergeResult = await mergePullRequest(
        pr.number,
        pr.branch,
        config.yoloMode
      );
      recordPRMerged(mergeResult.yolo);
      recordIssueClosed(); // Closed via "Closes #N" in the PR body.
      recordPRToMerge(pr.createdAt, mergeResult.mergedAt);
    } else {
      log.warn(
        `PR #${pr.number} is not mergeable — skipping merge. ` +
          `You can merge it manually.`
      );
    }
  } else {
    log.info(`Auto-merge disabled. PR #${pr.number} is open and ready.`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error("Fatal error:", err);
    process.exit(1);
  });
