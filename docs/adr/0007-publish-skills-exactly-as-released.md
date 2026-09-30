# Skills are published exactly as released; no build step

A published skill is the repo's `SKILL.md` exactly as it stands in a release: nothing is copied into it, and no team edits it before uploading. ADR 0002's build step existed to inline shared content into skills for runtimes that couldn't reach it. ADR 0005 already moved the report format into the Report Writer. The hands-on test in [issue #17](https://github.com/Blind3y3Design/design-review-skills/issues/17) then showed that Figma Design's agent reads public GitHub files with `curl` and reads other Figma files by key, so Reference Documents don't need inlining either. With nothing left to build, keeping Figma copies in step with the repo becomes "upload the release", and no organisation's settings end up inside a skill (AGENTS.md).

## Consequences

- This fully supersedes ADR 0002 and removes ADR 0003's inlining fallback.
- **Reference Documents.** Each skill's default Reference Document link points to the public repo, pinned to that release's tag, so a skill reads the version of the document it was released with. A team's own documents, such as a layer's rules document, are pointed to from its Review Profile, never by editing a skill. If `curl` stops working (it's undocumented, ADR 0005), a team copies the document onto a page in a shared Figma file and points to it from the profile.
- **No default Review Profile** in a published copy: #7's lookup step 4 is removed. In Figma the profile is a page in the file (#12).
- **One version for the whole set,** following semantic versioning, recorded in each skill's `metadata`. Each release is a git tag. `schemaVersion` and `factsVersion` change only with their formats. Each report records the set's version, and the Orchestrator warns in its report when a skill it invokes is at a different version.
- **A release:**
  1. The smoke test passes in Figma Design's agent and in an external agent.
  2. The version and the pinned Reference Document links are set in all six skills, committed and tagged.
  3. The six skills are published by hand in Figma, from one file in the owning team, to the organisation, in dependency order: the Report Writer and Design Scanner, then the Review Skills, then the Orchestrator.
  4. `/design-review` confirms every skill's version.

  Setting the tag in the links is an edit to the source at release time, not a build step.
- **External agents** install with the `skills` CLI (`npx skills add <repo> --all`), or by copying `skills/`. There's no plugin marketplace packaging (ADR 0001).
- **Figma Community publishing** waits for a stable 1.0, and for a check of whether people's Community copies update when changes are published.
- **Known risk:** the repo will move once it's integrated into Cat's systems. If the new home is private, `curl` can't read its Reference Documents inside Figma. They would then need a public copy, a page in a shared Figma file, or the GitHub connector (#19).
