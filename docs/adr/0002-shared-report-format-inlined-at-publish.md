# Report format written once and copied into each skill when publishing

Every Review Skill and the Orchestrator produce Findings in the same shape: a Markdown report, then one fenced JSON block with a `schemaVersion` field. We'd rather maintain that report-writing section in one place than keep a copy in every skill. Inside Figma's agent, though, one skill can't invoke another (see [issue #2](https://github.com/Blind3y3Design/design-review-skills/issues/2)), and ADR 0001 requires single-file skills. So the section is written once in the repo, and a build step copies it into each skill's published file.

## Consequences

- The repo holds the source for each skill, not just the file that gets published. Contributors edit the source and the shared section, never the build output.
- **The build step must stay removable.** It does nothing except copy the shared section into each skill, with no other templating or logic. If Figma's agent turns out to support chaining skills ([issue #14](https://github.com/Blind3y3Design/design-review-skills/issues/14)), the shared section becomes a standalone report skill, each Review Skill's copy is replaced with an instruction to use that skill, and the build step is deleted.
