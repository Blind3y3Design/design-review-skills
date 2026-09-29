# Reference documents pointed to, optionally inlined at publish

A Review Skill's standards content, such as the WCAG criteria and how to judge each one from a design, lives in a Reference Document outside the skill, not inside it. Content embedded in a skill goes out of date and breaks quietly when the standard changes, while one document in the repo can be updated once and forked by teams who need their own version. Like the Review Profile, the skill finds the document by a lookup order: given at run time, a pointer in the Review Profile, then a default pointer in the team's published copy of the skill. ADR 0001 still holds, because the skill reads the document at a location it is pointed to, as it reads a Review Profile, rather than carrying it in a `references/` folder.

Figma's agent may not be able to fetch a linked document, so a publisher can choose to inline a Reference Document into the published skill as a last fallback. This reuses the removable build step from ADR 0002, which now copies the report format and, optionally, Reference Documents. It must stay a plain copy. If no Reference Document is found, the skill skips its axis and says why; it does not fall back on what the agent happens to know.

## Consequences

- The skill keeps only the review procedure. Criterion-specific knowledge (triggers, thresholds, markers, default Severity) belongs in the Reference Document.
- Every report lists the Reference Documents it used (name, version, location, and whether the copy was inlined), so reviews run against different versions can be compared.
- The design system and research axes can use the same pattern for their standards content.
- The optional inlining is a stopgap for runtimes that can't fetch or chain (ADR 0004). Where a skill can read the Reference Document at its location, that is preferred.
