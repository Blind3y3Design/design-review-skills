# Branch rulesets

Ruleset bodies for the two protected branches in the Integration-Gate Flow (ADR
[`0010-branching-and-branch-protection`](../../docs/adr/0010-branching-and-branch-protection.md),
decision [#85](https://github.com/Blind3y3Design/design-review-skills/issues/85)),
plus the script that applies them.

| File               | Applies to                       | Merge method          | Bypass list |
| ------------------ | -------------------------------- | --------------------- | ----------- |
| `main.json`        | `refs/heads/main`                | rebase only (fast-forward) | release GitHub App (placeholder ID) |
| `integration.json` | `refs/heads/integration`         | squash only           | nobody      |

Both rulesets: required pull request with **0 approvals**, required linear
history, required status checks `test` and `conventional-commit-title`, block
force-push, block deletion, enforcement `active`. Signed commits and the merge
queue are deliberately absent (merge queue is unavailable on user-owned
repositories; signed commits are off per #81).

## Preconditions — do not apply before these hold

1. **CI runs on the default branch.** `.github/workflows/ci.yml` (`test`) and
   `.github/workflows/pr-title.yml` (`conventional-commit-title`) must have
   reported at least once on `main`, and must keep reporting: a required check
   that has not run recently leaves every pull request unable to merge. Both
   workflows are deliberately path-unfiltered for this reason.
2. **The release GitHub App exists and is installed on this repository.**
   `main.json` names it as the only bypass actor (so `promote-main` can
   fast-forward `main`). Its `actor_id` is the **GitHub App ID**, not an
   installation ID. Find it on the app's settings page (Settings → Developer
   settings → GitHub apps → *app* → About → GitHub App ID), or, when `gh` is
   authenticated as that app, from `gh api /app --jq .id`. Export it as
   `RELEASE_APP_ID`. The script refuses to apply `main.json` while the
   `__RELEASE_APP_ID__` placeholder is unsubstituted.
3. **The `integration` branch exists** (create it from `main` first:
   `git push origin main:integration`). `integration.json` sets
   `do_not_enforce_on_create` so the bootstrap push does not need both status
   checks on the new branch tip.
4. **Repo merge methods allow it** (Settings → General → Pull requests):
   *Allow squash merging* and *Allow rebase merging* must both be on — a
   ruleset cannot require a merge method the repository has disabled.
   *Allow merge commits* may be left on or off; `required_linear_history`
   blocks them on both branches either way.
5. **`gh` is authenticated with admin access** to the repository (ruleset
   writes require the `administration` permission).

This is a **prepare-only** artifact: the rulesets must not be created on the
live repository until the blocking tickets (#86, #88) are merged and the
release App from #88 is provisioned.

## Apply

```sh
# print the payloads without touching the API
scripts/apply-rulesets.sh --dry-run

# create or update both rulesets
RELEASE_APP_ID=<github-app-id> scripts/apply-rulesets.sh
```

The script is idempotent: for each file it reads the ruleset `name`, looks for
an existing ruleset with that name, and issues `POST /repos/:owner/:repo/rulesets`
(create) or `PUT /repos/:owner/:repo/rulesets/:id` (update). It never deletes a
ruleset and never touches rulesets it does not manage. Re-running it after an
edit is the normal way to roll a change forward.

## Verify

```sh
# list: expect one `main` and one `integration`, both `active`
gh api repos/<owner>/<repo>/rulesets --jq '.[] | {id, name, enforcement}'

# full body of one ruleset (bypass list included when you have write access)
gh api repos/<owner>/<repo>/rulesets/<id>

# effective rules GitHub sees for a branch
gh api repos/<owner>/<repo>/rules/branches/main
gh api repos/<owner>/<repo>/rules/branches/integration
```

Also open a throwaway pull request targeting `integration` and confirm the
merge box lists `test` and `conventional-commit-title` as required checks, and
that only *Squash merge* is offered.

## Roll back

Roll back by deleting only these two rulesets (find their ids with the verify
command above):

```sh
gh api --method DELETE repos/<owner>/<repo>/rulesets/<main-ruleset-id>
gh api --method DELETE repos/<owner>/<repo>/rulesets/<integration-ruleset-id>
```

To keep the ruleset but stop enforcing it (for example to unblock a
fast-moving fix), edit `enforcement` to `evaluate` or `disabled` in the JSON
file and re-run `RELEASE_APP_ID=... scripts/apply-rulesets.sh` — a
`PUT /repos/:owner/:repo/rulesets/:id` replaces the whole body, so sending a
partial body would silently drop the rules.
