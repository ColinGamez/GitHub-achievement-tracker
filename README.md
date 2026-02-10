# GitHub Activity Orchestrator

A legitimate GitHub workflow automation and analytics tool that models real developer collaboration patterns. It creates issues, branches, commits, pull requests, and reviews — all via the GitHub API — and records detailed metrics about the resulting activity.

> **This project strictly follows the [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service). It operates exclusively within repositories you own, creates meaningful content, and does not interact with other users' repositories, inflate stars/forks, or generate spam.**

---

## Why This Exists

Modern development teams care about workflow health: how quickly issues get a first response, how long PRs sit before merge, and whether collaboration tooling keeps pace with the team. This orchestrator **automates a realistic development workflow** inside a single repository so you can:

- Study GitHub's event model and achievement system.
- Benchmark CI/CD pipelines and webhook integrations.
- Generate sample data for dashboard prototyping.
- Understand how GitHub computes profile achievements.

It is a **learning and development tool**, not an achievement farm.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     index.ts (orchestrator)             │
│                                                        │
│   for each iteration:                                  │
│     1. issueManager.createIssue()                      │
│     2. commentManager.quickResponseComment()           │
│     3. prManager.createPullRequest()                   │
│     4. commentManager.commentOnPR()                    │
│     5. mergeManager.mergePullRequest()                 │
│     6. analytics.record*()                             │
└──────────────────┬─────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │  githubClient.ts   │   Octokit wrapper + rate-limit handler
         └─────────┬─────────┘
                   │
         ┌─────────┴─────────┐
         │   config.ts        │   Env-driven, type-safe configuration
         └─────────┬─────────┘
                   │
         ┌─────────┴─────────┐
         │   analytics.ts     │   Metrics accumulation + persistence + reporting
         └───────────────────┘
```

### Module Responsibilities

| Module | Purpose |
| --- | --- |
| `config.ts` | Reads `.env`, validates, and exports a typed config singleton. |
| `githubClient.ts` | Initialises Octokit, handles rate limits, exposes branch/commit helpers. |
| `issueManager.ts` | Creates issues with meaningful content and manages labels. |
| `prManager.ts` | Creates branches, commits real files, and opens PRs referencing issues. |
| `commentManager.ts` | Posts contextual comments on issues and PRs. |
| `mergeManager.ts` | Merges PRs (reviewed or YOLO) and deletes feature branches. |
| `analytics.ts` | Records event timestamps, persists to JSON, generates reports. |
| `utils.ts` | Logging, content templates, slug generation, co-author trailer. |

---

## Setup

### Prerequisites

- **Node.js** ≥ 18
- A **GitHub repository** you own (public or private).
- A **GitHub Personal Access Token** with the following permissions:
  - Classic token: `repo`, `workflow`
  - Fine-grained token: Contents (R/W), Issues (R/W), Pull requests (R/W), Metadata (R)

### Installation

```bash
git clone https://github.com/<you>/github-activity-orchestrator.git
cd github-activity-orchestrator
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your token, owner, and repo name.
```

Key variables:

| Variable | Required | Description |
| --- | --- | --- |
| `GITHUB_TOKEN` | Yes | Personal access token or `GITHUB_TOKEN` secret. |
| `GITHUB_OWNER` | Yes | Repository owner (user or org). |
| `GITHUB_REPO` | Yes | Repository name. |
| `CO_AUTHOR_NAME` | No | Co-author name for Pair Extraordinaire. |
| `CO_AUTHOR_EMAIL` | No | Co-author email. |
| `YOLO_MODE` | No | `true` to merge without review (YOLO achievement). |
| `AUTO_MERGE` | No | `true` (default) to auto-merge PRs. |
| `MAX_ISSUES_PER_RUN` | No | Issues created per run (default `1`). |
| `MAX_PRS_PER_RUN` | No | PRs opened per run (default `1`). |

See [`.env.example`](.env.example) for the full list.

### Seed (optional)

Run the seed script once to verify credentials and prepare the repo:

```bash
npm run seed
```

### Run Locally

```bash
# Development (ts-node)
npm run dev

# Or compile first
npm run build
npm start
```

### Run via GitHub Actions

Push the repository to GitHub. The included workflow (`.github/workflows/orchestrator.yml`) will:

- Run automatically on weekdays at 10:00 and 15:00 UTC.
- Support manual dispatch via the **Actions** tab.
- Use the repository's built-in `GITHUB_TOKEN` — no extra secrets needed for basic operation.

To enable co-authored commits in CI, add `CO_AUTHOR_NAME` and `CO_AUTHOR_EMAIL` as repository secrets.

---

## Analytics

Every run records metrics to `data/analytics.json` and prints a console summary:

```
========================================
  GitHub Activity Orchestrator — Stats
========================================
  Total runs .............. 12
  Issues created .......... 12
  Issues closed ........... 12
  PRs opened .............. 12
  PRs merged .............. 12
  YOLO merges ............. 3
  Comments posted ......... 36
  Co-authored commits ..... 9
  Avg issue→comment ....... 2s
  Avg PR→merge ............ 8s
========================================
```

A Markdown report is also written to `analytics.md` and can be committed back to the repo automatically by the GitHub Actions workflow.

---

## Security & Terms of Service

This tool is designed with safety as a first-class concern:

- **Single-repo scope**: The orchestrator only operates on the repository named in your config. It never touches other users' repos.
- **No star/fork manipulation**: The tool does not star, fork, or watch repositories.
- **No spam**: All comments, issue bodies, and PR descriptions are drawn from curated, meaningful templates.
- **Rate-limit awareness**: API calls are wrapped in a handler that respects `Retry-After` headers.
- **Idempotent**: Running the orchestrator multiple times creates new, non-conflicting resources.
- **Transparent**: Every action is logged, every metric is recorded, and the full source is open.

We recommend running the orchestrator on a **private repository** for experimentation to avoid cluttering public contribution graphs.

---

## Why This Is NOT an Achievement Farm

1. **All content is meaningful.** Issues have real titles, bodies, and labels. PRs contain actual TypeScript files with documentation and logic.
2. **The tool runs on your own repository only.** It does not interact with other users or repositories.
3. **Workflows model genuine development.** The issue → branch → commit → PR → review → merge cycle is the same workflow used by millions of developers daily.
4. **Analytics are the primary output.** The orchestrator is a measurement tool first and foremost.
5. **Achievements are a side-effect, not a goal.** Understanding how GitHub's achievement system works through your own repos, using legitimate interactions, is no different from understanding how CI or branch protection works.

See [ACHIEVEMENTS.md](ACHIEVEMENTS.md) for a detailed breakdown of how each workflow relates to specific GitHub achievements.

---

## License

MIT
