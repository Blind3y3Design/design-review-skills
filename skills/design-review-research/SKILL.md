---
name: design-review-research
description: Research alignment review of Figma frames. Judges a design on one topic against the team's Research Insights, read from the connected research tools, and reports Findings and Coverage. Use when the user asks for a research alignment review of a Figma design, or to check a design against user research.
metadata:
  version: "0.1.0-alpha.4" # x-release-please-version
---

# Research alignment review

Version 0.1.0-alpha.4 of the design review skills. <!-- x-release-please-version -->

A review of Figma frames along one Review Axis, `research`, which reports call research alignment. This skill holds only the procedure. Everything it judges by comes from the Research Insights it reads, on one topic, from the team's research tools: an **Insight** is the standard here, as a criterion is for accessibility. Judge the design from those Insights and the Design Facts alone, never from what you know of the topic or of users.

## Required skills

This review MUST use three other skills: `design-review-profile` finds the Review Profile, `design-review-scanner` reads the design, and `design-review-report-writer` writes the report. Before anything else, check that all three are available to you. If any isn't, reply with only the line that fits, and stop:

- One missing: "This review can't run: the skill `<name>` isn't installed. Install it, then run the review again."
- More than one missing, naming each, such as: "This review can't run: the skills `design-review-scanner` and `design-review-report-writer` aren't installed. Install them, then run the review again."

These three skills are the review's only way to find the profile, read the design and write a report. The research tool itself is not a skill: it is whatever research server is connected, and Fetch the Insights finds it.

## 1. Settle the inputs

Settle everything before fetching starts, asking for what's missing in as few messages as you can. Nothing is asked once fetching begins. When another skill runs this review, settle the inputs from its hand-over, as Run by another skill describes.

- **Scope:** the node ids of the frames to review, from the user's selection, the frames they name, or the `node-id` in a Figma link. For a page, use its top-level frames. In an external agent, the file key comes from the file's link.
- **Runtime:** `figma-agent` inside Figma Design's agent, `external-agent` anywhere else.
- **Topic:** what the review is about, in the user's own words. The topic comes only from the user: never infer it from the design, and never read the frames as a topic on your own. You may suggest topics from the scope's page and layer names, but use only a topic the user gives. With no topic, ask for one, with any suggestions; a topic the user declines or leaves blank skips the axis (No research). The topic is settled before fetching, because it decides which Insights are read.
- **Given at run time,** when the user names them: a Review Profile (its text, a local file, or a link to a Figma file or a GitHub file), a research source, `Research current for`, the topic, where to save this run's report ("don't save", or "save to <location>"), and whether to mark its Findings on their layers ("annotate", or "don't annotate"). What's given at run time takes the place of the profile's for this run.
- **What to check against:** find the Review Profile, then settle the Research Sources from it or by asking, as Review Profile below describes.

The inputs are settled when the scope, runtime and topic are known, and the sources are settled, or the run has stopped.

## 2. Fetch the Insights

This is its own step, joined to judging (step 4) only by its hand-off: it reads research and judges nothing. Its sources are the profile's Research Sources section lines, narrowed by the topic.

1. **Resolve the sources.** Each `Source:` line names a research tool and a project, folder or Doc. Take the lines given at run time in place of the section's. With no source at all, skip the axis (No research).
2. **Find the connected tool.** Look at the tools available to you for one that reads the source's tool, such as Dovetail. Tool names change, so pick by what a tool reads, not by an exact name: in Figma Design's agent it is the Dovetail connector, and in an external agent it is Dovetail's MCP server, or whichever research MCP server is connected. Reading is enough. The portable core every Dovetail surface shares is listing projects, listing data and Docs, and reading one Doc's content as markdown. With no connected tool, or one that can't be reached or authorised, skip the axis (No research).
3. **Narrow to the source.** Resolve the project, folder or Doc the line names to its id, and read only inside it. Never search a whole workspace.
4. **Find the Insights, most relevant to the topic first.** Where the tool has search, run keyword queries built from the topic's words, scoped by the source's id, and take the Insights they return. Otherwise, list the Docs in the source and keep those whose title or statement matches the topic. A tool with neither search nor a listing of Docs works only with a source that names one Doc outright.
5. **Read each Insight's content as markdown.** A Dovetail Doc is the Insight; its highlights are the quotes that support it. Build each Insight as `{ title, id, url, date, statement, highlights[] }`, where `statement` is the Doc's synthesised statement, `date` is the Doc's date, and each highlight is `{ text, url, date }`. Read at most about ten Insights, the most relevant first; when more matched, keep the ten and note it for the report: "More Insights matched the topic than were read: about ten, the most relevant first."
6. **Drop identifying details.** No participant's name or contact details go into an Insight, a highlight or a statement: read a highlight's words without its speaker label, and leave out any name or contact detail. This holds for everything handed on and everything in the report.

Fetching is done when the Insight list holds every matching Insight within the budget, or the axis has been skipped.

## 3. Scan

Use the skill `design-review-scanner`, which reads every fact group through its scanning skills and joins the results per node. Ask it for the fact groups that show what the design does: `text` and `structure`. Give it the scope's node ids and the runtime. Judge from the Design Facts it returns, alongside the Insight list.

When another skill handed over Design Facts, the design is already scanned: judge from those, as Run by another skill describes.

## 4. Judge

Judge each Insight against the Design Facts, one verdict each. Every Insight fetched gets exactly one Coverage entry, `{ "axis": "research", "ref": "<Insight id>", "status": "<status>" }`, where the verdict sets the status:

| Verdict | When | Result |
|---|---|---|
| aligned | The design does what the Insight says users need | Coverage `judged`; the Insight is listed under "Research this design follows" |
| contradicts | The design does what the Insight reports failing users | A Finding; Coverage `judged` |
| not addressed | The Insight is about something the frames show, and the design does nothing about it | A Finding at `minor`; Coverage `judged` |
| not applicable | The Insight is about a part of the product this scope doesn't show | Coverage `not-applicable`, its note saying so |

Only an Insight is a standard. A highlight is never the thing judged: it can only support a Finding. An Insight older than `Research current for`, when the profile sets it, gets the Coverage entry `{ "axis": "research", "ref": "<Insight id>", "status": "stale" }` and no verdict: it raises no Finding and isn't listed under "Research this design follows". Without the setting, every Insight is judged, and its date is written into the Finding's evidence or the follows list.

Write each Finding's fields this way:

- **Title:** one line naming the Insight and what the design does.
- **Severity:** `moderate` for a `contradicts` verdict, or `serious` when the Insight reports users failing at or abandoning a task; `minor` for `not addressed`, moved one level either way with the reason in the evidence.
- **Certainty:** `confirmed` only when the Insight states a concrete, observable requirement and the design clearly fails it; `likely` by default; `needs-review` when the Insight's relevance depends on something the frames don't show.
- **Root Cause:** `node:<id>` of the frame or layer the Finding is about.
- **Evidence:** the Insight's key sentence, quoted, its date, and what the design does in the frames.
- **Standard:** `{ "source": "<the research tool, such as Dovetail>", "ref": "<Insight title> (<Insight id>)", "url": "<the Insight's url>" }`.
- **Supporting Evidence:** up to three of the Insight's highlights, each an excerpt, a link and its date.
- **Locations:** `{ "kind": "node", "fileKey", "nodeId", "layerPath" }` for each frame or layer the Finding is about.

No participant name or contact detail goes into a Finding, a highlight, a Coverage note or a title.

**Nothing relevant:** when no Insight matches the topic, raise no Finding, whatever the design seems to do, and give each source you searched one Coverage entry, `{ "axis": "research", "ref": "<the source as written>", "status": "judged", "note": "no relevant research found for <topic>" }`, so the report says what was searched and found nothing.

Judging is done when every Insight that was fetched has one Coverage entry, `stale` or the verdict's status, and every `contradicts` and `not addressed` Insight has a Finding.

## 5. Report

Use the skill `design-review-report-writer`, handing over:

- `mode`: `json only` when the skill running this review asked for it, otherwise `full report`.
- `run`: today's `date`, the `scope` (`fileKey`, and `nodes` as `{ id, name }`), the `runtime`, `setVersion` from this skill's Version line, `factsVersion` and `factGroups` from the Design Facts, and `settings`: `{ "research": { "from": "profile", "run time" or "asked", "topic": "<the topic>", "sources": ["<source>", …], "currentFor": "<n> months" or null } }`, where `from` says where the sources came from, as the other Review Skills write it.
- `profile`: the `profile` `design-review-profile` handed back, when you used its section, otherwise null.
- `references`: an empty list: an Insight is cited in a Finding's `standard`, not as a Reference Document.
- `findings`, each with its `rootCause`, and `coverage`.
- `researchFollows`: each `aligned` Insight, as `{ id, title, url, date }`, in Coverage order. The Report Writer lists them under "Research this design follows".
- `notes`: the notes kept while settling what to check against, if any, the note that more Insights matched than were read, and any the skill running this review handed over.
- `reportSettings`: the profile's Report settings you noted, as `{ "<key>": "<value>" }`, or null.
- `saveRequest` and `annotateRequest`: as the user said, otherwise null.

The review is done when the Report Writer has delivered the report. In `json only` mode, it's done when you've handed the Report Writer's reply, its notes and JSON block, back to the skill that ran this review.

## No research

The axis is skipped, and never half-run, when it can't run. Hand the Report Writer no Findings and one Coverage entry, `{ "axis": "research", "status": "skipped", "reasonCode": "<code>", "reason": "<sentence>" }`, then go to step 5:

| Why | `reasonCode` | `reason` |
|---|---|---|
| No topic was given, and the user declined one | `no-topic` | "no research topic was given" |
| The profile has no Research Sources section and no source was given at run time | `no-sources` | "no research source: the Review Profile has no Research Sources section" |
| No research tool is connected, or the source couldn't be reached or read | `source-unreachable` | "no research tool, or the source couldn't be read: <the source>: <the error>" |

A source that returns no matching Insight isn't skipped: step 4's Nothing relevant covers that, so the report still says what was searched.

**Only read Insights are sources.** Every research verdict, Finding and follows entry cites an Insight from step 2's list, by its id. When no Insight was read, the axis's whole story is its Coverage entry, and the report carries nothing else about users: what you know of the topic or of users is never a standard here.

## Run by another skill

Another skill, such as `design-review`, can run this review as one part of a larger one. It loads this skill first, for three lines:

- **Fact groups:** `text`, `structure`: the groups that show what the design does. The caller scans for them once, for every review in the run.
- **For the caller to ask:** the topic. This review is about one topic, which only the user can give, so the caller asks for it before the run starts.
- **Set up:** `Research Sources`: the section this skill writes in `set up` mode (Set up mode).

Then it settles the run, asks the user everything, and hands over:

- the scope, the runtime, the topic, and the `mode` for step 5
- the Review Profile it found, as `design-review-profile`'s `found` result
- the Design Facts, when it has scanned
- anything the user gave at run time for this review, such as a research source or `Research current for`
- notes for the report, if any, such as a version warning

The user has been asked everything already, so ask nothing. With no topic, skip the axis as No research describes, `reasonCode` `no-topic`. When a fact group you need is neither read in the handed-over facts nor in their `unread`, scan for that group yourself, as step 3 describes.

## Set up mode

The Orchestrator uses this skill in `set up` mode, in a first run or to add this axis to a profile, to settle the **Research Sources** section. Judge nothing, fetch nothing and write no report. Ask the one question below, and hand back the section.

1. **Ask for the source,** which only the team knows: the research tool and the project, folder or Doc to read Insights from, with any tags. For example: "Where does your research live? Name the research tool and the project, folder or Doc to read, such as 'Dovetail, project "Checkout research"', and any tags to narrow it. The topic is still asked at each review."
2. **Ask how current** research must be, pre-filled with a default: "Ignore Insights older than a set window? 12 months unless you name another." Take the window, or none.
3. **Hand back** the section, in this format:

   ```markdown
   ## Research Sources

   Where research alignment finds Research Insights. The topic is asked at each review.

   - Source: Dovetail, project "Checkout research"
   - Research current for: 12 months
   ```

Set up is done when the user has given a source and a currency window, and you've handed the section back.

## Review Profile

A team's Review Profile names the standards its reviews are judged against. This skill uses only the profile's **Research Sources** section, and hands its **Report settings** section to the Report Writer, which saves the report. It never creates or changes a profile, nor offers to: in `set up` mode it hands a section to the Orchestrator, which writes it.

### Finding the profile

When another skill hands over the profile it found, use that result. Otherwise use the skill `design-review-profile` to find the Review Profile. Give it the reviewed file's key, the runtime, and the profile given at run time, if any. It hands back one of three results:

- **found:** the profile's `text`, where the lookup found it (`from`), and the `profile` to name in the report.
- **none:** where it looked (`searched`).
- **unreadable:** a `location` and a `reason`. The team has a profile that this run can't see, so stop: reply with the location, the reason, and that the review didn't run. Write no report.

### Research Sources

This skill's section. It names where research alignment finds Insights, with one line per source:

```markdown
## Research Sources

Where research alignment finds Research Insights. The topic is asked at each review.

- Source: Dovetail, project "Checkout research"
- Research current for: 12 months
```

- `Source`: one line per source, `Source: <tool>, <project, folder or Doc> (<link or id>)`, with `tags: <tag>, <tag>` when the team uses tags to narrow it. The tool is the research tool to read, such as Dovetail; the project, folder or Doc is what to read from, by name, link or id; the tags are the tool's, and narrow what a search returns.
- `Research current for`: how old an Insight may be, such as `12 months`. An Insight older than it is `stale`. Optional, and with none, no Insight is stale.

### What to check against

Settle the sources by what the lookup found:

- **A profile given at run time (`from` is `run time`), or handed over by another skill, with a Research Sources section:** use the section without asking. Giving the profile is the user's agreement.
- **A profile found on the page or through a pointer in a project file, with the section:** ask before using it, with any other question still open. For example: "I found the Review Profile "<name>" on the "Review Profile" page in this file. Use its Research Sources for this review? It reads Dovetail's project "Checkout research", with Insights no older than 12 months, and the Severity Override "Research contradictions: serious". I'll use only that and where it saves reports, and I won't change it." Name where it saves reports, and whether it annotates layers, from its Report settings, if it has them. On yes, use the section. On no, go on as below.
- **No profile, no section, or the user said no:** ask for the source, pre-filled from what the user said at run time, using Set up mode's first question, and for the currency window. Say why you're asking, from the lookup's `searched` when there's no profile. For a profile without the section, keep a note for the report: "The Review Profile "<name>" has no Research Sources section, so this run used the source below."

From a profile whose section you use, also note its `profile` and its Severity Overrides about research. From any profile the lookup found, unless the user said no to it, note its Report settings.

### Severity Overrides

A profile's **Severity Overrides** section sets the starting Severity for a type of rule, one `<type of rule>: <Severity>` per line. Apply the lines about research: a line's type of rule is `Research` for every Finding, or the verdict it names, such as `Research contradictions` or `Research not addressed`, matched on the whole value, ignoring case. When several match a Finding, the verdict wins over `Research`; when two lines name one rule, the later one wins. Lines about other axes are for other skills.

- **Critical needs a core task.** A line that sets critical names the core task it's tied to, such as `Research contradictions: critical, core task: paying for an order`, and the evidence of each Finding it changes gives that task. Refuse a line that names none: treat it as absent, so a less specific line or the default Severity applies, and keep a note for the report: "The Severity Override "<line>" wasn't applied: it sets critical without naming a core task."
- **Say so in the evidence.** When an override changes a Finding's Severity, its evidence says so, such as "Severity raised from moderate to serious by the Review Profile's Severity Override "Research contradictions: serious"."
