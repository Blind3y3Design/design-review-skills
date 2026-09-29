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
How much a Finding matters, on a fixed scale: critical, serious, moderate, minor, or advisory. Advisory Findings break no standard.
_Avoid_: Priority, impact level

**Certainty**:
How sure a Review Skill is of a Finding: confirmed, likely, or needs-review. Independent of Severity.
_Avoid_: Confidence, accuracy

**Root Cause**:
The single thing to fix behind a Finding, such as a shared text style. Each Finding has one Root Cause but may list many locations.
_Avoid_: Occurrence, instance

**Supporting Evidence**:
Material that strengthens a Finding by pointing to another source of the same problem, such as user research that reports it.

## Standards

**Review Profile**:
A reusable document, shareable across files and teams, naming the standards a review is judged against: its Design System Layers, research sources, accessibility target, product context and any Severity overrides. A review uses exactly one Review Profile.
_Avoid_: Config, settings, ruleset

**Design System Layer**:
One design system in an ordered stack of systems that build on each other, from a slow-changing foundation to fast-changing product libraries (pace layers). A more specific layer overrides a more general one unless the general layer has locked the rule.
_Avoid_: Tier, level, theme

**Locked Rule**:
A rule set by a Design System Layer that more specific layers may not override.
_Avoid_: Mandatory rule, hard rule
