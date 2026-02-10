/**
 * config.ts — Centralised, type-safe configuration for the orchestrator.
 *
 * Every tunable knob lives here.  Values are read from environment variables
 * (loaded via dotenv) with sensible defaults so the project runs out-of-the-box
 * in GitHub Actions where GITHUB_TOKEN is provided automatically.
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root (harmless if the file does not exist).
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read an env var, returning `fallback` when the var is unset or empty. */
function env(key: string, fallback: string = ""): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

/** Parse a boolean-ish env var ("true", "1", "yes" → true). */
function envBool(key: string, fallback: boolean): boolean {
  const raw = env(key);
  if (raw === "") return fallback;
  return ["true", "1", "yes"].includes(raw.toLowerCase());
}

/** Parse a positive integer env var. */
function envInt(key: string, fallback: number): number {
  const raw = env(key);
  if (raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ---------------------------------------------------------------------------
// Exported configuration object
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  /** GitHub Personal Access Token (or GITHUB_TOKEN in Actions). */
  githubToken: string;
  /** Repository owner (user or org). */
  owner: string;
  /** Repository name. */
  repo: string;

  /** Co-author name for Pair Extraordinaire commits. */
  coAuthorName: string;
  /** Co-author email for Pair Extraordinaire commits. */
  coAuthorEmail: string;

  /** Prefix for orchestrator-created branches. */
  branchPrefix: string;
  /** Max issues to create in a single run. */
  maxIssuesPerRun: number;
  /** Max pull requests to open in a single run. */
  maxPrsPerRun: number;
  /** Whether to auto-merge PRs after opening them. */
  autoMerge: boolean;
  /** Merge without prior review (YOLO achievement). */
  yoloMode: boolean;

  /** Filesystem path for analytics persistence. */
  analyticsPath: string;
  /** Logging verbosity. */
  logLevel: "debug" | "info" | "warn" | "error";
}

/** Build the config, validating that required vars are present. */
function loadConfig(): OrchestratorConfig {
  const githubToken = env("GITHUB_TOKEN");
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");

  if (!githubToken) {
    throw new Error(
      "GITHUB_TOKEN is required. Set it in .env or as a repository secret."
    );
  }
  if (!owner || !repo) {
    throw new Error(
      "GITHUB_OWNER and GITHUB_REPO must be set. See .env.example."
    );
  }

  const logLevel = env("LOG_LEVEL", "info") as OrchestratorConfig["logLevel"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL "${logLevel}".`);
  }

  return {
    githubToken,
    owner,
    repo,
    coAuthorName: env("CO_AUTHOR_NAME"),
    coAuthorEmail: env("CO_AUTHOR_EMAIL"),
    branchPrefix: env("BRANCH_PREFIX", "orchestrator/"),
    maxIssuesPerRun: envInt("MAX_ISSUES_PER_RUN", 1),
    maxPrsPerRun: envInt("MAX_PRS_PER_RUN", 1),
    autoMerge: envBool("AUTO_MERGE", true),
    yoloMode: envBool("YOLO_MODE", false),
    analyticsPath: env(
      "ANALYTICS_PATH",
      path.resolve(__dirname, "..", "data", "analytics.json")
    ),
    logLevel,
  };
}

/**
 * Singleton config instance.
 * Throws immediately at import time if required vars are missing,
 * giving the operator fast feedback.
 */
export const config: OrchestratorConfig = loadConfig();
