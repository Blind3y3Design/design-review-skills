# The owner cuts and approves releases; the Release PR is the human gate

Releasing this set is a one-owner operation, and the model says so plainly. The owner decides what goes in a release, runs the smoke suite, merges the Release PR, and publishes in Figma. Two GitHub facts shape how that is enforced: a ruleset can require code-owner review, but GitHub blocks a solo author from approving their own pull request, so enforcing it on a solo repo would deadlock every merge; and a pull request opened with the built-in `GITHUB_TOKEN` triggers no other workflows, so release-please's Release PR would sit forever with its required CI check pending.

**Ownership.** CODEOWNERS names the owner for `skills/`, `docs/adr/`, `docs/publishing.md` and `.github/` — for **awareness only** while there is one owner. "Require code-owner review" stays off, and both branches require a pull request with **0 approvals**. The whole setup lifts the moment a second maintainer exists: switch code-owner review on and raise required approvals to 1. CODEOWNERS never blocks while solo; it is a notification, not a gate.

**The Release PR is the gate.** release-please keeps one standing Release PR on `integration`: the version bump, the `CHANGELOG.md` and the stamped skills (ADR 0010). Nothing becomes a release until the owner reviews and merges it — that merge is the human approval, which is why the rulesets need no approvals of their own yet. release-please authenticates with a GitHub App token or a fine-grained PAT so CI runs on the Release PR; the fallback, if that token is too heavy, is to put the release bot on the ruleset bypass list.

**The Figma publish is out of band.** The GitHub Release is cut by the merge; publishing the skills by hand in Figma comes afterwards, from the tag, in dependency order (see [docs/publishing.md](../publishing.md)). The release notes carry it as a follow-up: what has been published, what the install and update checks found, and any known gaps. Who may publish per tier, what "Publish changes" implies, and Figma-side rollback are out of scope here and revisited later.

## Consequences

- No release ships without the owner merging the Release PR; there is no push-to-`main` path (ADR 0010), and no automation can cut a release on its own.
- With one owner, review overhead is zero: one required CI check and one deliberate merge carry the gate. Adding a second maintainer changes exactly two settings — code-owner review on, approvals to 1 — rather than reworking the model.
- A GitHub Release can exist before the Figma publish completes; the notes record the gap until the follow-up closes it, so the two surfaces never silently disagree.
- CI on Release PRs depends on the App/PAT token; dropping it without taking the bypass-list fallback leaves every Release PR blocked on a check that never runs.
- Release-please writes version surfaces itself (its PR branch is force-pushed), `release.mjs` only checks them, and the owner's approval of the PR is what makes those stamped surfaces real.
