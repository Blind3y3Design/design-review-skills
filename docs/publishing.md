# Releasing the design review skills

The skills are released together, under one version, and published exactly as they stand in the release ([ADR 0007](adr/0007-publish-skills-exactly-as-released.md)). What the version covers follows [ADR 0009](adr/0009-versioning-policy-and-public-contract.md), how a release moves from a branch to `main` follows [ADR 0010](adr/0010-branching-and-branch-protection.md), and who cuts and approves follows [ADR 0011](adr/0011-release-governance-and-ownership.md). This is the owner's checklist for each release. It needs Node 18 or later, the [`gh` CLI](https://cli.github.com/) logged in to this repo, push rights, and publishing rights for skills in the owning team's Figma file.

The first release has thirteen skills: the Orchestrator `design-review`, the Review Skills `design-review-accessibility` and `design-review-library`, the Report Writer `design-review-report-writer`, the Design Scanner `design-review-scanner` and its six scanning skills `design-review-scanner-colour-pairs`, `design-review-scanner-text`, `design-review-scanner-structure`, `design-review-scanner-annotations`, `design-review-scanner-bindings` and `design-review-scanner-components`, the Profile Finder `design-review-profile` and the Figma Writer `design-review-figma-writer`. `design-review-research` joins with research alignment ([#50](https://github.com/Blind3y3Design/design-review-skills/issues/50)): publish it with the other Review Skills, after the Report Writer and before the Orchestrator, when it does.

## Where the version lives

The version's single source of truth is the private root **`package.json` `version`**. release-please owns it and the `CHANGELOG.md`, and writes every version surface itself — its Release PR branch is force-pushed, so no commit anyone else adds there survives. It writes them through `extra-files` with `x-release-please-version` markers, each version surface on its own annotated line so the first semver on the line is the one replaced:

- **`metadata.version`** in each skill's frontmatter — a YAML comment, stripped when an agent parses the frontmatter.
- **The `Version <version> of the design review skills.` line** under the title — an HTML comment, invisible when rendered. Claude Code strips a skill's frontmatter when it loads it, so this line is what a skill reads at run time. Every report's `run.setVersion` comes from it, and so does the Orchestrator's warning that a skill it invokes is at a different version (ADR 0007).
- **The default Reference Document links**, in the skills that have any (the Review Skills), `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/<ref>/reference-documents/…`. A release pins `<ref>` to its tag, `v<version>`, so a published skill reads the documents it was released with.
- `package.json` itself and `CHANGELOG.md`.

`scripts/release.mjs` **checks** the result; it no longer owns the version:

- `node scripts/release.mjs check` reads the expected version from `package.json` and fails if any skill's `metadata.version`, Version line or pinned link disagrees. It also fails any `SKILL.md` over 65,536 characters (not bytes), Figma's limit for a skill: cut that skill before releasing.
- `node scripts/release.mjs check --release <version>` does the same against an explicit version, for checking a tag.
- `node scripts/release.mjs install-check Blind3y3Design/design-review-skills` runs `npx skills add Blind3y3Design/design-review-skills --all` in a scratch project and fails unless exactly the skills in `skills/` arrive: all thirteen, and none of the vendored development skills in `.agents/skills/`.

`schemaVersion` and `factsVersion` change when a field's format or meaning changes, never with a release; each change ships in a set release at matching magnitude (ADR 0009).

## Cutting a release

1. **Run the smoke suite once, in both runtimes.**
   - Run every case in [`tests/smoke/README.md`](../tests/smoke/README.md) in an external agent and in Figma Design's agent, with the hand checks that table and the check tables list. A case marked as running in one runtime only, such as DS-01-no-baseline, runs there. Run the whole suite once, spread over days if the Figma MCP's daily calls run out: between releases, tickets run only the cases they affect.
   - Run the script tests: `node --test tests/scripts/*.test.mjs tests/smoke/compare.test.mjs`.
   - The checks that need someone with view-only access to the test file, and a second Figma file, are the owner's to arrange.
2. **Land the work on `integration`.** Changes arrive by pull request from short-lived branches; `integration` is squash-only, so the PR title becomes the commit message, and Conventional Commits are enforced on PR titles in CI (ADR 0010). Anything user-visible worth a changelog entry is a `feat` or a `fix`.
3. **Review and merge the Release PR.** release-please opens and updates one standing Release PR on `integration`: the version bump in `package.json`, the `CHANGELOG.md`, and every skill stamped with the new version. CI runs on it (release-please authenticates with a GitHub App token or a fine-grained PAT so workflows fire). This PR *is* the gate (ADR 0011): check that the bump matches the changes — the versioning rules are in ADR 0009 — that `check` passes, and that the changelog reads right, then merge it.
4. **Tag and GitHub Release.** Merging the Release PR makes release-please tag `v<version>` on `integration` and create the GitHub Release, with notes generated from the Conventional Commits. Edit the notes before or right after: state what changed since the last release in the user's terms, the skills in the set, any change to `schemaVersion` or `factsVersion`, and known gaps.
5. **`main` fast-forwards.** A release workflow pushes `main` to the tagged commit — a plain fast-forward, not a force-push — so `main`'s tip equals the tag and unpinned consumers installing from the default branch get the release (ADR 0010). Nothing is merged to `main` by hand.
6. **Check the tag and the install.**
   - Every pinned link returns 200 (a `404` means the tag isn't pushed or the file isn't at it):
     ```
     git grep -ohE 'https://raw.githubusercontent.com/[^` )]+' v<version> -- skills | sort -u | xargs -n1 curl -sSfLI -o /dev/null -w '%{http_code} %{url_effective}\n'
     ```
   - Run `node scripts/release.mjs check --release <version>` against the tag, and `node scripts/release.mjs install-check Blind3y3Design/design-review-skills`. The install check installs from the default branch, so run it after step 5 has fast-forwarded `main`.
   - **Update check,** from the second release on: in a scratch project installed from the previous release, `npx skills update` brings every skill to the new version. Look at the `Version` line in `.agents/skills/<name>/SKILL.md`.
   - Record the install check's result, and the update check's, in the release notes.
7. **Publish by hand in Figma.** Use one dedicated file in the owning team, and publish to the organisation. Take each skill's `SKILL.md` from the tag (`git show v<version>:skills/<name>/SKILL.md`), unedited. Publish in dependency order, so a skill is published after the skills it invokes:
   1. `design-review-figma-writer`, `design-review-profile`, and the Design Scanner's six scanning skills `design-review-scanner-colour-pairs`, `design-review-scanner-text`, `design-review-scanner-structure`, `design-review-scanner-annotations`, `design-review-scanner-bindings` and `design-review-scanner-components`, which invoke no other skill
   2. `design-review-scanner`, which invokes the scanning skills
   3. `design-review-report-writer`
   4. `design-review-library` and `design-review-accessibility`
   5. `design-review`

   Later releases replace the file's skills and use **Publish changes**. Figma Community publishing waits for a stable 1.0.
8. **Check the published set.** In Figma Design's agent, ask `/design-review` which versions of the review skills are installed (RUN-05 in the smoke test). It must list the thirteen skills, each at the new version and no `design-review-research` line (it joins the list in v0.2), and end "All installed skills are at <version>." Then run `/design-review` on a smoke case frame, such as X-01 with the test profile: the report's Skills line must name the new version, and the report must carry no version warning.
9. **Close the loop in the release notes.** The Figma publish is out of band (ADR 0011): append to the GitHub Release notes what was published and when, the install and update check results from step 6, and any known gaps left open. The GitHub Release is not done until this follow-up is recorded.

## Pre-releases

A pre-release (alpha, beta or rc — the identifiers and their meanings are in ADR 0009) is cut on demand: the owner adds a commit with the footer `Release-As: <version>`, such as `Release-As: 0.2.0-beta.1`, and release-please opens the Release PR for exactly that version and marks the GitHub Release a pre-release. From there it is steps 3, 4 and 6 as usual, but not step 5: the tag stays on `integration`, `main` does not move, and pre-releases are **not promoted** — a consumer opts in by pinning `#v<version>-beta.1`. A pre-release may go out with parts of step 1 not yet run, as long as its notes list what wasn't run under known gaps.

## Setting the version by hand

Only if the toolchain can't run: `node scripts/release.mjs set <version>` writes the version everywhere the checker reads it. It changes nothing if any skill is missing its `metadata.version`, its Version line or its pinned link. Check the result against `node scripts/release.mjs check --release <version>` on another machine before tagging. `set` is an emergency writer, not the release path: releases go through release-please (ADR 0011).
