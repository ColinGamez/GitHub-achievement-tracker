/**
 * analytics.ts — Record, persist, and report orchestrator metrics.
 *
 * Every interesting event (issue opened, PR merged, comment posted, etc.)
 * is fed into this module.  The analytics engine:
 *
 *   1. Accumulates metrics in memory.
 *   2. Persists them to a JSON file on disk after each run.
 *   3. Prints a console summary.
 *   4. Generates Markdown output suitable for appending to a file
 *      (e.g. analytics.md or the repo README).
 *
 * Persistence format: a single JSON file whose schema is the
 * `AnalyticsData` interface exported below.
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "./config";
import { log } from "./utils";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** A single orchestrated run's record. */
export interface RunRecord {
  /** ISO-8601 start time. */
  startedAt: string;
  /** ISO-8601 end time. */
  finishedAt: string;
  /** Issues created during this run. */
  issuesCreated: number;
  /** Issues closed (via PR merge or explicit close). */
  issuesClosed: number;
  /** PRs opened. */
  prsOpened: number;
  /** PRs merged. */
  prsMerged: number;
  /** YOLO merges (merged without review). */
  yoloMerges: number;
  /** Comments posted. */
  commentsPosted: number;
  /** Co-authored commits made. */
  coAuthoredCommits: number;
  /** Milliseconds from issue creation to first comment. */
  issueToFirstCommentMs: number[];
  /** Milliseconds from PR open to merge. */
  prOpenToMergeMs: number[];
}

/** Root analytics structure persisted to disk. */
export interface AnalyticsData {
  /** Monotonically incrementing version for forward compatibility. */
  version: number;
  /** Every run recorded to date. */
  runs: RunRecord[];
}

// ---------------------------------------------------------------------------
// In-memory accumulator for the current run
// ---------------------------------------------------------------------------

/** Mutable counters populated during the current orchestrator run. */
interface RunAccumulator {
  startedAt: string;
  issuesCreated: number;
  issuesClosed: number;
  prsOpened: number;
  prsMerged: number;
  yoloMerges: number;
  commentsPosted: number;
  coAuthoredCommits: number;
  issueToFirstCommentMs: number[];
  prOpenToMergeMs: number[];
}

let current: RunAccumulator | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Begin tracking a new run.  Must be called before any record* functions. */
export function startRun(): void {
  current = {
    startedAt: new Date().toISOString(),
    issuesCreated: 0,
    issuesClosed: 0,
    prsOpened: 0,
    prsMerged: 0,
    yoloMerges: 0,
    commentsPosted: 0,
    coAuthoredCommits: 0,
    issueToFirstCommentMs: [],
    prOpenToMergeMs: [],
  };
  log.debug("Analytics run started.");
}

/** Finalise the current run, persist, and return the record. */
export function endRun(): RunRecord {
  if (!current) throw new Error("endRun called before startRun");

  const record: RunRecord = {
    ...current,
    finishedAt: new Date().toISOString(),
  };

  // Persist to disk.
  const allData = loadPersistedData();
  allData.runs.push(record);
  savePersistedData(allData);

  log.debug("Analytics run ended and persisted.");
  current = null;
  return record;
}

// ---------------------------------------------------------------------------
// Recording helpers (called by the orchestrator during a run)
// ---------------------------------------------------------------------------

function ensureRunning(): RunAccumulator {
  if (!current) throw new Error("Analytics: no run in progress. Call startRun() first.");
  return current;
}

export function recordIssueCreated(): void {
  ensureRunning().issuesCreated++;
}

export function recordIssueClosed(): void {
  ensureRunning().issuesClosed++;
}

export function recordPROpened(): void {
  ensureRunning().prsOpened++;
}

export function recordPRMerged(yolo: boolean): void {
  const acc = ensureRunning();
  acc.prsMerged++;
  if (yolo) acc.yoloMerges++;
}

export function recordCommentPosted(): void {
  ensureRunning().commentsPosted++;
}

export function recordCoAuthoredCommit(): void {
  ensureRunning().coAuthoredCommits++;
}

/**
 * Record the latency between issue creation and first comment.
 * @param issueCreatedAt - ISO string from the GitHub API response.
 * @param commentCreatedAt - ISO string from the comment response.
 */
export function recordIssueToComment(
  issueCreatedAt: string,
  commentCreatedAt: string
): void {
  const ms =
    new Date(commentCreatedAt).getTime() -
    new Date(issueCreatedAt).getTime();
  ensureRunning().issueToFirstCommentMs.push(Math.max(ms, 0));
}

/**
 * Record the latency between PR open and merge.
 * @param prCreatedAt - ISO string from the PR creation response.
 * @param mergedAt    - ISO string from the merge response.
 */
export function recordPRToMerge(
  prCreatedAt: string,
  mergedAt: string
): void {
  const ms =
    new Date(mergedAt).getTime() - new Date(prCreatedAt).getTime();
  ensureRunning().prOpenToMergeMs.push(Math.max(ms, 0));
}

// ---------------------------------------------------------------------------
// Persistence (JSON file)
// ---------------------------------------------------------------------------

function emptyData(): AnalyticsData {
  return { version: 1, runs: [] };
}

function loadPersistedData(): AnalyticsData {
  const filePath = config.analyticsPath;
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as AnalyticsData;
      if (parsed.version && Array.isArray(parsed.runs)) return parsed;
    }
  } catch (err) {
    log.warn(`Could not read analytics file at ${filePath}:`, err);
  }
  return emptyData();
}

function savePersistedData(data: AnalyticsData): void {
  const filePath = config.analyticsPath;
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  log.info(`Analytics persisted to ${filePath}`);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Aggregate statistics across all historical runs. */
export interface AggregateStats {
  totalRuns: number;
  totalIssuesCreated: number;
  totalIssuesClosed: number;
  totalPRsOpened: number;
  totalPRsMerged: number;
  totalYoloMerges: number;
  totalComments: number;
  totalCoAuthoredCommits: number;
  avgIssueToCommentMs: number;
  avgPRToMergeMs: number;
}

/** Compute aggregate stats from persisted data. */
export function getAggregateStats(): AggregateStats {
  const data = loadPersistedData();
  const runs = data.runs;

  const allIssueToComment = runs.flatMap((r) => r.issueToFirstCommentMs);
  const allPRToMerge = runs.flatMap((r) => r.prOpenToMergeMs);

  return {
    totalRuns: runs.length,
    totalIssuesCreated: sum(runs.map((r) => r.issuesCreated)),
    totalIssuesClosed: sum(runs.map((r) => r.issuesClosed)),
    totalPRsOpened: sum(runs.map((r) => r.prsOpened)),
    totalPRsMerged: sum(runs.map((r) => r.prsMerged)),
    totalYoloMerges: sum(runs.map((r) => r.yoloMerges)),
    totalComments: sum(runs.map((r) => r.commentsPosted)),
    totalCoAuthoredCommits: sum(runs.map((r) => r.coAuthoredCommits)),
    avgIssueToCommentMs: avg(allIssueToComment),
    avgPRToMergeMs: avg(allPRToMerge),
  };
}

/** Print a human-readable summary to the console. */
export function printConsoleSummary(): void {
  const stats = getAggregateStats();
  console.log("\n========================================");
  console.log("  GitHub Activity Orchestrator — Stats  ");
  console.log("========================================");
  console.log(`  Total runs .............. ${stats.totalRuns}`);
  console.log(`  Issues created .......... ${stats.totalIssuesCreated}`);
  console.log(`  Issues closed ........... ${stats.totalIssuesClosed}`);
  console.log(`  PRs opened .............. ${stats.totalPRsOpened}`);
  console.log(`  PRs merged .............. ${stats.totalPRsMerged}`);
  console.log(`  YOLO merges ............. ${stats.totalYoloMerges}`);
  console.log(`  Comments posted ......... ${stats.totalComments}`);
  console.log(`  Co-authored commits ..... ${stats.totalCoAuthoredCommits}`);
  console.log(
    `  Avg issue→comment ....... ${formatMs(stats.avgIssueToCommentMs)}`
  );
  console.log(
    `  Avg PR→merge ............ ${formatMs(stats.avgPRToMergeMs)}`
  );
  console.log("========================================\n");
}

/**
 * Generate a Markdown report string suitable for writing to a file.
 */
export function generateMarkdownReport(): string {
  const stats = getAggregateStats();
  const now = new Date().toISOString();

  return [
    "## 📊 Orchestrator Analytics",
    "",
    `_Last updated: ${now}_`,
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Total runs | ${stats.totalRuns} |`,
    `| Issues created | ${stats.totalIssuesCreated} |`,
    `| Issues closed | ${stats.totalIssuesClosed} |`,
    `| PRs opened | ${stats.totalPRsOpened} |`,
    `| PRs merged | ${stats.totalPRsMerged} |`,
    `| YOLO merges | ${stats.totalYoloMerges} |`,
    `| Comments posted | ${stats.totalComments} |`,
    `| Co-authored commits | ${stats.totalCoAuthoredCommits} |`,
    `| Avg issue → first comment | ${formatMs(stats.avgIssueToCommentMs)} |`,
    `| Avg PR open → merge | ${formatMs(stats.avgPRToMergeMs)} |`,
    "",
  ].join("\n");
}

/**
 * Write (overwrite) the Markdown report to a local file.
 */
export function writeMarkdownReport(
  filePath: string = path.resolve(__dirname, "..", "analytics.md")
): void {
  const content = generateMarkdownReport();
  fs.writeFileSync(filePath, content, "utf-8");
  log.info(`Markdown analytics report written to ${filePath}`);
}

// ---------------------------------------------------------------------------
// Internal math helpers
// ---------------------------------------------------------------------------

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : sum(nums) / nums.length;
}

function formatMs(ms: number): string {
  if (ms === 0) return "n/a";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}
