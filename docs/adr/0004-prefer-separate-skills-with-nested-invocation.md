# Prefer separate skills with nested invocation; inline only as a stopgap

The target design is a set of small, separate skills that invoke each other: the Orchestrator invokes Review Skills, and a Review Skill invokes any skill it depends on. We prefer this to copying one skill's content into another, because each skill then has one owner and one version, and nothing goes stale in a copy. Figma's agent runs one skill per prompt today ([issue #2](https://github.com/Blind3y3Design/design-review-skills/issues/2)), so where a runtime can't chain skills, content is inlined at publish (ADR 0002, ADR 0003) as a stopgap, not as the design. Each skill still works on its own when a skill it would invoke isn't available, and its report says what it did instead.

## Consequences

- New work designs the chained shape first and the inlined Figma shape second. The Orchestrator is the first place this applies.
- Removing inlining once chaining works must stay cheap. The ADR 0002 build step stays a plain copy.
- A skill keeps its steps separate where a future split is likely, with a plain hand-off between them. Research alignment keeps fetching research apart from judging it, so a skill for one research tool can be split out if testing shows it's needed.
