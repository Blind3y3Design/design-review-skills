# Research: release governance for a small public GitHub repo

All claims cite GitHub's own documentation. "Free" = GitHub Free plan; "public" = a public repository.

## 1. Repository Rulesets vs legacy branch protection

- Docs now position branch protection rules as the legacy alternative ("For information about an alternative to branch protection rules, see About rulesets"). Both enforce together ([About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches); [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)).
- Both can require: PR reviews, status checks, conversation resolution, signed commits, linear history, merge queue, deployment success; plus lock branch, force-push/deletion control, push restrictions ([Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)).
- Rulesets advantages: multiple rulesets per branch (only one classic rule applies), enforcement status Active/Disabled/Evaluate, visible to readers, most-restrictive-wins ([About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets); [Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)).
- **Availability:** "Rulesets are available in **public repositories with GitHub Free**…" ([Available rules](https://docs.github.com/en/enterprise-server@3.12/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)). Require-signed-commits works on Free/public.
- **Push rulesets are NOT for public repos** — private/internal only ([About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)). Cannot path-block `.github/workflows/` on this repo.
- Bypass list configurable (admins, roles, apps, Dependabot); classic protection excludes admins by default unless "Do not allow bypassing" is on ([Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository); [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).

## 2. Required status checks

- A required check must conclude `successful`, `skipped`, or `neutral`. Must pass on the latest commit SHA; a check must have succeeded in-repo within 7 days ([About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches); [Troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)).
- Two types: **checks** (Apps incl. Actions) and **commit statuses** (external). Actions generates checks ([Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)).
- **Pending-forever trap:** a workflow skipped by `paths:`/branch filtering or a commit-message skip leaves checks **Pending**, blocking merge. A **job** skipped by an `if:` reports **Success** ([Troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks); [Workflow syntax](https://docs.github.com/actions/reference/workflow-syntax-for-github-actions)).
- **"Skipped is success":** "A job that is skipped will report its status as 'Success'." Avoid requiring workflows that can be skipped by path/branch filters; keep the required workflow un-filtered and put path logic in jobs with `if:`. Workflow-triggered checks only count for `push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`, `deployment_status` — not `workflow_dispatch`. Job names must be unique across workflows ([Troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks); [Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)).

## 3. CODEOWNERS

- Locations searched in order: `.github/`, repo root, `docs/`. One file per branch; for review requests it must live on the **base branch**. Max 3 MB ([About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)).
- gitignore-style; **last matching pattern wins**; multiple owners on the same line; owners need explicit `write` access ([About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)).
- Auto-requests review when a PR touches owned code (not drafts). Forks use the base branch's file.
- **Cannot block a merge by itself** — needs "Require review from Code Owners" in a rule/ruleset. Any one owner's approval satisfies it.
- **Solo-repo deadlock:** "Pull request authors cannot approve their own pull requests." No setting lifts this. On a solo repo, code-owner review blocks you unless you're on the bypass list or scope it to sensitive paths ([Approving with required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews)).

## 4. Required reviewers / approvals

- `required_approving_review_count` accepts 1–6 (0 disables) ([REST API](https://docs.github.com/en/rest/branches/branch-protection)). `dismiss_stale_reviews`, `require_code_owner_reviews`, `require_last_push_approval` available.
- Ruleset "Required reviewers" (specific **teams**, up to 15) is **org-only** — "not available on user-owned repositories as they do not contain teams" ([Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)).
- Free/public: protected branches + code owners are full features ([GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)).
- One collaborator: ≥1 approval is unsatisfiable by a solo author. Admin bypass is default; enable "Do not allow bypassing" to bind yourself.

## 5. Linear history / squash-only

- "Require linear history" prevents merge commits (squash or rebase). Repo must allow squash/rebase first. The ruleset can require a specific merge type ([Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)).
- GitHub's **auto-generated release notes** are built from merged PRs grouped by label ([Auto notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)). Squash keeps one commit per PR; can be configured to use just the PR title ([Configuring squashing](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests)).

## 6. Merge queue

- Validates each PR (+ those ahead) against the latest base so incompatible changes never break the branch; "particularly useful on branches that have a relatively high number of pull requests merging each day" ([Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)).
- **Availability: "available in any public repository owned by an organization"**, or private org repos on Enterprise Cloud ([gated-features reusable](https://github.com/github/docs/blob/main/data/reusables/gated-features/merge-queue.md)). **Not available on a user/personal-owned repo at all.**
- Requires CI to also trigger on `merge_group`.

## 7. PR templates

- Locations: repo root, `docs/`, or `.github/`; must be on the default branch. Multiple templates via `.github/PULL_REQUEST_TEMPLATE/`, selected with `?template=` ([Creating a PR template](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)).
- Guidance only — enforces nothing.

## 8. GitHub Actions on public repos

- Free for public repos using **standard** GitHub-hosted runners; the Free plan's 2,000 min/month applies to private repos only ([Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions); [GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)). Larger runners are always charged.

## 9. Signed commits

- Methods: GPG, SSH (Git 2.34+), S/MIME ([About signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)). GitHub auto-signs web-UI commits.
- Enforcement requires rebasing/force-pushing existing unsigned commits. Rebase-and-merge does not signature-verify replayed commits. With required signing, you cannot squash-merge a PR on GitHub unless you are the author.
- For a single-maintainer docs repo, the marginal security gain is modest and the friction real. Treat as optional.

## Proportionate setup for a small public repo

One ruleset + three files, assuming a user-owned public repo on Free and one or two maintainers.

### A. Branch ruleset on the default branch (Active)
1. **Require a pull request before merging**, **Required approvals = 0** (forces the PR workflow without deadlocking a solo author). Raise to 1 when a second maintainer exists; add Dismiss stale reviews then.
2. **Require linear history** (and allow only squash merge).
3. **Require status checks** — the single CI job. Keep the workflow un-filtered; path logic in jobs with `if:`.
4. **Block force pushes** and **deletions**.
5. Leave **Require signed commits OFF** initially.
6. Set the bypass list thoughtfully; leaving yourself on it makes the gate declarative.

### B. `CODEOWNERS` (optional on a solo repo)
- `.github/CODEOWNERS`, assign maintainer(s). Leave **Require review from Code Owners OFF** while solo. Scope to sensitive paths once a second maintainer exists.

### C. `.github/pull_request_template.md`
- Short template: what/why, linked issue, test note, changelog-worthy title.

### D. `.github/workflows/ci.yml`
- One job on `ubuntu-latest` running `node --test`. Free/unlimited on public. Trigger on `pull_request`; do not use `paths:`. Add `merge_group:` only if a merge queue is later enabled. Unique job names.

### What is NOT possible here
- **Merge queue:** user-owned repos don't qualify.
- **Push rulesets** (path/size blocking): private/internal only.
- **Ruleset "Required reviewers" teams:** org-only.
- **Real approval gating with one human:** self-approval is blocked.
- **Org-wide rulesets:** Team/Enterprise only.
- **Commit-metadata restrictions** (enforce Conventional Commits via ruleset): Enterprise Cloud documented; don't count on Free.

### Sources
- About protected branches — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- About rulesets — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- Available rules for rulesets — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Creating rulesets — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
- Status checks — https://docs.github.com/en/pull-requests/reference/status-checks
- Troubleshooting required status checks — https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- About code owners — https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- Approving a pull request with required reviews — https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews
- Managing a merge queue — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- Merge queue gating — https://github.com/github/docs/blob/main/data/reusables/gated-features/merge-queue.md
- Automatically generated release notes — https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
- Creating a pull request template — https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository
- GitHub Actions billing — https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub's plans — https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- About commit signature verification — https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification
