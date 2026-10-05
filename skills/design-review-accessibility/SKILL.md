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

This review MUST use four other skills: `design-review-profile` finds the Review Profile, `design-review-scanner` and `design-review-scanner-assets` read the design, and `design-review-report-writer` writes the report. Before anything else, check that all four are available to you. If any isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- More than one missing, naming each, such as: "This review can't run: the skills `design-review-scanner-assets` and `design-review-report-writer` aren't installed. Install them, then run the review again."

These four skills are the review's only way to find the profile, read the design and write a report.

## 1. Settle the inputs

Settle everything before the review starts, asking for what's missing in as few messages as you can. Nothing is asked once the scan begins. When another skill runs this review, settle the inputs from its hand-over, as Run by another skill describes.

- **Scope:** the node ids of the frames to review, from the user's selection, the frames they name, or the `node-id` in a Figma link. For a page, use its top-level frames. In an external agent, the file key comes from the file's link.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.
- **Given at run time,** when the user names them: a Review Profile (its text, a local file, or a link to a Figma file or a GitHub file), and any of the Accessibility settings under What to check against, such as a target ("WCAG 2.2 AA", or a standard the criteria reference names, such as "Section 508"), `Report above target: yes`, an additional requirement, or a criteria reference location (a URL or a local file), and the Product context's settings. A setting given at run time takes the place of the profile's for this run. Also where to save this run's report, if the user says: "don't save", or "save to <location>", and whether to mark its Findings on their layers: "annotate", or "don't annotate".
- **What to check against:** find the Review Profile, then settle the Accessibility and Product context settings from it or by asking, as Review Profile below describes.

The inputs are settled when the scope, runtime and settings are known, or the run has stopped.

## 2. Read the criteria reference

Its location is the first of: given at run time or in answer to a question, the profile section's `Criteria reference` unless that's the skill's default, then the skill's default, `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/main/reference-documents/wcag-2.2-criteria.md`. Read the whole document, as Reading a location describes.

- If a location the user or the profile gave can't be read, and nothing is running this review for another skill, stop. Tell the user the location and the error, and write no report.
- Any other unreadable criteria reference, the default link or a given location when another skill runs this review, skips the axis. Hand the Report Writer no Findings and one Coverage entry, `{ "axis": "accessibility", "status": "skipped", "reasonCode": "reference-unreadable", "reason": "the criteria reference couldn't be read: <location>: <error>" }`, and go to step 5.

From the document's header, note its name, version and location for the report, and its `Covers` line. Its "How an entry reads" section says which criteria apply to the target.

**A named standard,** a target that isn't WCAG, such as Section 508, resolves through the reference's "Named standards" section. A standard listed there is judged as the WCAG target its entry gives, in every step after this one, exactly as that target is. Add the one Coverage entry its entry gives.

**A target the reference doesn't cover** gets only its additional requirements judged in step 4. It is a version or level missing from the `Covers` line, or a standard that "Named standards" doesn't list (a reference without that section lists none). Give the target one Coverage entry in their place: `{ "axis": "accessibility", "ref": "<the target as stated>", "status": "not-readable", "note": "The criteria reference covers <its Covers line>, not <the target as stated>. Only additional requirements were judged." }`, with the target written as `WCAG <version> <level>` for a WCAG target and as the standard's name otherwise.

## 3. Scan

Use the skills `design-review-scanner` and `design-review-scanner-assets`, which each read their own fact groups: `colourPairs`, `text`, `structure` and `annotations` from `design-review-scanner`, and `components` from `design-review-scanner-assets`. Give each the scope's node ids and the runtime, and give `design-review-scanner` the settings' `Annotation kits`. Ask each only for the fact groups to judge from that it reads: those on the `Facts` lines of the criteria you'll judge in step 4, those holding what each additional requirement is about, and `components`, which says whose a failure is (Whose failure it is). Join the two results for each node: `groups` and `unread` joined, and each group's field from the scanner that read it. Judge from the joined Design Facts.

When another skill handed over Design Facts, the design is already scanned: judge from those, as Run by another skill describes.

## 4. Judge

Judge these three sets. At a target the reference doesn't cover, judge only the additional requirements.

- **The target's criteria:** every criterion in the reference that applies to the target.
- **Above-target checks,** only with `Report above target: yes`: every `static` criterion in the reference that doesn't apply to the target, such as its AAA entries.
- **Additional requirements:** each one, judged like a criterion. Its statement is its test.

Give each exactly one Coverage entry, `{ "axis": "accessibility", "ref": "<criterion number, or requirement id>", "status": "<status>" }`. Add a `note` to any status but `judged`, and to every above-target entry ("above target"). The status is the first that fits:

1. `needs-code` when its group is `code`. It's never a Finding.
2. `not-readable` when a fact group it needs is in the facts' `unread`, or none of its measurements could be made. The note gives the scanner's reason.
3. `not-applicable` when its trigger isn't in the scope. The facts show what a layer is by its name, its type, its prototype `reactions`, and the text in and beside it. The trigger alone decides this: an annotation never brings a criterion in.
4. `needs-section` when it has markers and no marked section lets it be judged, as Marked sections describes.
5. `needs-annotation` or `needs-state` when the annotation or state its Needs line names is missing for one of its triggers, as Annotations and states describes.
6. `judged` otherwise, following its How to judge.

Work out any measurement the facts don't give, such as the spacing between two targets or the contrast between two runs' colours, from the facts' values, with code where you can run it.

Each failure becomes part of a Finding:

- **Root Cause:** the source the criterion's How to judge names, written as `variable:<key>` or `style:<key>` when the facts show that value bound to one, otherwise `node:<id>` of the failing layer. A failure that is the design system's has the library component instead, as Whose failure it is gives. Give one Finding per Root Cause per criterion, with every layer it covers in `locations` and each failing measurement in the evidence. A missing annotation's Finding is under Annotations and states.
- **Severity:** the criterion's Default Severity, or the one a profile's Severity Override sets (see Severity Overrides), or an additional requirement's own. An additional requirement given as critical with no core task in its statement starts at serious instead, and the evidence says why.
- **Above target:** every above-target Finding is advisory, with no `standard`. Give one per Root Cause across all the above-target checks, naming each criterion it fails, with its W3C link, in the evidence.
- **Certainty:**
  - `confirmed` for a measurement from facts with no `flags`.
  - `likely` for a measurement from facts with a flag, such as `opacity` or `blend-mode`, which the evidence names; or for a judgement of wording or meaning, such as whether a heading describes its section.
  - `needs-review` when a measurement couldn't be made, such as text over an image. The evidence gives why, from the scanner's `reason` or the criterion's How to judge. This is always a Finding, since it may fail.
- **Title:** one line naming the layer and what fails.
- **Evidence** and **fix,** as the criterion's How to judge says.
- **Locations:** `{ "kind": "node", "fileKey", "nodeId", "layerPath" }` for each layer in the facts, after the library component's `{ "kind": "component", "key", "name", "library" }` when the failure is the design system's. When a facts group's `count` is more than its sample `nodes`, the evidence says how many more layers share it.
- **Standard:** `{ "source": "WCAG <version>", "ref": "<number>", "url": "<its W3C line>" }`, with the url the reference gives for the target's version. A named standard's Findings take the WCAG version it was judged as. For an additional requirement, `{ "source": "Additional requirement", "ref": "<id>" }`.

Judging is done when every criterion that applies to the target (or an uncovered target itself, or a named standard's own entry), every above-target check that's on, and every additional requirement has one Coverage entry, and every failure, measurement that couldn't be made, and missing annotation (unless `coverage only`) is in a Finding, with every measured failure given its owner by Whose failure it is. The reference's header says how many criteria apply at each target it covers: check your criteria's Coverage entries against it.

## 5. Report

Use the skill `design-review-report-writer`, handing over:

- `mode`: `json only` when the skill running this review asked for it, otherwise `full report`.
- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts, and `settings`. `settings` is null when a profile gave the target, `Report above target`, the additional requirements, `Missing annotations`, `Annotation kits`, `Marker words` and the Product context, whatever the criteria reference's location. Otherwise it holds what no profile gave:
  - `accessibility`, unless a profile's Accessibility section gave the target, `Report above target`, the additional requirements, `Missing annotations`, `Annotation kits` and `Marker words`: `{ "standard": "WCAG" or the standard as named, such as "Section 508", "version": "<version>", "level": "<level>" (the version and level it was judged as), "from": "profile", "run time", "asked" or "default", "criteriaReference": "<location>", "reportAboveTarget": "yes" or "no", "additionalRequirements": ["<id> (<Severity>): <statement>", …], "missingAnnotations": "findings" or "coverage only", "annotationKits": ["<kit>", …], "markerWords": ["<word> (<criteria>)", …] }`, where `from` says where the target came from.
  - `productContext`, unless a profile's Product context section gave it: `{ "targetPlatforms": ["<platform>", …], "supportedViewportWidths": ["<width>", …], "from": "run time", "asked" or "default" }`.
- `profile`: `{ name, location, lastUpdated }` for the profile whose section you used, otherwise null.
- `references`: the criteria reference's name, version and location.
- `findings`, each with its `rootCause`, and `coverage`.
- `notes`: the notes kept while settling what to check against, if any, and any the skill running this review handed over.
- `reportSettings`: the profile's Report settings you noted, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: "don't save" or "save to <location>" when the user said so, otherwise null.
- `annotateRequest`: "annotate" or "don't annotate" when the user said so, otherwise null.

The review is done when the Report Writer has delivered the report. In `json only` mode, it's done when you've handed the Report Writer's reply, its notes and JSON block, back to the skill that ran this review.

## Whose failure it is

A failure measured from layers, such as a contrast ratio or a size, is the design system's when it exists in the library as published, and the designer's otherwise. A missing annotation, and a judgement of wording or meaning, are the designer's. A library is any component with `remote: true`, whatever the profile's Design System Layers say. Settle each failing layer's owner from the facts' `components`, taking the first line that fits:

1. **The designer's, outside a library instance.** An id shows the instances around a layer: inside the instance `152:62`, a layer's id looks like `I152:62;1004:35`, and inside the instance `12:3` nested in it, `I152:62;12:3;45:6`. A layer's instance is the first id in its chain, the outermost, or the layer itself when it is an instance listed in `components`. A layer in no instance, in a frame detached from one, or in an instance whose component has `remote: false`, is the designer's.
2. **The designer's, on a surface it placed.** The layer its colour is measured against (`background.node` or `against.node`, the group's first layer's, which stands for every layer in the group) sits outside the instance: a library component placed on a surface that makes it fail.
3. **The designer's, by an override.** The facts' `overrides` list, by `node.id`, a change on a failing property of the failing layer or the layer behind it, or a swapped nested instance (`component`) holding the failing layer. A change with `carried: true` came from the library's own component, so it falls to line 5.
   - **The failing properties** are what the measurement reads. For a contrast ratio: the `fill` or `stroke` of the failing layer and of the layer behind it, `visible` of the layer behind it, `opacity` of each layer from the failing layer up to and including the instance, and a text layer's font, size and weight (`text`, apart from its words, `content`). For a size: `size`, `layout` and `spacing`. For any other measurement: every property.
   - The evidence names the instance's component and the properties overridden.
4. **The designer's, with the override state unsettled.** A change on those layers in `variables` or `other`, or with an `uncertain` reason, or `components` or the instance's main component among the facts' `unread`. The Finding's Root Cause is `node:<id>` of the failing layer, whatever its colour is bound to, instead of step 4's `variable` or `style`. Its evidence says "possibly inherited from <component>" with the reason, such as "its `locked` and `exportSettings` changed, which the facts can't class".
5. **The system's.** Any other layer: its instance has no change on a failing property. Changes to other properties, such as a label set through a component property, or the resize that follows it, leave it here.

Only the sampled `nodes` of a group are checked. One Finding per owner: a group whose sampled layers have different owners gives each owner's layers a Finding of their own.

**The system's failure:**

- **Root Cause:** `component:<key>` of the outermost instance's main component, the set's key for a variant, with a Finding per component per criterion.
- **Evidence:** the criterion's evidence, then that the failure is in the published component, how many instances take it unchanged, and the properties with no override.
- **Fix:** names the library as the owner, from the component's `library` in the facts, such as "Owned by <library>: change `<component>` so its text meets 4.5:1." With `library` null, it names the component and says its library couldn't be named. Then the criterion's fix.
- **Severity** and **Certainty** are the same as for any Finding of the criterion, as step 4 gives them.

**The designer's failure** is written as step 4 says, apart from line 4's Root Cause.

## Run by another skill

Another skill, such as `design-review`, can run this review as one part of a larger one. It loads this skill first, for three lines:

- **Fact groups:** `colourPairs`, `text`, `structure` and `annotations` (read by `design-review-scanner`), and `components` (read by `design-review-scanner-assets`): every group a criteria reference's `Facts` lines can name. The caller scans for them once, for every review in the run, giving `design-review-scanner` the `Annotation kits` from the Accessibility section, or from the run-time settings.
- **For the caller to ask:** nothing. With no Accessibility section, this review uses its default target, WCAG 2.2 AA, and with no Product context, `Target platforms: Web`, and says so.
- **Set up:** `Accessibility`: the section this skill writes in `set up` mode (Set up mode).

Then it settles the run, asks the user everything, and hands over:

- the scope, the runtime, and the `mode` for step 5
- the Review Profile it found, as `design-review-profile`'s `found` result
- the Design Facts, when it has scanned
- anything the user gave at run time for this review, such as a criteria reference location or a WCAG target
- notes for the report, if any, such as a version warning

The user has been asked everything already, so ask nothing. Where you'd ask what to check against, use what the question is pre-filled with, set `from` to `default`, and keep the note you'd keep for the report. When a fact group you need is neither read in the handed-over facts nor in their `unread`, scan for that group yourself, as step 3 describes.

## Annotations and states

An `annotation/prototype` criterion is judged once what its Needs line names exists.

- **An annotation** is one in the facts' `annotations`: a native annotation, or an instance of one of the settings' `Annotation kits`. A free-text note on the canvas (`annotations.notes`) counts too, but a Finding that rests on one is `likely`. Layer names and Figma comments aren't annotations.
- **Its kind** is what its text gives, whatever its category: a text alternative, a reading order, a page title, a language, and so on. It serves a Needs line of that kind.
- **A state** is a frame, a variant or a prototype interaction in the facts' `structure` that shows the behaviour, or an annotation that describes it.
- **Where an annotation belongs:** on the layer that triggers the criterion, such as an image for its text alternative, or on the scanned frame when the trigger is the frame as a whole, such as its reading order, title or language. An annotation serves a layer when it's attached to that layer or to a frame holding it, or when it names the layer or sits beside it.

A missing state gives `needs-state` and no Finding. A missing annotation gives `needs-annotation` and, unless the settings say `Missing annotations: coverage only`, a missing-annotation Finding:

- **One per missing annotation:** its kind (from the Needs line) on the layer it belongs on, however many criteria need it. `standard` is the most severe of those criteria, the first in the reference on a tie, and the evidence names the others.
- **Root Cause:** `node:<id>` of that layer, which is also the location.
- **Severity:** that criterion's, as step 4's Severity gives it. **Certainty:** `needs-review`.
- **Evidence:** what triggers each criterion, and that no annotation of that kind was found. **Fix:** add the annotation.

When `annotations` is in the facts' `unread`, these criteria are `not-readable` (status 2), so no missing-annotation Finding is raised.

## Marked sections

A criterion with markers (a Markers line other than `none`) is judged only inside a section marked for it.

- **A marked section** is the scanned frame, a Figma section holding it (`structure.sections`), or a frame or group inside it (in `structure.layers`), whose name has the criterion's number, a marker word from its Markers line, or one of the settings' `Marker words` for it, as a whole word, ignoring case. A component, or an instance, is marked when one of its variants takes a variant value from the Markers line, such as `State=Focused` in a layer's `variant`. A size, such as "320", never marks a section.
- **Nothing marked:** `needs-section`, with the note `No section is marked for it. Add a section titled "<the first marker word on its Markers line>".` When a marked section lacks what the How to judge needs, it's `needs-section` too, and the note says what to add.
- **Inside a marked section,** judge what it holds as the How to judge says. Its failures are ordinary Findings.

## Set up mode

The Orchestrator uses this skill in `set up` mode, in a first run or to add this axis to a profile, to settle the **Accessibility** section. Judge nothing, scan nothing and write no report. Ask the one question below, and hand back the section.

1. **Ask the target,** pre-filled with the default: "Judge against WCAG 2.2 level AA, using the default criteria reference? Name another version or level to change it." Take the standard, version and level from the answer; a standard such as Section 508 is written as named, with no Version or Level. Add nothing the user didn't name: the other settings below stay at their defaults.
2. **Hand back** the section, in this format:

   ```markdown
   ## Accessibility

   The accessibility standard designs are judged against.

   - Standard: WCAG
   - Version: 2.2
   - Level: AA
   - Criteria reference: the skill's default
   ```

Set up is done when the user has agreed to the target and you've handed the section back.

## Review Profile

A team's Review Profile names the standards its reviews are judged against. This skill uses only the profile's **Accessibility** and **Product context** sections and the Severity Overrides about WCAG, and hands its **Report settings** section to the Report Writer, which saves the report. It never creates or changes a profile, nor offers to: in `set up` mode it hands a section to the Orchestrator, which writes it.

### Finding the profile

When another skill hands over the profile it found, use that result. Otherwise use the skill `design-review-profile` to find the Review Profile. Give it the reviewed file's key, the runtime, and the profile given at run time, if any. It hands back one of three results:

- **found:** the profile's `text`, where the lookup found it (`from`), and the `profile` to name in the report.
- **none:** where it looked (`searched`).
- **unreadable:** a `location` and a `reason`. The team has a profile that this run can't see, so stop: reply with the location, the reason, and that the review didn't run. Write no report.

### What to check against

The Accessibility section holds this skill's settings, one `Key: value` per line:

| Setting | Default |
|---|---|
| `Standard`, `Version`, `Level`: the target, such as WCAG, 2.2 and AA. `Standard: WCAG 2.2` gives the version too. `Standard: Section 508` names a standard the criteria reference resolves, and needs no `Version` or `Level` | WCAG 2.2 AA |
| `Criteria reference`: the criteria reference's location | the skill's default (step 2) |
| `Report above target`: `yes` adds the above-target checks in step 4, as advisory Findings | `no` |
| `Additional requirement`: one of the team's own requirements, one line each, `Additional requirement: <id> (<Severity>): <statement>`, such as `Additional requirement: AR-1 (minor): Body text is at least 16 px.` The Severity is critical, serious, moderate or minor. A line with no id takes the first `AR-<n>` not already used | none |
| `Missing annotations`: `findings` raises a Finding for each missing annotation, and `coverage only`, for teams that annotate outside Figma, only lists them in Coverage | `findings` |
| `Annotation kits`: the kits whose instances count as annotations, each named by what its components' names start with, such as `Annotation kits: A11y annotations/, Handoff notes/` | none |
| `Marker words`: words that also mark a section, each with the criteria it marks, such as `Marker words: Narrow screens (1.4.10); Journey (3.2.3, 3.2.4, 3.2.6)`. They add to the reference's markers | none |

Settle the settings by what the lookup found:

- **A profile given at run time (`from` is `run time`), or handed over by another skill, with an Accessibility section:** use the section without asking. Giving the profile is the user's agreement.
- **A profile found on the page or through a pointer in a project file, with an Accessibility section:** ask before using it, with any other question still open. For example: "I found the Review Profile "<name>" on the "Review Profile" page in this file. Use its Accessibility section for this review? It sets WCAG 2.2 AA with the default criteria reference, and the Severity Override "WCAG AA failures: serious". I'll use only that and where it saves reports, and I won't change it." Name where it saves reports, and whether it annotates layers, from its Report settings, if it has them, and any Severity Override you'll refuse, and why. On yes, use the section. On no, go on as below.
- **No profile, no Accessibility section, or the user said no:** say why you're asking, from the lookup's `searched` when there's no profile, then ask what to check against, each setting pre-filled with its default. For example: "I couldn't find a Review Profile: none was given, this file has no "Review Profile" page, and AGENTS.md has no pointer to one. What should I check against? I'll use WCAG 2.2 AA with the default criteria reference unless you name others. Your answer is for this run only, and isn't saved to a profile." With the target already given at run time, there's nothing to ask. For a profile without the section, keep a note for the report: "The Review Profile "<name>" has no Accessibility section, so this run used the settings below."

From a profile whose section you use, also note its `profile` and its Severity Overrides about WCAG. From any profile the lookup found, unless the user said no to it, note its Report settings.

### Product context

The **Product context** section says where the product runs, for the checks that depend on screen size, such as target size. One `Key: value` per line:

| Setting | Default |
|---|---|
| `Target platforms`: the platforms, separated by commas, such as `Web, iOS`. The criteria reference says how each one's frames are measured | `Web` |
| `Supported viewport widths`: the widths designed for, such as `375px, 768px, 1440px` | none |

Use the Product context of any profile the lookup found, unless the user said no to it, and name it when you ask before using that profile. Settings given at run time take its place. With no Product context, add its settings, pre-filled with their defaults, to any question you ask about what to check against. When there's nothing to ask, use the defaults, and keep a note for the report: "No Product context was given, so this run used `Target platforms: Web`."

### Severity Overrides

A profile's **Severity Overrides** section sets the starting Severity for a type of rule, one `<type of rule>: <Severity>` per line, such as `WCAG AA failures: serious`. Apply the lines about WCAG: failures at every level (`WCAG failures`), at one level (`WCAG AA failures`), or of one criterion (`1.4.3`). When several match a Finding, the most specific wins: a criterion, then a level, then every level. They set the Severity of Findings against the target's criteria: above-target Findings stay advisory, and additional requirements keep their own Severity. Lines about other axes are for other skills.

- **Critical needs a core task.** A line that sets critical names the core task it's tied to, such as `1.4.3: critical, core task: paying for an order`, and the evidence of each Finding it changes gives that task. Refuse a line that names none: treat it as absent, so a less specific line or the Default Severity applies, and keep a note for the report: "The Severity Override "<line>" wasn't applied: it sets critical without naming a core task."
- **Say so in the evidence.** When an override changes a Finding's Severity, its evidence says so, such as "Severity raised from moderate to serious by the Review Profile's Severity Override "WCAG AA failures: serious"."

## Reading a location

- **A URL:** fetch it. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`.
- **A local file,** in an external agent: read it.
