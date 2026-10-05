---
name: design-review
description: Reviews Figma frames along every Review Axis the team has set up, such as design system adherence and accessibility, and merges their Findings into one report. With no Review Profile, creates one with the designer first. Use when the user asks for a design review, or for several kinds of review of a Figma design at once, or asks which versions of the review skills are installed.
metadata:
  version: "0.1.0-alpha.1"
---

# Design review

Version 0.1.0-alpha.1 of the design review skills.

The Orchestrator: it runs the Review Skills a team's Review Profile covers, on one scope and from one scan, and merges their Findings into one report. With no Review Profile, it creates one with the designer first (First run). It judges nothing itself. Each Review Skill judges its own axis, and asks its own set-up questions, the Profile Finder finds the Review Profile, the two Design Scanner skills read the design, the Figma Writer saves a profile as a page, and the Report Writer writes and delivers the report.

## Required skills

When the user only asks for the skills' versions, go to Versions below. Otherwise this review MUST use four other skills: `design-review-profile` finds the Review Profile, `design-review-scanner` and `design-review-scanner-assets` read the design, and `design-review-report-writer` writes the report. Before anything else, check that all four are available to you. If any isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- More than one missing, naming each, such as: "This review can't run: the skills `design-review-scanner-assets` and `design-review-report-writer` aren't installed. Install them, then run the review again."

## 1. Find the Review Profile

The **runtime** is `figma-agent` inside Figma Design's agent, and `external-agent` anywhere else. In an external agent, the reviewed file's key comes from its link.

Use the skill `design-review-profile` to find the Review Profile, once for the whole run. Give it the reviewed file's key, the runtime, and the profile the user gave at run time, if any. It hands back one of three results:

- **found:** keep the whole result. Its `text` says which axes the profile covers, as Axes below describes, and every Review Skill in the run gets it.
- **unreadable:** the team has a profile this run can't see, so stop. Reply with the location, the reason, and that the review didn't run. Write no report.
- **none:** the team has no profile, so this is a first run. Go to First run, which says what comes before question 1.

The profile is found when the lookup has handed back `found`, or question 1 has been answered and the run has gone on or stopped.

## 2. Load the Review Skills

Take the axes from the user and the profile, never from the design: the axes the user names, such as "just accessibility", or else every axis the profile covers. For each of those the profile covers, you MUST use its Review Skill. Load it now, and note its Version line and three lines in its Run by another skill section: `Fact groups`, for the scan, `For the caller to ask`, for your questions, and `Set up`, for the sections it can write. You run it in step 4 or 5. In a first run, load every Review Skill in the Axes table that is installed.

A Review Skill that isn't installed or won't load is **not loaded**. Its axis is skipped (step 3), and the axis stays in the review: its Coverage entry names the skill's exact name. If none of these Review Skills loads, stop before asking anything. Reply with only: "This review can't run: the Review Skills `<name>`, `<name>` couldn't be loaded. Install them, or run each review in its own prompt, such as `/design-review-accessibility`." Write no report.

This step is done when the Review Skill of every axis that may run is loaded with its Version line and three lines noted, the others are marked not loaded, or the run has stopped.

## 3. Settle the run

Settle everything now, asking what's missing in one message. Nothing is asked once the review starts. The set-up questions of First run and Setting up an axis come in messages of their own, because they read the scan.

- **Axes:**
  - **all:** every axis the profile covers
  - **the axes the user names**
  - **the axes a first run set up,** which the user chose in question 2
  - **ask,** when the user names none: list every axis, those the profile covers ticked and the others marked "not set up". A covered axis whose Review Skill is not loaded stays ticked, marked "will be skipped: `<skill>` isn't installed"

  The **chosen axes** are the ones the user chose that the profile covers, and the ones it doesn't cover that get set up now. An axis the profile doesn't cover is **not set up**. Set up a chosen one whose Review Skill is loaded and has a `Set up` line (Setting up an axis), and leave out any other: say so before the review starts, and that it can run on its own with its Review Skill, such as `/design-review-library`.
- **Scope:** the node ids of the frames to review: the user's selection, a page's top-level frames, or the frames the user names or links to.
- **The research topic,** when research alignment is chosen, its Review Skill is loaded and the profile covers it. Take it only from the user. You may suggest topics from the file's page names.
- **What the profile leaves open:** whatever the chosen Review Skills' `For the caller to ask` lines name, each pre-filled with its default.
- **A pointer,** when question 1 sent you to a profile: ask whether to save a pointer to it (Saving a profile).
- **Run-time settings:** what the user asked for this run's report ("don't save" or "save to <location>") and its annotations ("annotate" or "don't annotate"), and anything meant for one review, such as a Reference Document location or a WCAG target.

For example: "I'll use the Review Profile "Checkout team profile" from this file's "Review Profile" page. Which reviews should I run? [x] Design system adherence [x] Accessibility [ ] Research alignment (not set up). And what should I review: your selection (Checkout, Payment), this page, or other frames?"

A chosen axis is **skipped**, with one Coverage entry that you keep for step 6, when:

- its Review Skill is not loaded: `{ "axis": "<axis>", "status": "skipped", "reasonCode": "skill-not-installed", "reason": "the skill <exact name> isn't installed" }`
- it is research alignment with no topic: `{ "axis": "research", "status": "skipped", "reasonCode": "no-topic", "reason": "no topic given" }`

The **runnable axes** are the chosen axes that aren't skipped. Go on by how many there are:

- **None:** stop. If a chosen axis's Review Skill is not loaded, reply as step 2 does, naming those skills. If a chosen axis was skipped for another reason, say which and why. If none was chosen, say which axes the profile covers, and that each review can run on its own with its Review Skill. Write no report.
- **One, with no axis skipped:** hand off to its Review Skill. You MUST use that skill in `full report` mode, handing over what its Run by another skill section lists, with the Design Facts only when First run or Setting up an axis scanned already, and your version warning as a note, if Versions below gives one. It scans, judges and delivers its own report, and the run is done when it has.
- **Otherwise,** one runnable axis with a skipped one, or two or more: go on to step 4.

The run is settled when the chosen axes, the scope and the runtime are known, every question has its answer or its default, every chosen axis that isn't set up is set up or left out, and research alignment has a topic or is skipped.

## 4. Scan once

Use the skills `design-review-scanner` and `design-review-scanner-assets`, each once for the whole run, so the design is read once. Each reads its own fact groups: `colourPairs`, `text`, `structure` and `annotations` from `design-review-scanner`, and `bindings` and `components` from `design-review-scanner-assets`. Give each the scope's node ids, the runtime, and the fact groups it reads among those the runnable Review Skills' `Fact groups` lines name, and give `design-review-scanner` whatever else those lines say to give a scanner, such as the `Annotation kits`. Skip a scanner when none of its groups is named. Join the two results for each node: `groups` and `unread` joined, and each group's field from the scanner that read it. Every Review Skill judges from these joined Design Facts. First run and Setting up an axis scan at this step's inputs as soon as the chosen axes are known, because a set-up mode reads the Design Facts, and add the `structure` group in a first run; step 4 then keeps that scan and skips itself. The scan is done when each scanner you asked has handed back the Design Facts for every node in the scope.

## 5. Run the Review Skills

Run each runnable Review Skill in `json only` mode, handing over what its Run by another skill section lists, from what steps 1 to 4 settled.

Where your runtime can run subagents, run each Review Skill in its own subagent, all at the same time, and wait for every one to hand back. Tell each: "You MUST use the skill `<Review Skill>` in json only mode, with the inputs below. Reply with only what it hands back, or with only the error if it can't finish." Otherwise run them yourself, one after another.

Each hands back its notes, if any, and a report JSON. That JSON may hold no Findings and one `skipped` Coverage entry for its axis, such as when a Reference Document can't be read. Keep it as it came.

A Review Skill **fails** when it ends without a report JSON: it errored, your runtime reports its subagent as timed out or stopped, or it replied with only a message. Keep the others running, and leave the failed skill's axis to its Coverage entry: you never run its review yourself. The axis is skipped, with the Coverage entry `{ "axis": "<axis>", "status": "skipped", "reasonCode": "skill-failed", "reason": "the skill <name> failed: <its error, or its reply>" }`, and a note: "<Review Skill's axis name> wasn't assessed. Run it on its own with `/<name>`."

This step is done when every runnable axis has handed back its report JSON or been skipped as failed.

## 6. Merge and report

Use the skill `design-review-report-writer` in `full report` mode, handing over the merged review:

- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the scan, and `settings`: every report's `run.settings` joined into one object, or null when each is null.
- `profile`: the found result's `profile`. For a profile created in a first run, the `profile` you built (First run, question 8).
- `references`: every report's references, each once.
- `findings`: every report's Findings, each as it came, keeping its axis and id. The Report Writer links those on different axes that share a Root Cause and a property.
- `coverage`: every report's Coverage entries, and the entry for each skipped axis, whether step 3 or step 5 skipped it.
- `notes`: every report's notes, and your own, such as an axis left out because it isn't set up, the note for a failed Review Skill, and the version warning, if Versions below gives one.
- `reportSettings`: the profile's Report settings section, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: "don't save" or "save to <location>" when the user said so, otherwise null.
- `annotateRequest`: "annotate" or "don't annotate" when the user said so, otherwise null.

Only this call delivers a report, even when every runnable axis was skipped as failed: its Coverage then says so. The review is done when the Report Writer has delivered it, with every chosen axis's Findings and Coverage in it, the skipped axes included.

## First run

With no Review Profile, you build one with the designer, then run the review against it. You ask seven questions, numbered 1 to 5, 7 and 8, one in each message, each pre-filled from the file where you can. A question is done when the user has answered it, and the next waits for that. Question 6, the research source, isn't asked in this release, because research alignment isn't available in it. Every question comes before the review runs. The Review Skills ask 4 and 5 in their `set up` mode, and you ask the rest.

**Two things come before question 1.** Take the scope from the user's request, as step 3 describes, and ask for it when the request names no frames: that isn't one of the seven. Then load the Review Skills as step 2 describes, every one in the Axes table that is installed, so that a run with none of them stops before it asks anything.

1. **Set one up, or point to a profile.** Say where the lookup looked (`searched`), that `/design-review` runs against a Review Profile, and ask: set one up with you (about seven questions, most already filled in from this file), or use a profile the user has? For example: "I couldn't find a Review Profile: none was given, this file has no "Review Profile" page, and AGENTS.md has no pointer to one. A full review runs against one. Shall I set one up with you, or is there a profile I should use?"
   - **A profile to use:** run the Profile Finder with it as the profile given at run time, as step 1 describes. `found` goes on to step 2 as a found profile, and step 3 also asks whether to save a pointer to it (Saving a profile). `unreadable` stops the run as step 1 does, and adds that you won't create another profile, because two would then stand for the same work.
   - **Set one up:** go on to question 2.
   - **Neither:** stop. Reply that there is nothing to judge a full review against, that each review can run on its own without a profile, such as `/design-review-accessibility`, and that it asks what to check against each time. Write no report.
2. **Which reviews.** List each axis whose Review Skill is loaded and has a `Set up` line, all ticked. List research alignment as "not available in this release", and any other axis whose skill isn't loaded as "not installed: install `<skill>` to set it up". The axes left ticked are the run's chosen axes, and the profile's. When no axis can be set up, stop as step 2 does. Then scan (step 4).
3. **Name and owner.** Ask what the profile is called and who owns it, a person or a team its readers can ask. For example: "What should the profile be called, and who owns it? Something like "Checkout team profile", owned by the Checkout design team." Take no owner as `not named`.
4. **Design System Layers,** when design system adherence is chosen. Use the skill `design-review-library` in `set up` mode. Give it the scope, the runtime and the Design Facts.
5. **Accessibility target,** when accessibility is chosen. Use the skill `design-review-accessibility` in `set up` mode. Give it the scope and the runtime.
7. **Product context.** Ask where the product runs, pre-filled with `Target platforms: Web` and, as `Supported viewport widths`, the distinct widths of the scope's top-level frames (the structure facts' `frame.width`), smallest first, such as `360px, 1440px`. For example: "From your frames, I'd say this is a web product at 360px and 1440px wide. Is that where it runs?"
8. **Review and save.** Write the profile as Profile layout describes, and show all of it in the chat. Ask whether to save it, and where (Saving a profile). On a change to an answer, go back to the question that asked it. Saving ends the first run. When the user won't save it, or no place takes the save, stop as question 1 does when the user wants neither, saying what happened and, for a failed save, that the profile in the chat can be saved by hand as a page named "Review Profile".

A Review Skill's `set up` mode hands back its section and notes, or says it can't set the axis up, such as design system adherence with no library in the design. Leave that axis out of the profile, say why, and go on with the others. When none is left, stop.

The first run is done when the profile is saved. Go on to step 3 with it as the found result: `{ "result": "found", "from": "run time", "pointers": [], "profile": { "name", "location", "lastUpdated" }, "text": "<the profile's text>" }`, where `location` is where you saved it and `lastUpdated` is today's date. The chosen axes are the profile's axes, and the user has agreed to its settings, so no Review Skill asks about them again. Step 3 then asks only for what the user hasn't said, such as the run-time settings.

## Setting up an axis

A found profile that doesn't cover an axis the user chose is set up in step 3, with the same set-up mode a first run uses. Scan as step 4 describes, if you haven't. Use the Review Skill in `set up` mode, then ask the user: "Add this <section name> section to the "<name>" profile, or use it for this run only?"

- **Add:** save the profile with the section in its place (Saving a profile), and set its `Last updated` to today's date. When Saving a profile can't write the change, show the section in the chat and name the profile's owner, from its Identity section, as the person to add it. The review still uses the section.
- **This run only:** change nothing in the profile, and add a note: "The <axis> settings come from set-up answers for this run only, not from the profile."

Either way, the Review Skills receive the profile's text with the section in it. The set-up is done when the section is added or shown, or the user chose this run only.

## Saving a profile

Where a profile goes depends on your runtime. Inside Figma Design's agent, the only place is the page. In an external agent, offer these, and use the one the user picks:

- **A "Review Profile" page in the reviewed file,** where the lookup finds it with no pointer. You MUST use the skill `design-review-figma-writer` to write it, as its Writing a Review Profile page describes. Hand it the reviewed file's key, the runtime, the profile's lines as `TEXT`, and `BEFORE` as `null`. Without that skill, the page can't be used: "the skill `design-review-figma-writer` isn't installed".
- **`review-profile.md` in the user's project,** in an external agent. Create it in the working directory, and add a pointer line, `Review Profile: ./review-profile.md`, to `AGENTS.md` (or `CLAUDE.md`, whichever the project has, and `AGENTS.md` when it has neither).
- **A file in a GitHub repo,** in an external agent: ask for a link to the repo or to a folder in it. Commit the profile as `review-profile.md`, as the Report Writer's Locations describes for a report, and add a pointer line with the file's link to the project's `AGENTS.md`.

The profile's `location` is where it was saved: the page's link, the file's path, or the file's link.

**Changing a found profile** writes to the location the Profile Finder read it from, `profile.location`. A page: the Figma Writer, with `BEFORE` the found `text` as lines, in the file the page is in (inside Figma Design's agent, only the reviewed file). A local file: edit it, in an external agent. A GitHub file: commit the change. A profile given at run time as text can't be written. When the write fails or isn't possible, say why and name the profile's owner.

**A pointer** is one line, `Review Profile: <location>`. Offer to save one when the user pointed to a profile in question 1: in Figma Design's agent, as the "Review Profile" page, with the pointer line as `TEXT`; in an external agent, as the page, or as a line in `AGENTS.md`. Ask it with step 3's other questions. On no, save nothing.

A save that fails because of edit access or a tool is not used: say why, and offer the next place for a new profile; for a change to a found profile, say why and name the profile's owner. A save is done when the profile is written and the `location` is known, or every place has failed.

## Profile layout

You own the profile's layout, so every profile reads the same to the skills and to people. The Profile Finder and the Review Skills read it by its headings and its `Key: value` lines. Each `##` section opens with one plain sentence for the people who maintain it, then its settings, one `- Key: value` per line. Write the sections in this order, leaving out any that doesn't apply:

| Section | Written by | Sentence under the heading |
|---|---|---|
| `Identity` | you: `Name`, `Owner`, `Last updated` (today's date) | What this profile is called and who maintains it. |
| `Design System Layers` | `design-review-library` | its own |
| `Accessibility` | `design-review-accessibility` | its own |
| `Product context` | you: `Target platforms`, `Supported viewport widths` | Where the product runs, used by checks that depend on screen size. |
| `Report settings` | you: `Report location: none (a report page in the Figma file)`, `Annotate layers: off` | Where reports are saved, and whether Findings are marked on layers. |
| `Severity Overrides` | the team, by hand: not asked, and not written on a first run. A line reads `<type of rule>: <Severity>`, with `, core task: <task>` when it sets critical | The starting Severity this team sets for a type of rule, in place of the review's default. |

The text opens with `# Review Profile: <name>`, a blank line, `Profile version: 0.1`, and a blank line. Put a section the profile lacks before the first section that follows it in this order, or last. Put each Review Skill's section in as it handed it back, without editing its settings.

## Versions

Every skill in the set opens with a Version line: "Version <version> of the design review skills." The set shares one version.

- **Warn on a mismatch.** Note the Version line of each skill you load for a run: the Profile Finder in step 1, each Review Skill in step 2, each scanner in step 4, the Report Writer in step 6 and the Figma Writer when you save a profile. When any differs from this skill's, hand over one note: "Version warning: `<skill>` is at <version> and `<skill>` at <version>, but `design-review` is at <this version>. Install one version of every skill in the set." naming each such skill. With none, no note.
- **Report the versions,** when the user asks for them. Load every skill in the set that is installed, and read only its Version line: do only that. Reply with one line per skill, `<skill>: <version>`, or `<skill>: not installed`, then, judging only the installed skills, "All installed skills are at <version>." when they share one version, or "The installed skills are at different versions: install one version of every skill in the set." when they don't. A skill that isn't installed doesn't count as a different version. The set is `design-review`, the Review Skills in the Axes table, `design-review-profile`, `design-review-scanner`, `design-review-scanner-assets`, `design-review-report-writer` and `design-review-figma-writer`.

## Axes

| Axis | Review Skill | The profile covers it when it has |
|---|---|---|
| Design system adherence | `design-review-library` | a Design System Layers section |
| Accessibility | `design-review-accessibility` | always: without an Accessibility section, the skill uses its default target |
| Research alignment | `design-review-research` | a Research Sources section |
