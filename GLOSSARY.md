# Design Review

Portable skills that review design work, primarily in Figma, and report what they find against standards the user supplies.

## Reviewing

**Review Axis**:
A single dimension a design is judged along, such as accessibility or design system adherence.
_Avoid_: Vector, lens, dimension, category

**Review Skill**:
A skill that evaluates a design along exactly one Review Axis.
_Avoid_: Checker, auditor, sub-skill

**Orchestrator**:
The skill that chooses which Review Skills apply to a design, runs them, and merges their Findings into one report.
_Avoid_: Meta skill, meta agent, coordinator

**Finding**:
One issue a Review Skill reports: what is wrong, the evidence for it, the standard it breaks, and its Severity.
_Avoid_: Issue, violation, comment, flag

**Severity**:
The fixed, machine-readable rank of a Finding's importance.
_Avoid_: Priority, impact level

**Supporting Evidence**:
Material that strengthens a Finding by pointing to another source of the same problem, such as user research that reports it.

## Standards

**Review Profile**:
A reusable document naming the standards a team reviews against: its Design System Layers, research sources, and accessibility target.
_Avoid_: Config, settings, ruleset

**Design System Layer**:
One design system in an ordered stack of systems that build on each other, from a slow-changing foundation to fast-changing product libraries (pace layers). A more specific layer overrides a more general one unless the general layer has locked the rule.
_Avoid_: Tier, level, theme

**Locked Rule**:
A rule set by a Design System Layer that more specific layers may not override.
_Avoid_: Mandatory rule, hard rule
