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

Settle everything before the review starts, asking for what's missing in as few messages as you can. Nothing is asked once the scan begins. When another skill runs this review, settle the inputs from its hand-over, as Run by another skill describes.

- **Scope:** the node ids of the frames to review, from the user's selection, the frames they name, or the `node-id` in a Figma link. For a page, use its top-level frames. In an external agent, the file key comes from the file's link.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.
- **Given at run time,** when the user names them: a Review Profile (its text, a local file, or a link to a Figma file or a GitHub file), and any of the Accessibility settings under What to check against, such as a WCAG target ("WCAG 2.2 AA"), `Report above target: yes`, an additional requirement, or a criteria reference location (a URL or a local file). A setting given at run time takes the place of the profile's for this run. Also where to save this run's report, if the user says: "don't save", or "save to <location>".
- **What to check against:** find the Review Profile, then settle the Accessibility settings from it or by asking, as Review Profile below describes.

The inputs are settled when the scope, runtime and settings are known, or the run has stopped.

## 2. Read the criteria reference

Its location is the first of: given at run time or in answer to a question, the profile section's `Criteria reference` unless that's the skill's default, then the skill's default, `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/main/reference-documents/wcag-2.2-criteria.md`. Read the whole document, as Reading a location describes.

- If a location the user or the profile gave can't be read, stop. Tell the user the location and the error, and write no report.
- If the default link can't be read, the axis is skipped. Hand the Report Writer no Findings and one Coverage entry, `{ "axis": "accessibility", "status": "skipped", "reason": "the criteria reference couldn't be read: <location>: <error>" }`, and go to step 5.

From the document's header, note its name, version and location for the report, and its `Covers` line. Its "How an entry reads" section says which criteria apply to the target.

**A target the reference doesn't cover,** a version or level missing from its `Covers` line, gets only its additional requirements judged in step 4. Give the target one Coverage entry in their place: `{ "axis": "accessibility", "ref": "WCAG <version> <level>", "status": "not-readable", "note": "The criteria reference covers <its Covers line>, not WCAG <version> <level>. Only additional requirements were judged." }`.

## 3. Scan

Use the skill `design-review-scanner`. Give it the scope's node ids, the runtime, and the fact groups to judge from: those on the `Facts` lines of the criteria you'll judge in step 4, and those holding what each additional requirement is about. Judge from the Design Facts it hands back.

When another skill handed over Design Facts, the design is already scanned: judge from those, as Run by another skill describes.

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
- **Severity:** the criterion's Default Severity, or the one a profile's Severity Override sets (see Severity Overrides), or an additional requirement's own. An additional requirement given as critical with no core task in its statement starts at serious instead, and the evidence says why.
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

- `mode`: `json only` when the skill running this review asked for it, otherwise `full report`.
- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts, and `settings`. `settings` is null when a profile's Accessibility section gave the target, `Report above target` and the additional requirements, whatever the criteria reference's location. Otherwise it's `{ "accessibility": { "standard": "WCAG", "version": "<version>", "level": "<level>", "from": "profile", "run time", "asked" or "default", "criteriaReference": "<location>", "reportAboveTarget": "yes" or "no", "additionalRequirements": ["<id> (<Severity>): <statement>", …] } }`, where `from` says where the target came from.
- `profile`: `{ name, location, lastUpdated }` for the profile whose section you used, otherwise null.
- `references`: the criteria reference's name, version and location.
- `findings`, each with its `rootCause`, and `coverage`.
- `notes`: the notes kept while settling what to check against, if any.
- `reportSettings`: the profile's Report settings you noted, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: "don't save" or "save to <location>" when the user said so, otherwise null.

The review is done when the Report Writer has delivered the report. In `json only` mode, it's done when you've handed the Report Writer's reply, its notes and JSON block, back to the skill that ran this review.

## Run by another skill

Another skill, such as `design-review`, can run this review as one part of a larger one. It loads this skill first, for two lines:

- **Fact groups:** `colourPairs`, `text`, `structure`, `components`, `annotations`: every group a criteria reference's `Facts` lines can name. The caller scans for them once, for every review in the run.
- **For the caller to ask:** nothing. With no Accessibility section, this review uses its default target, WCAG 2.2 AA, and says so.

Then it settles the run, asks the user everything, and hands over:

- the scope, the runtime, and the `mode` for step 5
- the Review Profile it found, as the scanner's `found` result
- the Design Facts, when it has scanned
- anything the user gave at run time for this review, such as a criteria reference location or a WCAG target

The user has been asked everything already, so ask nothing. Where you'd ask what to check against, use what the question is pre-filled with, set `from` to `default`, and keep the note you'd keep for the report. When a fact group you need is neither read in the handed-over facts nor in their `unread`, scan for that group yourself, as step 3 describes.

## Review Profile

A team's Review Profile names the standards its reviews are judged against. This skill uses only the profile's **Accessibility** section and the Severity Overrides about WCAG, and hands its **Report settings** section to the Report Writer, which saves the report. It never creates or changes a profile, nor offers to.

### Finding the profile

When another skill hands over the profile it found, use that result. Otherwise use the skill `design-review-scanner` to find the Review Profile, as its Finding the Review Profile describes. Give it the reviewed file's key, the runtime, and the profile given at run time, if any. It hands back one of three results:

- **found:** the profile's `text`, where the lookup found it (`from`), and the `profile` to name in the report.
- **none:** where it looked (`searched`).
- **unreadable:** a `location` and a `reason`. The team has a profile that this run can't see, so stop: reply with the location, the reason, and that the review didn't run. Write no report.

### What to check against

The Accessibility section holds this skill's settings, one `Key: value` per line:

| Setting | Default |
|---|---|
| `Standard`, `Version`, `Level`: the target, such as WCAG, 2.2 and AA. `Standard: WCAG 2.2` gives the version too | WCAG 2.2 AA |
| `Criteria reference`: the criteria reference's location | the skill's default (step 2) |
| `Report above target`: `yes` adds the above-target checks in step 4, as advisory Findings | `no` |
| `Additional requirement`: one of the team's own requirements, one line each, `Additional requirement: <id> (<Severity>): <statement>`, such as `Additional requirement: AR-1 (minor): Body text is at least 16 px.` The Severity is critical, serious, moderate or minor. A line with no id takes the first `AR-<n>` not already used | none |

Settle the settings by what the lookup found:

- **A profile given at run time (`from` is `run time`), or handed over by another skill, with an Accessibility section:** use the section without asking. Giving the profile is the user's agreement.
- **A profile found on the page or through a pointer in a project file, with an Accessibility section:** ask before using it, with any other question still open. For example: "I found the Review Profile "<name>" on the "Review Profile" page in this file. Use its Accessibility section for this review? It sets WCAG 2.2 AA with the default criteria reference, and the Severity Override "WCAG AA failures: serious". I'll use only that and where it saves reports, and I won't change it." Name where it saves reports from its Report settings, if it has them, and any Severity Override you'll refuse, and why. On yes, use the section. On no, go on as below.
- **No profile, no Accessibility section, or the user said no:** say why you're asking, from the lookup's `searched` when there's no profile, then ask what to check against, each setting pre-filled with its default. For example: "I couldn't find a Review Profile: none was given, this file has no "Review Profile" page, and AGENTS.md has no pointer to one. What should I check against? I'll use WCAG 2.2 AA with the default criteria reference unless you name others. Your answer is for this run only, and isn't saved to a profile." With the target already given at run time, there's nothing to ask. For a profile without the section, keep a note for the report: "The Review Profile "<name>" has no Accessibility section, so this run used the settings below."

From a profile whose section you use, also note its `profile` and its Severity Overrides about WCAG. From any profile the lookup found, unless the user said no to it, note its Report settings.

### Severity Overrides

A profile's **Severity Overrides** section sets the starting Severity for a type of rule, one `<type of rule>: <Severity>` per line, such as `WCAG AA failures: serious`. Apply the lines about WCAG: failures at every level (`WCAG failures`), at one level (`WCAG AA failures`), or of one criterion (`1.4.3`). When several match a Finding, the most specific wins: a criterion, then a level, then every level. They set the Severity of Findings against the target's criteria: above-target Findings stay advisory, and additional requirements keep their own Severity. Lines about other axes are for other skills.

- **Critical needs a core task.** A line that sets critical names the core task it's tied to, such as `1.4.3: critical, core task: paying for an order`, and the evidence of each Finding it changes gives that task. Refuse a line that names none: treat it as absent, so a less specific line or the Default Severity applies, and keep a note for the report: "The Severity Override "<line>" wasn't applied: it sets critical without naming a core task."
- **Say so in the evidence.** When an override changes a Finding's Severity, its evidence says so, such as "Severity raised from moderate to serious by the Review Profile's Severity Override "WCAG AA failures: serious"."

## Reading a location

- **A URL:** fetch it. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`.
- **A local file,** in an external agent: read it.
