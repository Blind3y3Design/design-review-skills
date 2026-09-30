---
name: design-review-accessibility
description: Accessibility review of Figma frames at the design stage. Judges WCAG criteria, such as text contrast, from measured Design Facts, and reports Findings and Coverage. Use when the user asks for an accessibility, WCAG or contrast review of a Figma design.
metadata:
  version: "0.1.0-dev"
---

# Accessibility review

Version 0.1.0-dev of the design review skills.

A design-stage review of Figma frames along one Review Axis, `accessibility`. This skill holds only the procedure. Everything about a criterion, such as its trigger, thresholds and default Severity, comes from the WCAG criteria Reference Document. Judge from that document and the Design Facts alone, never from what you know of WCAG.

## Required skills

This review MUST use two other skills: `design-review-scanner` reads the design, and `design-review-report-writer` writes the report. Before anything else, check that both are available to you. If either isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- Both missing: "This review can't run: the skills `design-review-scanner` and `design-review-report-writer` aren't installed. Install them, then run the review again."

These two skills are the review's only way to read the design and to write a report.

## 1. Settle the inputs

Ask for anything missing in one message, before the review starts. Nothing is asked after that.

- **Scope:** the node ids of the frames to review, from the user's selection, the frames they name, or the `node-id` in a Figma link. For a page, use its top-level frames. In an external agent, the file key comes from the file's link.
- **Target:** the WCAG version and level given at run time, such as "WCAG 2.2 AA". If none is given, use WCAG 2.2 AA, and record that it's the default.
- **Report above target:** `yes` or `no`, given at run time. `no` by default.
- **Additional requirements:** the team's own requirements given at run time, none by default. Each is one line, `Additional requirement: <id> (<Severity>): <statement>`, such as `Additional requirement: AR-1 (minor): Body text is at least 16 px.` The Severity is critical, serious, moderate or minor. A line with no id takes the first `AR-<n>` not already used.
- **Criteria reference:** a location given at run time, a URL or a local file. Otherwise the default, `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/main/reference-documents/wcag-2.2-criteria.md`.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.

## 2. Read the criteria reference

Read the whole document. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`. In an external agent, fetch the URL, or read the local file.

- If a location given at run time can't be read, stop. Tell the user the location and the error, and write no report.
- If the default link can't be read, the axis is skipped. Hand the Report Writer no Findings and one Coverage entry, `{ "axis": "accessibility", "status": "skipped", "reason": "the criteria reference couldn't be read: <location>: <error>" }`, and go to step 5.

From the document's header, note its name, version and location for the report, and its `Covers` line. Its "How an entry reads" section says which criteria apply to the target.

**A target the reference doesn't cover,** a version or level missing from its `Covers` line, gets only its additional requirements judged in step 4. Give the target one Coverage entry in their place: `{ "axis": "accessibility", "ref": "WCAG <version> <level>", "status": "not-readable", "note": "The criteria reference covers <its Covers line>, not WCAG <version> <level>. Only additional requirements were judged." }`.

## 3. Scan

Use the skill `design-review-scanner`. Give it the scope's node ids, the runtime, and the fact groups to judge from: those on the `Facts` lines of the criteria you'll judge in step 4, and those holding what each additional requirement is about. Judge from the Design Facts it hands back.

## 4. Judge

Judge these three sets. At a target the reference doesn't cover, judge only the additional requirements.

- **The target's criteria:** every criterion in the reference that applies to the target.
- **Above-target checks,** only with `Report above target: yes`: every `static` criterion in the reference that doesn't apply to the target, such as its AAA entries.
- **Additional requirements:** each one, judged like a criterion. Its statement is its test.

Give each exactly one Coverage entry, `{ "axis": "accessibility", "ref": "<criterion number, or requirement id>", "status": "<status>" }`. Add a `note` to any status but `judged`, and to every above-target entry ("above target"). The status is the first that fits:

1. `needs-code` when its group is `code`. It's never a Finding.
2. `not-readable` when a fact group it needs is in the facts' `unread`, or none of its measurements could be made. The note gives the scanner's reason.
3. `not-applicable` when its trigger isn't in the scope.
4. `judged` otherwise, following its How to judge.

Each failure becomes part of a Finding:

- **Root Cause:** the source the criterion's How to judge names, written as `variable:<key>` or `style:<key>` when the facts show that value bound to one, otherwise `node:<id>` of the failing layer. Give one Finding per Root Cause per criterion, with every layer it covers in `locations` and each failing measurement in the evidence.
- **Severity:** the criterion's Default Severity, or an additional requirement's own. An additional requirement given as critical with no core task in its statement starts at serious instead, and the evidence says why.
- **Above target:** every above-target Finding is advisory, with no `standard`. Give one per Root Cause across all the above-target checks, naming each criterion it fails, with its W3C link, in the evidence.
- **Certainty:**
  - `confirmed` for a measurement from facts with no `flags`.
  - `likely` for a measurement from facts with a flag, such as `opacity` or `blend-mode`, which the evidence names; or for a judgement of wording or meaning, such as whether a heading describes its section.
  - `needs-review` when a measurement couldn't be made. The evidence gives the scanner's `reason`. This is always a Finding, since it may fail.
- **Title:** one line naming the layer and what fails.
- **Evidence** and **fix,** as the criterion's How to judge says.
- **Locations:** `{ "kind": "node", "fileKey", "nodeId", "layerPath" }` for each layer in the facts. When a facts group's `count` is more than its sample `nodes`, the evidence says how many more layers share it.
- **Standard:** `{ "source": "WCAG <version>", "ref": "<number>", "url": "<its W3C line>" }`, with the url the reference gives for the target's version. For an additional requirement, `{ "source": "Additional requirement", "ref": "<id>" }`.

Judging is done when every criterion that applies to the target (or an uncovered target itself), every above-target check that's on, and every additional requirement has one Coverage entry, and every failure or measurement that couldn't be made is in a Finding. The reference's header says how many criteria apply at each target it covers: check your Coverage against it.

## 5. Report

Use the skill `design-review-report-writer`, handing over:

- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts, and `settings`: `{ "accessibility": { "standard": "WCAG", "version": "<version>", "level": "<level>", "from": "run time" or "default", "criteriaReference": "<location>", "reportAboveTarget": "yes" or "no", "additionalRequirements": ["<id> (<Severity>): <statement>", …] } }`.
- `profile`: null.
- `references`: the criteria reference's name, version and location.
- `findings`, each with its `rootCause`, and `coverage`.

The review is done when the Report Writer has delivered the report.
