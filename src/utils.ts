/**
 * utils.ts — Shared helpers used across the orchestrator.
 *
 * Includes logging, random selection, delay, slug generation,
 * and content templates that produce meaningful (non-spammy) text.
 */

import { config } from "./config";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel] ?? 1;

/** Structured logger that respects the configured log level. */
export const log = {
  debug: (...args: unknown[]) => {
    if (currentLevel <= 0) console.debug("[DEBUG]", ...args);
  },
  info: (...args: unknown[]) => {
    if (currentLevel <= 1) console.log("[INFO]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (currentLevel <= 2) console.warn("[WARN]", ...args);
  },
  error: (...args: unknown[]) => {
    if (currentLevel <= 3) console.error("[ERROR]", ...args);
  },
};

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

/** Return a random element from an array. Throws if array is empty. */
export function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error("pickRandom called with empty array");
  return items[Math.floor(Math.random() * items.length)];
}

/** Return a random integer in [min, max] (inclusive). */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Sleep for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Slug / branch helpers
// ---------------------------------------------------------------------------

/** Convert a human-readable string into a URL/branch-safe slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

/** Generate a short unique-ish suffix (6 hex chars). */
export function shortId(): string {
  return Math.random().toString(16).slice(2, 8);
}

// ---------------------------------------------------------------------------
// ISO timestamp
// ---------------------------------------------------------------------------

/** Current UTC ISO timestamp string. */
export function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Content templates — meaningful, non-spammy text
// ---------------------------------------------------------------------------

const ISSUE_TITLES: readonly string[] = [
  "Refactor utility functions for readability",
  "Add input validation to configuration loader",
  "Improve error messages in API client",
  "Document analytics output format",
  "Add retry logic for transient network failures",
  "Normalise date handling across modules",
  "Extract shared constants into a dedicated file",
  "Add integration test scaffold",
  "Improve logging granularity in orchestrator loop",
  "Review and tighten TypeScript strict mode settings",
  "Add health-check endpoint for monitoring",
  "Reduce cyclomatic complexity in merge manager",
  "Standardise branch naming convention",
  "Update dependencies to latest stable versions",
  "Add CONTRIBUTING.md with development guidelines",
];

const ISSUE_BODIES: readonly string[] = [
  "## Problem\nThe current implementation could benefit from improved clarity and maintainability.\n\n## Proposed Solution\nRefactor the affected module with smaller, well-named functions and add inline documentation.\n\n## Acceptance Criteria\n- [ ] Code compiles with no new warnings\n- [ ] Existing behaviour is preserved",
  "## Context\nAs the project grows, we need better input validation to catch misconfigurations early.\n\n## Details\nAdd runtime checks for all required environment variables and surface actionable error messages.\n\n## Acceptance Criteria\n- [ ] Invalid config throws with a human-readable message\n- [ ] All env vars documented in `.env.example`",
  "## Motivation\nImproved developer experience when debugging failed API calls.\n\n## Plan\n1. Wrap Octokit errors with contextual messages\n2. Log request URL and status code at debug level\n3. Surface rate-limit headers when relevant\n\n## Acceptance Criteria\n- [ ] Errors include the GitHub API endpoint\n- [ ] Rate-limit warnings appear proactively",
  "## Overview\nThe analytics module outputs data but the format is undocumented.\n\n## Task\nAdd a section to the README (or a dedicated doc) explaining each metric, its unit, and how it is calculated.\n\n## Acceptance Criteria\n- [ ] Every metric has a one-line description\n- [ ] Example output is included",
  "## Objective\nTransient 5xx responses from GitHub should not abort the entire run.\n\n## Approach\nImplement exponential back-off with jitter, capped at 3 retries.\n\n## Acceptance Criteria\n- [ ] Retries are logged at warn level\n- [ ] Non-retriable errors (4xx) are surfaced immediately",
];

const PR_DESCRIPTIONS: readonly string[] = [
  "This pull request addresses the linked issue by refactoring the relevant module.\n\nChanges:\n- Extracted helper functions for clarity\n- Added inline comments explaining intent\n- No behavioural changes; all existing tests pass",
  "Implements the improvement described in the linked issue.\n\nHighlights:\n- Added validation logic with clear error messages\n- Updated `.env.example` to reflect new variables\n- Manual smoke-test passed",
  "Resolves the linked issue.\n\nSummary of changes:\n- Improved error wrapping in the API client\n- Added debug-level logging for request metadata\n- Covered edge cases for rate-limit responses",
  "This PR adds documentation and minor code clean-up.\n\nDelta:\n- New section in README documenting analytics output\n- Corrected a few typos in inline comments\n- No logic changes",
  "Introduces retry logic for transient failures.\n\nDetails:\n- Exponential back-off with jitter (max 3 attempts)\n- Logs each retry at warn level\n- Non-retriable errors surface immediately",
];

const COMMENTS: readonly string[] = [
  "Looks good to me — clean implementation. Nice work!",
  "I reviewed the changes and everything looks solid. Ready to merge.",
  "Thanks for tackling this. The refactor makes the code much easier to follow.",
  "One minor thought: we might want to add a comment explaining the retry ceiling, but it's fine as-is too.",
  "LGTM. The validation messages are really helpful for onboarding new contributors.",
  "Tested locally and confirmed the fix works as expected. Ship it!",
  "Appreciate the thorough PR description — makes the review a breeze.",
  "Great improvement to the logging output. This will save debugging time.",
];

const FILE_CONTENTS: readonly string[] = [
  '/**\n * This module provides shared constants used across the project.\n *\n * Centralising magic values here avoids duplication and makes\n * future changes easier to audit.\n */\n\nexport const MAX_RETRIES = 3;\nexport const RETRY_BASE_MS = 1000;\nexport const DEFAULT_PAGE_SIZE = 30;\n',
  '/**\n * Utility: deepFreeze\n *\n * Recursively freezes an object so it cannot be mutated at runtime.\n * Useful for configuration and constant objects.\n */\n\nexport function deepFreeze<T extends Record<string, unknown>>(obj: T): Readonly<T> {\n  for (const key of Object.keys(obj)) {\n    const value = obj[key];\n    if (typeof value === "object" && value !== null) {\n      deepFreeze(value as Record<string, unknown>);\n    }\n  }\n  return Object.freeze(obj);\n}\n',
  '/**\n * Utility: sanitiseInput\n *\n * Strips control characters and trims whitespace.\n * Applied to any user-facing input before it reaches the API.\n */\n\nexport function sanitiseInput(raw: string): string {\n  return raw.replace(/[\\x00-\\x1F\\x7F]/g, "").trim();\n}\n',
  '/**\n * Utility: formatDuration\n *\n * Converts milliseconds into a human-friendly string.\n * E.g. 90000 → "1m 30s"\n */\n\nexport function formatDuration(ms: number): string {\n  const seconds = Math.floor(ms / 1000) % 60;\n  const minutes = Math.floor(ms / 60000) % 60;\n  const hours = Math.floor(ms / 3600000);\n  const parts: string[] = [];\n  if (hours > 0) parts.push(`${hours}h`);\n  if (minutes > 0) parts.push(`${minutes}m`);\n  parts.push(`${seconds}s`);\n  return parts.join(" ");\n}\n',
  '/**\n * Utility: assertNever\n *\n * Exhaustiveness check for TypeScript discriminated unions.\n * Calling this in a default/else branch guarantees at compile time\n * that every variant has been handled.\n */\n\nexport function assertNever(value: never): never {\n  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);\n}\n',
];

// Public accessors so other modules can request content easily.

export function getRandomIssueTitle(): string {
  return pickRandom(ISSUE_TITLES);
}

export function getRandomIssueBody(): string {
  return pickRandom(ISSUE_BODIES);
}

export function getRandomPRDescription(): string {
  return pickRandom(PR_DESCRIPTIONS);
}

export function getRandomComment(): string {
  return pickRandom(COMMENTS);
}

export function getRandomFileContent(): string {
  return pickRandom(FILE_CONTENTS);
}

// ---------------------------------------------------------------------------
// Co-author trailer
// ---------------------------------------------------------------------------

/**
 * Builds a Git "Co-authored-by" trailer.
 * Returns an empty string when co-author info is not configured,
 * so callers can safely append it to any commit message.
 */
export function coAuthorTrailer(): string {
  const { coAuthorName, coAuthorEmail } = config;
  if (!coAuthorName || !coAuthorEmail) return "";
  return `\n\nCo-authored-by: ${coAuthorName} <${coAuthorEmail}>`;
}

// ---------------------------------------------------------------------------
// File-path generator for commits
// ---------------------------------------------------------------------------

/** Deterministic, meaningful file path for the orchestrator to commit. */
export function generatedFilePath(slug: string): string {
  return `src/generated/${slug}.ts`;
}
