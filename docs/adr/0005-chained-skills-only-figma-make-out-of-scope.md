# Chained skills only; Figma Make out of scope

The Orchestrator is built only in its chained shape: it invokes each Review Skill, and every skill, the Orchestrator included, invokes the Report Writer to produce its output. There is no inlined all-in-one version. The hands-on test in [issue #14](https://github.com/Blind3y3Design/design-review-skills/issues/14) showed that Figma Design's agent loads a second custom skill: when a skill names it, when both are invoked in one prompt, and when a prompt matches the skill's description. The only runtime that can't chain is Figma Make, which adds `disable-model-invocation` to every prompt and skill. Make also works on a code project, not a design file, so it can't inspect nodes the way a review needs. Supporting it would mean maintaining a second, inlined shape for a runtime where reviews can't run well, so Make is not a target. People close to Figma say its agent is moving in the same direction.

## Consequences

- The shared report format becomes the Report Writer skill, which owns the Markdown layout, the JSON schema and `schemaVersion`, and the Severity and Certainty definitions. This supersedes ADR 0002's copy of the report format.
- The ADR 0002 build step now copies only Reference Documents, optionally (ADR 0003). It is deleted once a test shows Figma Design's agent can read a Reference Document from a link or a connector.
- Figma Design's chaining is undocumented: Figma's help still says only the first skill in a prompt is invoked. Re-run the issue #14 tests whenever Figma changes its agent or that help page. If chaining stops working, the Orchestrator lists each Review Skill it couldn't load in Coverage and tells the user to run each one in its own prompt (ADR 0004).
