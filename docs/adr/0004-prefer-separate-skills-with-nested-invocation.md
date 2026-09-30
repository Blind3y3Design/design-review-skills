# Prefer separate skills with nested invocation

The target design is a set of small, separate skills that invoke each other: the Orchestrator invokes Review Skills, and every skill invokes the Report Writer and any other skill it depends on. We prefer this to copying one skill's content into another, because each skill then has one owner and one version, and nothing goes stale in a copy. Figma Design's agent and external agents can chain skills ([issue #14](https://github.com/Blind3y3Design/design-review-skills/issues/14), ADR 0005). Nothing is inlined at publish, because every supported runtime can reach content where it lives (ADR 0007).

## Consequences

- New work designs the chained shape. If a supported runtime can't reach some content, the content gets a readable home (ADR 0007) rather than being copied into a skill.
- A skill keeps its steps separate where a future split is likely, with a plain hand-off between them. Research alignment keeps fetching research apart from judging it, so a skill for one research tool can be split out if testing shows it's needed.
- **Required and optional skills behave differently when missing.** If a required skill, such as the Report Writer or the Design Scanner, won't load, the run stops and names the skill to install. Nothing can be reported without it, and an unformatted fallback would bring back a drifting copy of the format. If an optional skill won't load, such as one Review Skill in an Orchestrator run, the run continues without it, and Coverage names the missing skill and says what wasn't assessed.
