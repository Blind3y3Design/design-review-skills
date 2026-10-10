# Design Review

Portable skills that review design work, primarily in Figma, and report what they find against standards the user supplies.

## Reviewing

**Review Axis**:
A single dimension a design is judged along, such as accessibility or design system adherence.
_Avoid_: Vector, lens, dimension, category; "library review" for design system adherence (the skill is named `design-review-library`, but the axis keeps its name)

**Review Skill**:
A skill that evaluates a design along exactly one Review Axis.
_Avoid_: Checker, auditor, sub-skill

**Orchestrator**:
The skill that runs several Review Skills in one review, choosing them from the Review Profile and the user's request, and merges their Findings into one report. With no Review Profile, it first creates one with the designer (a first run).
_Avoid_: Meta skill, meta agent, coordinator

**Report Writer**:
The skill that writes a review's Findings and Coverage in the shared report format, whether a Review Skill runs on its own or through the Orchestrator. It judges no Review Axis.
_Avoid_: Documentation skill, formatter, output skill

**Design Scanner**:
The skills that read a design and return its Design Facts, without judging them. They only read. One skill, `design-review-scanner`, orchestrates the scan and invokes one leaf scanning skill per fact group: `design-review-scanner-colour-pairs` reads colour pairs, `design-review-scanner-text` text, `design-review-scanner-structure` structure, `design-review-scanner-annotations` annotations, `design-review-scanner-bindings` bindings and `design-review-scanner-components` components. A caller asks the orchestrator for the fact groups it needs.
_Avoid_: Inspector, crawler, collector

**Profile Finder**:
The skill that finds the team's Review Profile and hands back its text, or says there's none or that it can't be read. The Orchestrator and each Review Skill use it, and each decides what to use from the profile.
_Avoid_: Profile loader, config reader

**Figma Writer**:
The skill that writes into the reviewed Figma file: report frames, layer annotations and the Review Profile page, exactly as its caller hands them over. The caller decides what to write and where.
_Avoid_: Annotator, exporter

**Design Facts**:
What was read or measured from a design, without judgement: its components, bindings, detached instances, overrides, text, and measurements such as contrast ratios. Review Skills judge from Design Facts.
_Avoid_: Scan results, data, metadata

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

**Property**:
The part of a Root Cause that a Finding's evidence is about, such as a layer's fill or its reading order.
_Avoid_: Aspect, attribute, field

**Coverage**:
The record of what a Review Skill did and did not assess in a review, and why each unassessed standard was left out. An empty set of Findings is not a pass unless Coverage shows the standards were judged.
_Avoid_: Scope, checklist, results

**Supporting Evidence**:
Material that strengthens a Finding by pointing to another source of the same problem, such as user research that reports it.

## Standards

**Review Profile**:
A reusable document, shareable across files and teams, naming the standards a review is judged against: its Design System Layers, research sources, accessibility target, product context and any Severity overrides. An Orchestrator run always uses exactly one Review Profile. A Review Skill run on its own may use one or none.
_Avoid_: Config, settings, ruleset

**First run**:
An Orchestrator run with no Review Profile: it walks the designer through creating one, one question at a time, then runs the review against it.
_Avoid_: Onboarding, wizard

**Set-up mode**:
How a Review Skill, used by the Orchestrator, asks its own questions for a new Review Profile and hands back its section of it, judging nothing.
_Avoid_: Wizard step, onboarding mode

**Reference Document**:
A document of standards content that a Review Skill reads from a location it is pointed to rather than carrying inside itself, such as the WCAG criteria and how to judge each from a design, or a Design System Layer's rules written by the team that owns it.
_Avoid_: Reference file, knowledge base, ruleset

**Research Insight**:
A synthesised, citable statement from research about what users need or do, which the research alignment axis judges a design against. Individual quotes and raw research data are not Research Insights; they can only support one.
_Avoid_: Research finding, highlight, doc, learning

**Design System Layer**:
One design system in an ordered stack of systems that build on each other, from a slow-changing foundation to fast-changing product libraries (pace layers). A more specific layer overrides a more general one unless the general layer has locked the rule.
_Avoid_: Tier, level, theme

**Locked Rule**:
A rule set by a Design System Layer that more specific layers may not override.
_Avoid_: Mandatory rule, hard rule

## Releasing

**Release**:
One published state of the whole set under a single SemVer version: every skill stamped with that version, tagged `v<version>`, with a GitHub Release and a Figma publish to match. All skills ship together; there is no per-skill version.
_Avoid_: Drop, ship, publish (publishing to Figma is one step of a release, not the release)

**Release PR**:
The standing pull request that carries the next version — the bump, the changelog and the stamped skills — and that the owner merges to cut a release. It is the human gate: nothing becomes a release without it.
_Avoid_: Bump PR, release branch

**Integration Branch**:
`integration`, the branch where merged-but-unreleased work accumulates so that `main` can hold only the latest release.
_Avoid_: Staging, develop, trunk

**Public Contract**:
The invocation surface the set's version covers: the skill names, the required install set, each skill's trigger description and declared inputs and outputs, and the pinned Reference-Document URL scheme. The version is cut against it (see ADR 0009).
_Avoid_: API, interface, surface

**Pre-release**:
A release marked alpha, beta or rc, cut on demand for testing and not promoted to `main`; consumers opt in by pinning it.
_Avoid_: Dev build, snapshot, nightly
