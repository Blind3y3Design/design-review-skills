# Reference documents pointed to, never inlined

A Review Skill's standards content, such as the WCAG criteria and how to judge each one from a design, lives in a Reference Document outside the skill, not inside it. Content embedded in a skill goes out of date and breaks quietly when the standard changes, while one document in the repo can be updated once and forked by teams who need their own version. Like the Review Profile, the skill finds the document by a lookup order: given at run time, a pointer in the Review Profile, then the skill's default pointer, which goes to the public repo pinned to the skill's release (ADR 0007). ADR 0001 still holds, because the skill reads the document at a location it is pointed to, as it reads a Review Profile, rather than carrying it in a `references/` folder.

Nothing is inlined into a published skill. Figma Design's agent reads public GitHub files with `curl` and other Figma files by key ([issue #17](https://github.com/Blind3y3Design/design-review-skills/issues/17)), so a Reference Document can live in a public repo or on a page in a shared Figma file (ADR 0007). If no Reference Document is found, the skill skips its axis and says why; it does not fall back on what the agent happens to know.

## Consequences

- The skill keeps only the review procedure. Criterion-specific knowledge (triggers, thresholds, markers, default Severity) belongs in the Reference Document.
- Every report lists the Reference Documents it used (name, version and location), so reviews run against different versions can be compared.
- The design system and research axes can use the same pattern for their standards content.
- If `curl` stops working inside Figma's agent (it's undocumented, ADR 0005), a team copies the document onto a page in a shared Figma file and points to it from its Review Profile.
