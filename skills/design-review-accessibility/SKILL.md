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
- **Criteria reference:** a location given at run time, a URL or a local file. Otherwise the default, `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/main/reference-documents/wcag-2.2-criteria.md`.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.

## 2. Read the criteria reference

Read the whole document. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`. In an external agent, fetch the URL, or read the local file.

- If a location given at run time can't be read, stop. Tell the user the location and the error, and write no report.
- If the default link can't be read, the axis is skipped. Hand the Report Writer no Findings and one Coverage entry, `{ "axis": "accessibility", "status": "skipped", "reason": "the criteria reference couldn't be read: <location>: <error>" }`, and go to step 5.

From the document's header, note its name, version and location for the report. Its "How an entry reads" section says which criteria apply to the target.

## 3. Scan

Use the skill `design-review-scanner`. Give it the scope's node ids, the runtime, and the fact groups on the `Facts` lines of the criteria that apply. Judge from the Design Facts it hands back.

## 4. Judge

Work through every criterion that applies to the target, following its **How to judge**, and give each exactly one Coverage entry, `{ "axis": "accessibility", "ref": "<number>", "status": "<status>" }`, adding a `note` for any status but `judged`:

- `needs-code` when its group is `code`.
- `not-readable` when a fact group it needs is in the facts' `unread`, or none of its measurements could be made. The note gives the scanner's reason.
- `not-applicable` when its trigger isn't in the scope.
- `judged` otherwise.

Each failure becomes part of a Finding:

- **Root Cause:** for a colour pair, the text colour's source in the facts: `variable:<key>` or `style:<key>` when the colour is bound to one, otherwise `node:<id>` of the text layer. Give one Finding per Root Cause per criterion, with every layer it covers in `locations` and each of its pairs in the evidence.
- **Severity:** the criterion's Default Severity.
- **Certainty,** for a measurement:
  - `confirmed` when the pair has no `flags`.
  - `likely` when it has a flag, such as `opacity` or `blend-mode`. The evidence names the flag.
  - `needs-review` when the pair couldn't be computed. The evidence gives the scanner's `reason`. Such a pair is always a Finding, since it may fail.
- **Title:** one line naming the layer and what fails.
- **Evidence** and **fix,** as the criterion's How to judge says.
- **Locations:** `{ "kind": "node", "fileKey", "nodeId", "layerPath" }` for each layer in the facts. When a facts group's `count` is more than its sample `nodes`, the evidence says how many more layers share it.
- **Standard:** `{ "source": "WCAG <version>", "ref": "<number>", "url": "<its W3C line>" }`.

Judging is done when every criterion that applies has one Coverage entry, and every failing or uncomputed pair is in a Finding.

## 5. Report

Use the skill `design-review-report-writer`, handing over:

- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts, and `settings`: `{ "accessibility": { "standard": "WCAG", "version": "<version>", "level": "<level>", "from": "run time" or "default", "criteriaReference": "<location>" } }`.
- `profile`: null.
- `references`: the criteria reference's name, version and location.
- `findings`, each with its `rootCause`, and `coverage`.

The review is done when the Report Writer has delivered the report.
