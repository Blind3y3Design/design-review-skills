# Releasing the design review skills

The skills are released together, under one version, and published exactly as they stand in the release ([ADR 0007](adr/0007-publish-skills-exactly-as-released.md)). A skill owner follows this checklist for each release. It needs Node 18 or later, the [`gh` CLI](https://cli.github.com/) logged in to this repo, push rights, and publishing rights for skills in the owning team's Figma file.

The first release has eight skills: the Orchestrator `design-review`, the Review Skills `design-review-accessibility` and `design-review-library`, the Report Writer `design-review-report-writer`, the Design Scanner `design-review-scanner` and `design-review-scanner-assets`, the Profile Finder `design-review-profile` and the Figma Writer `design-review-figma-writer`. `design-review-research` joins with research alignment ([#50](https://github.com/Blind3y3Design/design-review-skills/issues/50)): publish it with the other Review Skills, after the Report Writer and before the Orchestrator, when it does.

## Where the version lives

A release sets the version in two places in every skill, and pins a third in the skills that have one. `scripts/release.mjs` writes and checks all of them.

- **`metadata.version`** in the frontmatter.
- **The `Version <version> of the design review skills.` line** under the title. Claude Code strips a skill's frontmatter when it loads it, so this line is what a skill reads at run time. Every report's `run.setVersion` comes from it, and so does the Orchestrator's warning that a skill it invokes is at a different version (ADR 0007).
- **The default Reference Document links**, in the skills that have any (the Review Skills), `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/<ref>/reference-documents/…`. A release pins `<ref>` to its tag, `v<version>`, so a published skill reads the documents it was released with. A version ending in `-dev` uses `main`.

## Checklist

1. **Run the smoke suite once, in both runtimes.**
   - Run every case in [`tests/smoke/README.md`](../tests/smoke/README.md) in an external agent and in Figma Design's agent, with the hand checks that table and the check tables list. A case marked as running in one runtime only, such as DS-01-no-baseline, runs there. Run the whole suite once, spread over days if the Figma MCP's daily calls run out: between releases, tickets run only the cases they affect.
   - Run the script tests: `node --test tests/scripts/*.test.mjs tests/smoke/compare.test.mjs`.
   - The checks that need someone with view-only access to the test file, and a second Figma file, are the owner's to arrange.
2. **Set the version and pin the links.** On a branch from `main`:
   ```
   node scripts/release.mjs set <version>
   node scripts/release.mjs check --release <version>
   ```
   `set` takes a semantic version such as `0.1.0` and changes nothing if any skill lacks its `metadata.version` or its Version line. A skill with no default link has nothing to pin, and `set` and `check` leave it at those two places. `check --release` must print `PASS`. `check` also fails any `SKILL.md` over 65,536 characters (not bytes), Figma's limit for a skill: cut that skill before releasing. Commit with the message "Release <version>", and open a pull request. When it's merged, tag the commit on `main` that carries it, and run `check --release <version>` once more on that commit:
   ```
   git tag v<version> <commit>
   git push origin v<version>
   ```
   `schemaVersion` and `factsVersion` change only with their formats, never with a release.
   A pre-release takes a version such as `0.1.0-alpha.1` (`alpha`, `beta` or `rc`, then a number). It is pinned to its tag like any release, and `gh release create` gets `--prerelease`. A pre-release may go out with parts of step 1 not yet run, as long as its notes list what wasn't run under known gaps.
3. **Write the release notes.** `gh release create v<version> --title "<version>" --notes-file <file>`, or write them in the GitHub UI. State what changed since the last release in the user's terms, the skills in the set, any change to `schemaVersion` or `factsVersion`, and known gaps.
4. **Check the tag.**
   - Every pinned link returns 200 (a `404` means the tag isn't pushed or the file isn't at it):
     ```
     git grep -ohE 'https://raw.githubusercontent.com/[^` )]+' v<version> -- skills | sort -u | xargs -n1 curl -sSfLI -o /dev/null -w '%{http_code} %{url_effective}\n'
     ```
   - **Install check.** `node scripts/release.mjs install-check Blind3y3Design/design-review-skills` runs `npx skills add Blind3y3Design/design-review-skills --all` in a scratch project and fails unless exactly the skills in `skills/` arrive: all eight, and none of the vendored development skills in `.agents/skills/`. The repo's default branch must be at the release commit when it runs, so run it before step 7.
   - **Update check,** from the second release on: in a scratch project installed from the previous release, `npx skills update` brings every skill to the new version. Look at the `Version` line in `.agents/skills/<name>/SKILL.md`.
   - Record the install check's result, and the update check's, in the release notes.
5. **Publish by hand in Figma.** Use one dedicated file in the owning team, and publish to the organisation. Take each skill's `SKILL.md` from the tag (`git show v<version>:skills/<name>/SKILL.md`), unedited. Publish in dependency order, so a skill is published after the skills it invokes:
   1. `design-review-figma-writer`, `design-review-profile`, `design-review-scanner` and `design-review-scanner-assets`, which invoke no other skill
   2. `design-review-report-writer`
   3. `design-review-library` and `design-review-accessibility`
   4. `design-review`

   Later releases replace the file's skills and use **Publish changes**. Figma Community publishing waits for a stable 1.0.
6. **Check the published set.** In Figma Design's agent, ask `/design-review` which versions of the review skills are installed (RUN-05 in the smoke test). It must list the eight skills, each at the new version and no `design-review-research` line (it joins the list in v0.2), and end "All installed skills are at <version>." Then run `/design-review` on a smoke case frame, such as X-01 with the test profile: the report's Skills line must name the new version, and the report must carry no version warning.
7. **Start the next version.** On a branch from `main`:
   ```
   node scripts/release.mjs set <next>-dev
   node scripts/release.mjs check
   ```
   Commit and merge it. Without this, `main` keeps reading the released tag's Reference Documents, not its own.

## Setting the version by hand

If the script can't run, change the places above in each skill, then compare the result with `node scripts/release.mjs check --release <version>` run on another machine. The script lists every folder in `skills/`, so it covers a skill added later.
