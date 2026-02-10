/**
 * prManager.ts — Create pull requests that reference orchestrated issues.
 *
 * Workflow:
 *   1. Receive an issue number + metadata from the orchestrator.
 *   2. Create a feature branch off the default branch.
 *   3. Commit a real, non-empty file to the branch.
 *   4. Open a PR that references the issue ("Closes #N").
 *
 * The PR body includes the "Closes #<issue>" keyword so that GitHub
 * automatically closes the issue when the PR is merged.
 *
 * Co-authored commits are optionally added via the standard Git trailer,
 * supporting the Pair Extraordinaire achievement.
 */

import { config } from "./config";
import {
  createBranch,
  commitFile,
  getDefaultBranchSha,
  octokit,
  owner,
  repo,
  withRateLimit,
} from "./githubClient";
import {
  log,
  slugify,
  shortId,
  getRandomPRDescription,
  getRandomFileContent,
  generatedFilePath,
  coAuthorTrailer,
  nowISO,
} from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata about a newly opened pull request. */
export interface CreatedPR {
  /** PR number. */
  number: number;
  /** Branch name that was created for this PR. */
  branch: string;
  /** ISO-8601 timestamp when the PR was opened. */
  createdAt: string;
  /** The HTML URL for human consumption. */
  htmlUrl: string;
  /** The issue number this PR closes. */
  closesIssue: number;
}

// ---------------------------------------------------------------------------
// PR creation pipeline
// ---------------------------------------------------------------------------

/**
 * Full pipeline: branch → commit → open PR.
 *
 * @param issueNumber - The issue this PR will reference and close.
 * @param issueTitle  - Used to derive the branch name.
 */
export async function createPullRequest(
  issueNumber: number,
  issueTitle: string
): Promise<CreatedPR> {
  // ---- 1. Branch -----------------------------------------------------------
  const slug = slugify(issueTitle);
  const branchName = `${config.branchPrefix}${slug}-${shortId()}`;
  const { branch: defaultBranch, sha: baseSha } =
    await getDefaultBranchSha();

  await createBranch(branchName, baseSha);

  // ---- 2. Commit a real file -----------------------------------------------
  const filePath = generatedFilePath(`${slug}-${shortId()}`);
  const fileContent = getRandomFileContent();
  const commitMessage =
    `feat: ${issueTitle} (#${issueNumber})` + coAuthorTrailer();

  await commitFile({
    branch: branchName,
    path: filePath,
    content: fileContent,
    message: commitMessage,
  });

  // ---- 3. Open the PR ------------------------------------------------------
  const prBody = buildPRBody(issueNumber);

  const { data } = await withRateLimit("create-pr", () =>
    octokit.pulls.create({
      owner,
      repo,
      title: `feat: ${issueTitle}`,
      head: branchName,
      base: defaultBranch,
      body: prBody,
    })
  );

  const created: CreatedPR = {
    number: data.number,
    branch: branchName,
    createdAt: data.created_at ?? nowISO(),
    htmlUrl: data.html_url,
    closesIssue: issueNumber,
  };

  log.info(
    `Opened PR #${created.number} on branch ${branchName} → closes #${issueNumber}`
  );
  return created;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the PR body that closes the linked issue.
 *
 * The "Closes #N" keyword is recognised by GitHub and will
 * transition the issue to "closed" when the PR merges.
 */
function buildPRBody(issueNumber: number): string {
  const description = getRandomPRDescription();
  return `${description}\n\nCloses #${issueNumber}`;
}
