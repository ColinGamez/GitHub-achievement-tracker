# Achievement Mapping

This document explains how the orchestrator's workflows naturally align with GitHub's profile achievements. Every interaction is **legitimate, meaningful, and confined to your own repository**.

---

## Targeted Achievements

### Pull Shark

| Detail | |
| --- | --- |
| **Requirement** | Have pull requests merged. |
| **Tiers** | Bronze (2 PRs), Silver (16 PRs), Gold (128 PRs), Platinum (1024 PRs). |
| **How the orchestrator triggers it** | Each run opens one or more PRs with real code changes and merges them via the API. Over time, successive runs accumulate merged PRs. |
| **Relevant module** | `prManager.ts`, `mergeManager.ts` |
| **Why it is legitimate** | The PRs contain actual TypeScript utility files, reference real issues, and include descriptive bodies. This is identical to a developer merging their own feature branches. |

---

### Pair Extraordinaire

| Detail | |
| --- | --- |
| **Requirement** | Be a co-author on a merged pull request's commit. |
| **Tiers** | Bronze (1), Silver (10), Gold (24), Platinum (48). |
| **How the orchestrator triggers it** | When `CO_AUTHOR_NAME` and `CO_AUTHOR_EMAIL` are configured, every commit includes a `Co-authored-by:` Git trailer. GitHub parses this trailer and credits both authors. |
| **Relevant module** | `utils.ts` (`coAuthorTrailer()`), `prManager.ts` |
| **Why it is legitimate** | Co-authored commits are an officially supported Git convention. The co-author must be a real GitHub user who has agreed to collaborate. |

---

### Quickdraw

| Detail | |
| --- | --- |
| **Requirement** | Close an issue or comment very quickly after it is opened (within ~5 minutes). |
| **Tiers** | Single tier. |
| **How the orchestrator triggers it** | Immediately after creating an issue, the orchestrator posts a contextual comment via `commentManager.quickResponseComment()`. The time between issue creation and first comment is typically under 5 seconds. |
| **Relevant module** | `commentManager.ts`, `index.ts` |
| **Why it is legitimate** | Fast responses happen naturally in active teams. The comment content is a meaningful review phrase, not filler. |

---

### YOLO

| Detail | |
| --- | --- |
| **Requirement** | Merge a pull request without any review. |
| **Tiers** | Single tier. |
| **How the orchestrator triggers it** | When `YOLO_MODE=true`, the orchestrator merges PRs immediately without posting a review comment first. The PR has no approving review and no review comments at merge time. |
| **Relevant module** | `mergeManager.ts`, `config.ts` |
| **Why it is legitimate** | Merging your own PR without review is standard practice on solo projects and is explicitly supported by GitHub. The config flag is off by default and must be opted into. |

---

### Galaxy Brain (Optional)

| Detail | |
| --- | --- |
| **Requirement** | Have your answer to a Discussion marked as the accepted answer. |
| **Tiers** | Bronze (1), Silver (8), Gold (16), Platinum (32). |
| **How the orchestrator relates** | The orchestrator does **not** automate Discussions because the Discussions API is more restrictive and achievement criteria require another user to mark your answer as accepted. |
| **Potential extension** | You could add a module that creates Discussion posts with helpful Q&A content, but acceptance must be manual. This is left as an exercise for the developer. |

---

## Achievements NOT Targeted

The following achievements are intentionally **out of scope** because automating them would violate GitHub's Terms of Service or require interaction with other users' repositories:

| Achievement | Why it is excluded |
| --- | --- |
| **Starstruck** | Requires other users to star your repo. Automating stars would be manipulation. |
| **Arctic Code Vault** | Historical — based on the 2020 GitHub Archive Program. Cannot be earned retroactively. |
| **Mars 2020 Contributor** | Historical — based on the Mars Helicopter mission. |
| **Sponsor** | Requires financial transactions via GitHub Sponsors. |
| **Public Sponsor** | Same as above, with public visibility. |

---

## Ethical Guidelines

1. **Run on your own repos only.** Never point the orchestrator at a repository you do not own.
2. **Use a private repo for experimentation.** This keeps your contribution graph clean and avoids confusing other users.
3. **Co-author with consent.** Only add a co-author trailer for someone who has agreed to participate.
4. **Do not inflate metrics.** The orchestrator's defaults (`MAX_ISSUES_PER_RUN=1`, `MAX_PRS_PER_RUN=1`) are intentionally conservative. Cranking them up to high values is your choice, but we recommend moderation.
5. **Review the output.** Periodically check the issues and PRs the orchestrator creates. Clean up anything that no longer serves a purpose.

---

## Summary Table

| Achievement | Workflow | Auto? | Config Flag |
| --- | --- | --- | --- |
| Pull Shark | Open + merge PRs | Yes | `AUTO_MERGE=true` |
| Pair Extraordinaire | Co-authored commits | Yes | `CO_AUTHOR_NAME` / `CO_AUTHOR_EMAIL` |
| Quickdraw | Fast comment after issue creation | Yes | Always on |
| YOLO | Merge without review | Yes | `YOLO_MODE=true` |
| Galaxy Brain | Discussion answers | No | Manual only |
