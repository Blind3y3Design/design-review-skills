---
name: design-review
description: Reviews Figma frames along every Review Axis the team has set up, such as design system adherence and accessibility, and merges their Findings into one report. Use when the user asks for a design review, or for several kinds of review of a Figma design at once, or asks which versions of the review skills are installed.
metadata:
  version: "0.1.0-dev"
---

# Design review

Version 0.1.0-dev of the design review skills.

The Orchestrator: it runs the Review Skills a team's Review Profile covers, on one scope and from one scan, and merges their Findings into one report. It judges nothing itself. Each Review Skill judges its own axis, the Profile Finder finds the Review Profile, the Design Scanner reads the design, and the Report Writer writes and delivers the report.

## Required skills

When the user only asks for the skills' versions, go to Versions below. Otherwise this review MUST use three other skills: `design-review-profile` finds the Review Profile, `design-review-scanner` reads the design, and `design-review-report-writer` writes the report. Before anything else, check that all three are available to you. If any isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- More than one missing, naming each, such as: "This review can't run: the skills `design-review-scanner` and `design-review-report-writer` aren't installed. Install them, then run the review again."

## 1. Find the Review Profile

The **runtime** is `figma-agent` inside Figma Design's agent, and `external-agent` anywhere else. In an external agent, the reviewed file's key comes from its link.

Use the skill `design-review-profile` to find the Review Profile, once for the whole run. Give it the reviewed file's key, the runtime, and the profile the user gave at run time, if any. It hands back one of three results:

- **found:** keep the whole result. Its `text` says which axes the profile covers, as Axes below describes, and every Review Skill in the run gets it.
- **unreadable:** the team has a profile this run can't see, so stop. Reply with the location, the reason, and that the review didn't run. Write no report.
- **none:** this version can't create a Review Profile yet, so stop. Reply with where the lookup looked (`searched`), that `/design-review` runs against a Review Profile, and that each review can run on its own without one, such as `/design-review-accessibility`.

The profile is found when the lookup has handed back `found`, or the run has stopped.

## 2. Load the Review Skills

Take the axes from the user and the profile, never from the design: the axes the user names, such as "just accessibility", or else every axis the profile covers. For each of those the profile covers, you MUST use its Review Skill. Load it now, and note its Version line and two lines in its Run by another skill section: `Fact groups`, for the scan, and `For the caller to ask`, for your questions. You run it in step 4 or 5.

A Review Skill that isn't installed or won't load is **not loaded**. Its axis is skipped (step 3), and the axis stays in the review: its Coverage entry names the skill's exact name. If none of these Review Skills loads, stop before asking anything. Reply with only: "This review can't run: the Review Skills `<name>`, `<name>` couldn't be loaded. Install them, or run each review in its own prompt, such as `/design-review-accessibility`." Write no report.

This step is done when the Review Skill of every axis that may run is loaded with its Version line and two lines noted, the others are marked not loaded, or the run has stopped.

## 3. Settle the run

Settle everything now, asking what's missing in one message. Nothing is asked once the review starts.

- **Axes:**
  - **all:** every axis the profile covers
  - **the axes the user names**
  - **ask,** when the user names none: list every axis, those the profile covers ticked and the others marked "not set up". A covered axis whose Review Skill is not loaded stays ticked, marked "will be skipped: `<skill>` isn't installed"

  The **chosen axes** are the ones the user chose that the profile covers. This version can't set up an axis, so one the user chooses that isn't set up is left out: say so before the review starts, and that it can run on its own with its Review Skill, such as `/design-review-library`.
- **Scope:** the node ids of the frames to review: the user's selection, a page's top-level frames, or the frames the user names or links to.
- **The research topic,** when research alignment is chosen and its Review Skill is loaded. Take it only from the user. You may suggest topics from the file's page names.
- **What the profile leaves open:** whatever the chosen Review Skills' `For the caller to ask` lines name, each pre-filled with its default.
- **Run-time settings:** what the user asked for this run's report ("don't save" or "save to <location>") and its annotations ("annotate" or "don't annotate"), and anything meant for one review, such as a Reference Document location or a WCAG target.

For example: "I'll use the Review Profile "Checkout team profile" from this file's "Review Profile" page. Which reviews should I run? [x] Design system adherence [x] Accessibility [ ] Research alignment (not set up). And what should I review: your selection (Checkout, Payment), this page, or other frames?"

A chosen axis is **skipped**, with one Coverage entry that you keep for step 6, when:

- its Review Skill is not loaded: `{ "axis": "<axis>", "status": "skipped", "reasonCode": "skill-not-installed", "reason": "the skill <exact name> isn't installed" }`
- it is research alignment with no topic: `{ "axis": "research", "status": "skipped", "reasonCode": "no-topic", "reason": "no topic given" }`

The **runnable axes** are the chosen axes that aren't skipped. Go on by how many there are:

- **None:** stop. If a chosen axis's Review Skill is not loaded, reply as step 2 does, naming those skills. If a chosen axis was skipped for another reason, say which and why. If none was chosen, say which axes the profile covers, and that each review can run on its own with its Review Skill. Write no report.
- **One, with no axis skipped:** hand off to its Review Skill. You MUST use that skill in `full report` mode, handing over what its Run by another skill section lists, without Design Facts, and your version warning as a note, if Versions below gives one. It scans, judges and delivers its own report, and the run is done when it has.
- **Otherwise,** one runnable axis with a skipped one, or two or more: go on to step 4.

The run is settled when the chosen axes, the scope and the runtime are known, every question has its answer or its default, and research alignment has a topic or is skipped.

## 4. Scan once

Use the skill `design-review-scanner` once for the whole run. Give it the scope's node ids, the runtime, every fact group the runnable Review Skills' `Fact groups` lines name, and whatever else those lines say to give it. Every Review Skill judges from these Design Facts, so the design is read once. The scan is done when the scanner has handed back the Design Facts for every node in the scope.

## 5. Run the Review Skills

Run each runnable Review Skill in `json only` mode, handing over what its Run by another skill section lists, from what steps 1 to 4 settled.

Where your runtime can run subagents, run each Review Skill in its own subagent, all at the same time, and wait for every one to hand back. Tell each: "You MUST use the skill `<Review Skill>` in json only mode, with the inputs below. Reply with only what it hands back, or with only the error if it can't finish." Otherwise run them yourself, one after another.

Each hands back its notes, if any, and a report JSON. That JSON may hold no Findings and one `skipped` Coverage entry for its axis, such as when a Reference Document can't be read. Keep it as it came.

A Review Skill **fails** when it ends without a report JSON: it errored, your runtime reports its subagent as timed out or stopped, or it replied with only a message. Keep the others running, and leave the failed skill's axis to its Coverage entry: you never run its review yourself. The axis is skipped, with the Coverage entry `{ "axis": "<axis>", "status": "skipped", "reasonCode": "skill-failed", "reason": "the skill <name> failed: <its error, or its reply>" }`, and a note: "<Review Skill's axis name> wasn't assessed. Run it on its own with `/<name>`."

This step is done when every runnable axis has handed back its report JSON or been skipped as failed.

## 6. Merge and report

Use the skill `design-review-report-writer` in `full report` mode, handing over the merged review:

- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the scan, and `settings`: every report's `run.settings` joined into one object, or null when each is null.
- `profile`: the found result's `profile`.
- `references`: every report's references, each once.
- `findings`: every report's Findings, each as it came, keeping its axis and id. The Report Writer links those on different axes that share a Root Cause and a property.
- `coverage`: every report's Coverage entries, and the entry for each skipped axis, whether step 3 or step 5 skipped it.
- `notes`: every report's notes, and your own, such as an axis left out because it isn't set up, the note for a failed Review Skill, and the version warning, if Versions below gives one.
- `reportSettings`: the profile's Report settings section, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: "don't save" or "save to <location>" when the user said so, otherwise null.
- `annotateRequest`: "annotate" or "don't annotate" when the user said so, otherwise null.

Only this call delivers a report, even when every runnable axis was skipped as failed: its Coverage then says so. The review is done when the Report Writer has delivered it, with every chosen axis's Findings and Coverage in it, the skipped axes included.

## Versions

Every skill in the set opens with a Version line: "Version <version> of the design review skills." The set shares one version.

- **Warn on a mismatch.** Note the Version line of each skill you load for a run: the Profile Finder in step 1, each Review Skill in step 2, the scanner in step 4 and the Report Writer in step 6. When any differs from this skill's, hand over one note: "Version warning: `<skill>` is at <version> and `<skill>` at <version>, but `design-review` is at <this version>. Install one version of every skill in the set." naming each such skill. With none, no note.
- **Report the versions,** when the user asks for them. Load every skill in the set that is installed, and read only its Version line: do only that. Reply with one line per skill, `<skill>: <version>`, or `<skill>: not installed`, then, judging only the installed skills, "All installed skills are at <version>." when they share one version, or "The installed skills are at different versions: install one version of every skill in the set." when they don't. A skill that isn't installed doesn't count as a different version. The set is `design-review`, the Review Skills in the Axes table, `design-review-profile`, `design-review-scanner`, `design-review-report-writer` and `design-review-figma-writer`.

## Axes

| Axis | Review Skill | The profile covers it when it has |
|---|---|---|
| Design system adherence | `design-review-library` | a Design System Layers section |
| Accessibility | `design-review-accessibility` | always: without an Accessibility section, the skill uses its default target |
| Research alignment | `design-review-research` | a Research Sources section |
