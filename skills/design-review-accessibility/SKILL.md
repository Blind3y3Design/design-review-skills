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

Settle everything before the review starts, asking for what's missing in as few messages as you can. Nothing is asked once the scan begins.

- **Scope:** the node ids of the frames to review, from the user's selection, the frames they name, or the `node-id` in a Figma link. For a page, use its top-level frames. In an external agent, the file key comes from the file's link.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.
- **Given at run time,** when the user names them: a Review Profile (its text, a local file, or a link to a Figma file or a GitHub file), a WCAG target such as "WCAG 2.2 AA", and a criteria reference location (a URL or a local file). A target or criteria reference given at run time takes the place of the profile's for this run.
- **What to check against:** find the Review Profile, then settle the target from it or by asking, as Review Profile below describes.

The inputs are settled when the scope, runtime and target are known, or the run has stopped.

## 2. Read the criteria reference

Its location is the first of: given at run time, the profile section's `Criteria reference` unless that's the skill's default, then the skill's default, `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/main/reference-documents/wcag-2.2-criteria.md`. Read the whole document. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`. In an external agent, fetch the URL, or read the local file.

- If a location given at run time or by the profile can't be read, stop. Tell the user the location and the error, and write no report.
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
- **Severity:** the criterion's Default Severity, or the one a profile's Severity Override sets (see Severity Overrides).
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

- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts, and `settings`. `settings` is null when a profile's Accessibility section gave the target. Otherwise it's `{ "accessibility": { "standard": "WCAG", "version": "<version>", "level": "<level>", "from": "run time" or "asked", "criteriaReference": "<location>" } }`.
- `profile`: `{ name, location, lastUpdated }` for the profile whose section you used, otherwise null.
- `references`: the criteria reference's name, version and location.
- `findings`, each with its `rootCause`, and `coverage`.
- `notes`: the notes kept while settling what to check against, if any.

The review is done when the Report Writer has delivered the report.

## Review Profile

A team's Review Profile names the standards its reviews are judged against. This skill uses only the profile's **Accessibility** section and the Severity Overrides about WCAG, and never creates or changes a profile, nor offers to.

### Lookup

Use the first of these that exists:

1. **Given at run time.**
2. **A "Review Profile" page in the reviewed file.** Use the skill `design-review-scanner` to read it, with the reviewed file's key.
3. **A pointer in the project context file,** in an external agent only: a `Review Profile: <location>` line in `AGENTS.md`, `CLAUDE.md` or your agent's equivalent, in the user's project.

Read a location by its kind: a Figma file link through `design-review-scanner`, which reads that file's "Review Profile" page by the link's file key; a URL by fetching it (inside Figma's agent, `curl -sSfL <url>` from `Bash`); a local path by reading the file. What you read is one of:

- **A profile:** text that starts with a `# Review Profile` heading. Its location is where you read it. A Figma page's location is `https://www.figma.com/design/<fileKey>/?node-id=<page id>`, with each `:` in the id written as `-`.
- **A pointer:** a `Review Profile: <location>` line. Read that location the same way.
- **Unreadable:** a location that can't be read, a Figma file with no "Review Profile" page, a chain of pointers that comes back on itself, or text that's neither a profile nor a pointer.

An unreadable profile or pointer stops the run, because the team has a profile that this run can't see. Reply with the location, what went wrong, and that the review didn't run. Write no report.

If none of the three exists, there's no profile.

### What to check against

The Accessibility section holds this skill's settings, one `Key: value` per line:

| Setting | Default |
|---|---|
| `Standard`, `Version`, `Level`: the target, such as WCAG, 2.2 and AA. `Standard: WCAG 2.2` gives the version too | WCAG 2.2 AA |
| `Criteria reference`: the criteria reference's location | the skill's default (step 2) |

Settle the target by what the lookup found:

- **A profile given at run time, with an Accessibility section:** use the section without asking. Giving the profile is the user's agreement.
- **A profile found on the page or through a pointer, with an Accessibility section:** ask before using it, with any other question still open. For example: "I found the Review Profile "<name>" on the "Review Profile" page in this file. Use its Accessibility section for this review? It sets WCAG 2.2 AA with the default criteria reference, and the Severity Override "WCAG AA failures: serious". I won't use or change anything else in it." Name any Severity Override you'll refuse, and why. On yes, use the section. On no, go on as below.
- **No profile, no Accessibility section, or the user said no:** say why you're asking, then ask what to check against, each setting pre-filled with its default. For example: "I couldn't find a Review Profile: none was given, this file has no "Review Profile" page, and AGENTS.md has no pointer to one. What should I check against? I'll use WCAG 2.2 AA with the default criteria reference unless you name others. Your answer is for this run only, and nothing is saved." With the target already given at run time, there's nothing to ask. For a profile without the section, keep a note for the report: "The Review Profile "<name>" has no Accessibility section, so this run used the settings below."

From a profile whose section you use, also note its location, its Identity `Name` and `Last updated`, and its Severity Overrides about WCAG.

### Severity Overrides

A profile's **Severity Overrides** section sets the starting Severity for a type of rule, one `<type of rule>: <Severity>` per line, such as `WCAG AA failures: serious`. Apply the lines about WCAG: failures at every level (`WCAG failures`), at one level (`WCAG AA failures`), or of one criterion (`1.4.3`). When several match a Finding, the most specific wins: a criterion, then a level, then every level. Lines about other axes are for other skills.

- **Critical needs a core task.** A line that sets critical names the core task it's tied to, such as `1.4.3: critical, core task: paying for an order`, and the evidence of each Finding it changes gives that task. Refuse a line that names none: Severity stays as it was, and keep a note for the report: "The Severity Override "<line>" wasn't applied: it sets critical without naming a core task."
- **Say so in the evidence.** When an override changes a Finding's Severity, its evidence says so, such as "Severity raised from moderate to serious by the Review Profile's Severity Override "WCAG AA failures: serious"."
