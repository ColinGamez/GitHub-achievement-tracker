/**
 * seedRepo.ts — One-time bootstrap script to prepare a repository.
 *
 * Run this script once against a fresh repository to:
 *   1. Ensure required labels exist.
 *   2. Create a `src/generated/` directory with a placeholder README.
 *   3. Verify API access and print repo metadata.
 *
 * Usage:
 *   npx ts-node scripts/seedRepo.ts
 *
 * This script is entirely optional — the orchestrator creates labels
 * on-the-fly if they are missing.  But running seed first gives you
 * confidence that credentials are correct before the main loop.
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load env before importing config (config validates at import time).
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { config } from "../src/config";
import { octokit, owner, repo, withRateLimit, commitFile, getDefaultBranchSha } from "../src/githubClient";
import { ensureLabels } from "../src/issueManager";
import { log } from "../src/utils";

async function seed(): Promise<void> {
  log.info("=== Seed Script ===");
  log.info(`Target repository: ${owner}/${repo}`);
  log.info("");

  // ---- Verify access -------------------------------------------------------
  log.info("Verifying API access…");
  const { data: repoData } = await withRateLimit("get-repo", () =>
    octokit.repos.get({ owner, repo })
  );
  log.info(`  Repository:      ${repoData.full_name}`);
  log.info(`  Default branch:  ${repoData.default_branch}`);
  log.info(`  Visibility:      ${repoData.visibility}`);
  log.info(`  Permissions:     push=${repoData.permissions?.push}, admin=${repoData.permissions?.admin}`);
  log.info("");

  if (!repoData.permissions?.push) {
    log.error(
      "The configured token does not have push access to this repository. " +
      "Grant the 'Contents: write' permission and try again."
    );
    process.exit(1);
  }

  // ---- Ensure labels --------------------------------------------------------
  log.info("Ensuring orchestrator labels exist…");
  await ensureLabels();
  log.info("Labels OK.");
  log.info("");

  // ---- Create placeholder directory -----------------------------------------
  log.info("Creating src/generated/ placeholder…");
  const { sha: baseSha, branch: defaultBranch } = await getDefaultBranchSha();

  try {
    await commitFile({
      branch: defaultBranch,
      path: "src/generated/.gitkeep",
      content:
        "# This directory is managed by the GitHub Activity Orchestrator.\n" +
        "# Generated files appear here as part of automated workflows.\n",
      message: "chore: initialise src/generated directory",
    });
    log.info("Placeholder committed.");
  } catch (err: unknown) {
    // 422 means the file already exists — that's fine.
    const status = (err as Record<string, unknown>)?.status;
    if (status === 422) {
      log.info("Placeholder already exists — skipping.");
    } else {
      throw err;
    }
  }

  log.info("");
  log.info("=== Seed complete ===");
  log.info("You can now run the orchestrator:");
  log.info("  npm run dev     (local)");
  log.info("  npm run build && npm start   (compiled)");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error("Seed failed:", err);
    process.exit(1);
  });
