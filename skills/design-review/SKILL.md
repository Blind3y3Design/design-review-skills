---
name: design-review
description: Reviews Figma frames along every Review Axis the team has set up, such as design system adherence and accessibility, and merges the results into one report. Use when the user asks for /design-review, a design review, or several kinds of review of a Figma design at once.
metadata:
  version: "0.1.0-dev"
---

# Design review

Version 0.1.0-dev of the design review skills.

The Orchestrator: it runs the Review Skills a team's Review Profile covers, on one scope and from one scan, and merges their Findings into one report. It judges nothing itself. Each Review Skill judges its own axis, the Design Scanner reads the design, and the Report Writer writes and delivers the report.

## Required skills

This review MUST use two other skills: `design-review-scanner` finds the Review Profile and reads the design, and `design-review-report-writer` writes the report. Before anything else, check that both are available to you. If either isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- Both missing: "This review can't run: the skills `design-review-scanner` and `design-review-report-writer` aren't installed. Install them, then run the review again."

## Axes

| Axis | Review Skill | The profile covers it when it has |
|---|---|---|
| Design system adherence | `design-review-library` | a Design System Layers section |
| Accessibility | `design-review-accessibility` | always: without an Accessibility section, the skill uses its default target |
| Research alignment | `design-review-research` | a Research Sources section |

## 1. Find the Review Profile

The **runtime** is `figma-agent` inside Figma Design's agent, and `external-agent` anywhere else. In an external agent, the reviewed file's key comes from its link.

Use the skill `design-review-scanner` to find the Review Profile, once for the whole run, as its Finding the Review Profile describes. Give it the reviewed file's key, the runtime, and the profile the user gave at run time, if any. It hands back one of three results:

- **found:** keep the whole result. Its `text` says which axes the profile covers, and every Review Skill in the run gets it.
- **unreadable:** the team has a profile this run can't see, so stop. Reply with the location, the reason, and that the review didn't run. Write no report.
- **none:** this version can't create a Review Profile yet, so stop. Reply with where the lookup looked (`searched`), that `/design-review` runs against a Review Profile, and that each review can run on its own without one, such as `/design-review-accessibility`.

## 2. Settle the run

Settle everything now, asking what's missing in one message. Nothing is asked once the scan begins.

- **Axes,** from the user and the profile, never from the design:
  - **all:** every axis the profile covers
  - **the axes the user names,** such as "just accessibility"
  - **ask,** when the user names none: list every axis, those the profile covers ticked and the others marked "not set up"

  The **chosen axes** are the ones the user chose that the profile covers. This version can't set up an axis, so one the user chooses that isn't set up is left out: say so before the review starts, and that it can run on its own with its Review Skill, such as `/design-review-library`.
- **Scope:** the node ids of the frames to review: the user's selection, a page's top-level frames, or the frames the user names or links to.
- **The research topic,** when research alignment is chosen. Take it only from the user. You may suggest topics from the file's page names. With no topic, research alignment is skipped, with the Coverage entry `{ "axis": "research", "status": "skipped", "reason": "no topic given" }`.
- **Run-time settings:** what the user asked for this run's report ("don't save" or "save to <location>"), and anything meant for one review, such as a Reference Document location or a WCAG target.

For example: "I'll use the Review Profile "Checkout team profile" from this file's "Review Profile" page. Which reviews should I run? [x] Design system adherence [x] Accessibility [ ] Research alignment (not set up). And what should I review: your selection (Checkout, Payment), this page, or other frames?"

The run is settled when the chosen axes, the scope and the runtime are known, and research alignment has a topic or won't run.

**One chosen axis** hands off to its Review Skill running on its own. You MUST use that skill in `full report` mode, handing over the scope, the runtime, the profile you found and the run-time settings. It scans, judges and delivers its own report, and the run is done when it has. With two or more, go on to step 3.

## 3. Load the Review Skills

For each chosen axis, you MUST use its Review Skill. Load it now, and note the `Fact groups` line in its Run by another skill section. You run it in step 5. This step is done when every chosen axis's Review Skill is loaded and its fact groups noted.

## 4. Scan once

Use the skill `design-review-scanner` once for the whole run. Give it the scope's node ids, the runtime, and every fact group the chosen Review Skills' `Fact groups` lines name. Every Review Skill judges from these Design Facts, so the design is read once. The scan is done when the scanner has handed back the Design Facts for every node in the scope.

## 5. Run the Review Skills

Run each chosen Review Skill in `json only` mode, handing over what its Run by another skill section lists:

- the scope, the runtime, and `mode`: `json only`
- the profile, as the scanner handed it back
- the Design Facts, in full
- the run-time settings meant for that review, in the user's words
- for research alignment, the topic

Where your runtime can run subagents, run each Review Skill in its own subagent, all at the same time. Tell each: "You MUST use the skill `<Review Skill>` in json only mode, with the inputs below. Reply with only what it hands back." Otherwise run them yourself, one after another. The output is the same either way.

Each hands back its notes, if any, and a report JSON. This step is done when every chosen axis that isn't skipped has handed back its report JSON.

## 6. Merge and report

Use the skill `design-review-report-writer` in `full report` mode, handing over the merged review:

- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the scan, and `settings`: every report's `run.settings` joined into one object, or null when each is null.
- `profile`: the found result's `profile`.
- `references`: every report's references, each once.
- `findings`: every report's Findings, each as it came, with its axis and id. A Finding is never merged with one on another axis, since each has its own standard, Severity and Certainty. The Report Writer links those that share a Root Cause.
- `coverage`: every report's Coverage entries, and the entry for each skipped axis.
- `notes`: every report's notes, and your own, such as an axis left out because it isn't set up.
- `reportSettings`: the profile's Report settings section, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: "don't save" or "save to <location>" when the user said so, otherwise null.

Only this call delivers a report. The review is done when the Report Writer has delivered it, with every chosen axis's Findings and Coverage in it.
