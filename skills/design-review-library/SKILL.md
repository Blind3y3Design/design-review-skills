---
name: design-review-library
description: Design system adherence review of Figma frames. Judges how a design uses the team's Design System Layers, such as raw values where a variable or style could be bound, assets from outside the stack, detached instances and overridden components, and reports Findings and Coverage. Use when the user asks for a design system adherence, design token, variable or component review of a Figma design.
metadata:
  version: "0.1.0-dev"
---

# Design system adherence review

Version 0.1.0-dev of the design review skills.

A review of Figma frames along one Review Axis, `design-system`, which reports call design system adherence. This skill holds only the procedure. Everything about a check, such as its trigger, how to judge it and its default Severity, comes from the Design system baseline Reference Document. Judge from that document, the Design System Layers and the Design Facts alone, never from what you know of design systems.

## Required skills

This review MUST use three other skills: `design-review-profile` finds the Review Profile, `design-review-scanner-assets` reads the design, and `design-review-report-writer` writes the report. Before anything else, check that all three are available to you. If any isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- More than one missing, naming each, such as: "This review can't run: the skills `design-review-scanner-assets` and `design-review-report-writer` aren't installed. Install them, then run the review again."

These three skills are the review's only way to find the profile, read the design and write a report.

## 1. Settle the inputs

Settle everything before judging starts, asking for what's missing in as few messages as you can. When another skill runs this review, settle the inputs from its hand-over, as Run by another skill describes.

- **Scope:** the node ids of the frames to review, from the user's selection, the frames they name, or the `node-id` in a Figma link. For a page, use its top-level frames. In an external agent, the file key comes from the file's link.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.
- **Given at run time,** when the user names them: a Review Profile (its text, a local file, or a link to a Figma file or a GitHub file), the Design System Layers, or a baseline location (a URL or a local file). What's given at run time takes the place of the profile's for this run. Also where to save this run's report, if the user says: "don't save", or "save to <location>", and whether to mark its Findings on their layers: "annotate", or "don't annotate".
- **What to check against:** find the Review Profile, then settle the Design System Layers from it or by asking, as Review Profile below describes.

The inputs are settled when the scope, runtime and anything given at run time are known, and the layers are settled or wait to be asked after the scan, or the run has stopped.

## 2. Read the baseline

Its location is the first of: given at run time, the `Baseline` line of the section you use unless that's the skill's default, then the skill's default, `https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/main/reference-documents/design-system-baseline.md`. Read the whole document, as Reading a location describes.

- If a location the user or the profile gave can't be read, and nothing is running this review for another skill, stop. Tell the user the location and the error, and write no report.
- Any other unreadable baseline, the default link or a given location when another skill runs this review, means there's no baseline, so the axis is skipped. Hand the Report Writer no Findings and one Coverage entry, `{ "axis": "design-system", "status": "skipped", "reasonCode": "reference-unreadable", "reason": "no Design system baseline: <location> couldn't be read: <error>" }`, and go to step 5.

From the document's header, note its name, version and location for the report.

## 3. Scan

Use the skill `design-review-scanner-assets`, which reads `bindings` and `components`. Give it the scope's node ids, the runtime, and the fact groups on the `Facts` lines of the baseline's checks. Judge from the Design Facts it hands back.

When another skill handed over Design Facts, the design is already scanned: judge from those, as Run by another skill describes.

If the Design System Layers are still to be asked, ask now, as What to check against describes, and have the answer before you judge.

## 4. Judge

Judge every check in the baseline, and give each exactly one Coverage entry, `{ "axis": "design-system", "ref": "<check id>", "status": "<status>" }`. The status is the first that fits:

1. `not-readable` when a fact group it needs is in the facts' `unread`, by its name or through the id of a node that couldn't be read (a node that isn't there, is hidden or sits under a hidden layer has no `groups`). Add a `note` with the scanner's reason.
2. `not-applicable` when its trigger isn't in the scope. Add a `note` saying so.
3. `judged` otherwise, following its How to judge. When `unread` lists part of a group it needs, such as gradient paints, add a `note` saying what wasn't read.

Judge detached instances and overrides from the components facts alone: the scanner reads them from each frame's `detachedInfo` and each instance's `overrides`, never from a layer's name or look.

Each Finding its How to judge calls for is written this way:

- **Root Cause** and **evidence,** as the check's How to judge says. A Root Cause is written `node:<id>` for a layer, or `variable:<key>`, `style:<key>` or `component:<key>` for an asset. Give one Finding per Root Cause per check, with every layer it covers in `locations`.
- **Severity:** the check's Default Severity.
- **Certainty:** the check's Certainty line.
- **Title:** one line naming the layer or component and what's wrong.
- **Fix:** as the check's How to judge says, with tokens only from Token suggestions below.
- **Locations:** `{ "kind": "node", "fileKey", "nodeId", "layerPath" }` for each layer in the facts. A library asset or local asset that the Finding is about goes first, unless the check's How to judge orders them otherwise: a component as `{ "kind": "component", "key", "name", "library" }` (for a set, the set's key and name), a style as `{ "kind": "style", "key", "name", "library" }`, or a variable as `{ "kind": "variable", "collection", "name", "library" }`, with `collection` its collection's name. Its `library` is as Attributing an asset gives it.
- **Standard:** `{ "source": "Design system baseline", "ref": "<check id>", "url": "<the baseline's location>" }`, leaving out `url` when the location isn't a link.

Judging is done when every check in the baseline has one Coverage entry, and every Finding that each check's How to judge calls for is written.

## 5. Report

Use the skill `design-review-report-writer`, handing over:

- `mode`: `json only` when the skill running this review asked for it, otherwise `full report`.
- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`, the name null when nothing was scanned), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts (null with no scan), and `settings`. `settings` is null when a profile's Design System Layers section gave the layers, whatever the baseline's location. Otherwise it's `{ "designSystem": { "from": "run time" or "asked", "layers": ["1. <layer>: <library>, <library>", …] } }`.
- `profile`: the `profile` `design-review-profile` handed back, when you used its section, otherwise null.
- `references`: the baseline's name, version and location, when it was read.
- `findings`, each with its `rootCause`, and `coverage`.
- `notes`: the notes kept while settling what to check against, if any, and any the skill running this review handed over.
- `reportSettings`: the profile's Report settings you noted, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: "don't save" or "save to <location>" when the user said so, otherwise null.
- `annotateRequest`: "annotate" or "don't annotate" when the user said so, otherwise null.

The review is done when the Report Writer has delivered the report. In `json only` mode, it's done when you've handed the Report Writer's reply, its notes and JSON block, back to the skill that ran this review.

## Run by another skill

Another skill, such as `design-review`, can run this review as one part of a larger one. It loads this skill first, for three lines:

- **Fact groups:** `bindings`, `components` (both read by `design-review-scanner-assets`): the groups the baseline's checks are judged from. The caller scans for them once, for every review in the run.
- **For the caller to ask:** nothing. Without Design System Layers, there's nothing to check against.
- **Set up:** `Design System Layers`: the section this skill writes in `set up` mode (Set up mode).

Then it settles the run, asks the user everything, and hands over:

- the scope, the runtime, and the `mode` for step 5
- the Review Profile it found, as `design-review-profile`'s `found` result
- the Design Facts, when it has scanned
- anything the user gave at run time for this review, such as a baseline location or the Design System Layers
- notes for the report, if any, such as a version warning

The user has been asked everything already, so ask nothing. With no Design System Layers given at run time or in the profile, skip the axis: hand the Report Writer no Findings and one Coverage entry, `{ "axis": "design-system", "status": "skipped", "reasonCode": "no-layers", "reason": "no Design System Layers: the Review Profile has no Design System Layers section" }`. When a fact group you need is neither read in the handed-over facts nor in their `unread`, scan for that group yourself, as step 3 describes.

## Set up mode

The Orchestrator uses this skill in `set up` mode, in a first run or to add this axis to a profile, to settle the **Design System Layers** section. Judge nothing, read no baseline and write no report. It hands over the scope, the runtime and the Design Facts (`bindings` and `components`). Ask the one question below, and hand back the section.

1. **Read the libraries from the facts.** A library is **used** when the facts name it as the `library` of a variable in the bindings facts' `variables`, a style in `styles`, or a component in the components facts' `components`. Its **uses** count only what the design uses itself: the `uses` of its variables and styles beyond their `inComponents`, plus the `instances` of its components. What comes inside an instance counts with the instance. A library **builds on** another when one of its variables has an `alias`, directly or down the chain the facts follow, to a variable of the other. A used library that builds on one, or has one built on it, is **linked**. Every other used library is **unlinked**.
2. **Propose the stack.**
   - **Layers:** one for each linked library, named after it, ordered as What to check against orders pre-filled layers: a library before every library that builds on it. Libraries that don't build on each other go in the order of their uses, most first.
   - **Unlinked libraries,** when a linked library gives the stack its layers: one with fewer than 10 uses is proposed to be left out, with the reason, such as "used 3 times, and no library's variables link to it". Its assets are reported as outside the stack. Ask about each other one: which layer it belongs with, or whether it is a layer of its own, and where.
   - **No linked library:** with one used library, it is the only layer, however few its uses. With several, none can be placed by its links and none is proposed to be left out. Ask which of them make up the design system, most general first, giving each one's uses.
   - **Match hints:** for each library, `prefix `<prefix>`` when every component (its set's name, for a variant) and style the facts name from it starts with the same text up to and including its first `/`, otherwise `none`. Variables' names and collections give no hint.
   - **Rules document:** `none (Design system baseline only)`. Don't ask for one, or for an owner.
   - **Baseline:** `the skill's default`.
3. **Ask once,** with the proposal, the questions about unlinked libraries, and the libraries left out. When the facts show variables, styles or components defined in the reviewed file itself (`remote` false), add that they are outside the stack unless a layer lists this file, with its link. For example: "This design uses variables from Foundation Tokens and Web Platform Kit. I worked out the stack from which libraries' variables point at which, most general first: 1. Foundation Tokens, 2. Web Platform Kit. I've left out Old Marketing Kit: it's used 3 times, and no library's variables link to it, so anything from it is reported as outside your design system. No layer has a rules document yet, so only the built-in checks run. Does this look right?" When the facts' `unread` lists libraries it couldn't name, say so in the question, since they are missing from the proposal. Take the user's changes: a library moved, left out, put back in (then ask which layer it belongs with, if it is unlinked), or a rules document location they give. Ask again only for a library still unplaced.
4. **Hand back** the section in the format of Design System Layers below, with one layer per proposed layer, and a note for each library left out: "<library> was left out of the stack: <reason>."

Set up is done when every used library is in a layer or left out, and the user has agreed to the stack. With no used library, hand back that the axis can't be set up, with the message of the branch that fits. The facts hold **remote assets** when a variable, style or component in them has `remote` true, or a detached frame's `source` has `type` `library` (its `remote` is null when the scanner didn't name it).

- **Remote assets:** "this design uses assets from libraries, but their libraries couldn't be read, so there are no Design System Layers to set up from it", then the reasons the facts' `unread` gives for the library names (`library names`, `component and style libraries`). When a reason says the libraries aren't among those the file has, add that a library is added to the file in Assets > Libraries.
- **No remote assets:** "this design uses no library, so there are no Design System Layers to set up".

## Attributing an asset

Every variable, style and component in the facts belongs to one Design System Layer, or to none. Attribute each by the first of these that fits:

1. **By its library,** `confirmed`: the asset's `library` in the facts, which the scanner found by key. The asset belongs to the layer whose `Libraries` lists a library of that name. When no layer lists it, it's outside the stack.
2. **Local,** `confirmed`: an asset with `remote: false`, defined in the reviewed file. It belongs to the layer whose `Libraries` links to the reviewed file, matched by the file key in the link. When no layer does, it's outside the stack.
3. **By match hint,** `likely`: a component or style with no `library`, whose name (its set's name, for a variant) starts with a layer's match hint. It belongs to that layer, the longest hint winning when several layers' hints fit.
4. **Unattributed:** a component or style with no `library` and no matching hint.

A library variable with no `library` has a library whose name couldn't be read, so it can't be placed either way. No check judges it, and the Coverage notes in step 4 say why, from the facts' `unread`.

Attribution goes only by a library's name as the scanner found it by key, or by a file's key, never by a collection's name: two libraries can share collection names such as `Theme`. With no layers settled, nothing is in the stack.

In a location, an asset's `library` is the library it was attributed to: its `library` in the facts; for a local asset, the name of the layer's library that links to this file; by match hint, the layer's library, or its libraries joined by " or " when it lists several. It's null for a local asset no layer covers, and for an unattributed one. When a location's library comes from a match hint, the Finding's evidence says so.

## Token suggestions

A fix names a token only when one was found in the design: a variable or style in the bindings facts' `variables` or `styles`, including one reached only through an alias. A suggestion never changes a Finding's Certainty.

1. **Keep the stack's tokens:** the variables and styles that Attributing an asset puts in a layer.
2. **Keep the matches.** A token matches a raw value when it's for the same kind of property and has the same value:
   - a fill or stroke: a colour variable, or a paint style with one solid paint, of the same hex, alpha included
   - a radius or spacing: a number variable of the same number
   - text: a text style of the same value, such as `Inter Regular 16/24`
   - an effect: an effect style of the same value
3. **Name what's left.** Name each match with its library, as Attributing an asset gives it, such as "`color/surface/muted` (Foundation Tokens)".

## Review Profile

A team's Review Profile names the standards its reviews are judged against. This skill uses only the profile's **Design System Layers** section, and hands its **Report settings** section to the Report Writer, which saves the report. It never creates or changes a profile, nor offers to: in `set up` mode it hands a section to the Orchestrator, which writes it.

### Finding the profile

When another skill hands over the profile it found, use that result. Otherwise use the skill `design-review-profile` to find the Review Profile. Give it the reviewed file's key, the runtime, and the profile given at run time, if any. It hands back one of three results:

- **found:** the profile's `text`, where the lookup found it (`from`), and the `profile` to name in the report.
- **none:** where it looked (`searched`).
- **unreadable:** a `location` and a `reason`. The team has a profile that this run can't see, so stop: reply with the location, the reason, and that the review didn't run. Write no report.

### Design System Layers

This skill's section. It lists the design systems the work is checked against, from the most general layer to the most specific:

```markdown
## Design System Layers

The design systems this work is checked against, most general first. A more specific layer overrides a more general one, unless the general layer locked the rule.

- Baseline: the skill's default

### 1. Foundation

- Owner: Foundation design system team
- Libraries: Foundation Tokens (https://www.figma.com/design/F0und/Foundation-Tokens), Foundation Icons (https://www.figma.com/design/F0ic0n/Foundation-Icons)
- Match hints: prefix `Foundation/`
- Rules document: none (Design system baseline only)
- Docs: https://example.com/foundation-guidelines
```

- `Baseline`: the baseline's location, or `the skill's default`.
- Each layer is a `###` heading, numbered from 1 for the most general, with its name.
  - `Owner`: optional.
  - `Libraries`: each library's name as Figma shows it, separated by commas, with its file link in brackets when it has one. Library assets are matched to a library by that name, and local assets by the file key in a link, so a team can list its working file, with its link, to cover its local variables, styles and components. A library needs no link.
  - `Match hints`: name prefixes for components and styles, each written prefix `<prefix>`, separated by commas, or `none`.
  - `Rules document`: the location of the layer owner's rules, or `none`. This version judges the baseline only. When a layer names a rules document, keep a note for the report: "This version judges the Design system baseline only, so the rules document for <layer> wasn't read."
  - `Docs`: optional guideline links.

### What to check against

Settle the layers by what the lookup found:

- **A profile given at run time (`from` is `run time`), or handed over by another skill, with a Design System Layers section:** use the section without asking. Giving the profile is the user's agreement.
- **A profile found on the page or through a pointer in a project file, with the section:** ask before using it, with any other question still open. For example: "I found the Review Profile "<name>" on the "Review Profile" page in this file. Use its Design System Layers for this review? They're 1. Foundation (Foundation Tokens) and 2. Web Platform (Web Platform Kit), with the default baseline. I'll use only them and where it saves reports, and I won't change it." Name where it saves reports, and whether it annotates layers, from its Report settings, if it has them. On yes, use the section. On no, go on as below.
- **No profile, no section, or the user said no:** the layers are asked after the scan in step 3, pre-filled from the file. Say why you're asking, from the lookup's `searched` when there's no profile, then ask which libraries make up the design system, most general first. Pre-fill each library named in the facts' `variables`, one layer each, placing a library before any whose variables alias its own, then each other library named in the facts' `components` and `styles`. With no library named there, offer no layers. For example: "I couldn't find a Review Profile: none was given, this file has no "Review Profile" page, and AGENTS.md has no pointer to one. Which libraries make up your design system, most general first? This design uses variables from Foundation Tokens and Web Platform Kit, so I'll use them as two layers in that order unless you name others. The layers decide what's outside your design system and which tokens I can suggest in fixes. Your answer is for this run only, and isn't saved to a profile." With the layers already given at run time, there's nothing to ask. For a profile without the section, keep a note for the report: "The Review Profile "<name>" has no Design System Layers section, so this run used the layers below."

Layers given at run time or in an answer have the libraries they name, and match hints only when the user gives some. From a profile whose section you use, also note its `profile`. From any profile the lookup found, unless the user said no to it, note its Report settings.

## Reading a location

- **A URL:** fetch it. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`.
- **A local file,** in an external agent: read it.
