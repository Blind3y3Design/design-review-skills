---
name: design-review-report-writer
description: Writes and delivers the report for the other design review skills, which hand it their Findings and Coverage. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Report Writer

Version 0.1.0-dev of the design review skills.

Turns a review's Findings and Coverage into its report: Markdown for people, then one JSON block for tools. This skill owns the report format, the Severity and Certainty scales and the Finding ids, and it delivers the report. It judges nothing. Every Finding, Severity, Certainty and Coverage status is written as the calling skill gave it.

## Inputs

The calling skill hands over:

- `mode`: `full report`, the default, or `json only`, for a review whose JSON another skill merges into its own full report.
- `run`: `date`, `scope` (`fileKey`, and `nodes` as `{ id, name }`), `runtime`, `setVersion`, `factsVersion`, `factGroups`, and `settings` (the settings this run used that no Review Profile gave, or null).
- `profile`: `{ name, location, lastUpdated }` of the Review Profile the run used, or null.
- `references[]`: `{ name, version, location }` for each Reference Document used.
- `findings[]`: each Finding's fields from the table below, with a `rootCause` in place of `id`, and each location without its `url`. A Finding merged from a `json only` report comes with its `id` and urls instead: keep them.
- `coverage[]`: the Coverage entries.
- `notes[]`, optional: sentences on how the run's settings were settled, such as a Severity Override that wasn't applied. They go in the Markdown header only.
- `reportSettings`: the Report settings section of the Review Profile the run used, as `{ "<key>": "<value>" }`, or null.
- `saveRequest`: what the user asked for this run's report, `"don't save"` or `"save to <location>"`, or null.

## Steps

1. **Check the hand-over.** Every Finding has each required field, and every axis, Severity, Certainty and Coverage status is one from the lists below. If anything is missing or out of range, write no report. Tell the calling skill which Finding or entry and which field, so it can hand over again.
2. **Give each Finding its id** from its `rootCause`, as Finding ids below describes, and each `node` location its `url`. The `rootCause` itself stays out of the report.
3. **Link Findings across axes.** Findings on different axes that share a Root Cause stay separate, and each lists the ids of the others in its `relatedFindings`.
4. **Write the report JSON** as described below. In `json only` mode, stop here, and hand back only the `notes`, if any, as a list headed "Notes:", then the report JSON in one fenced `json` block.
5. **Write the Markdown,** in the layout below, ending with the JSON in one fenced `json` block.
6. **Deliver** the report, as Delivery below describes: save it, then show the whole report in the chat.

A `json only` report is done when its JSON holds every Finding and Coverage entry handed over, and it's been handed back. A full report is done when the chat shows the Markdown and its JSON block, every Finding and Coverage entry handed over is in both, and the report is saved where Delivery says or the Saved line says why it isn't.

## Axes

| `axis` | Short name | Name in the report |
|---|---|---|
| `design-system` | `ds` | Design system adherence |
| `accessibility` | `a11y` | Accessibility |
| `research` | `res` | Research alignment |

## Severity

| Level | Meaning |
|---|---|
| critical | Stops some users completing a core task, or breaks a legal or contractual requirement. Always needs a reason tied to a core task |
| serious | A significant barrier, or a clear breach of a standard the team has committed to |
| moderate | A breach that causes friction or inconsistency but blocks nothing |
| minor | A small deviation with little effect on users |
| advisory | Breaks no standard: a good-practice suggestion, with no `standard` |

A Review Skill may move a Finding one level from its default Severity, and says why in the evidence. A Review Profile's Severity Overrides may set a different starting Severity, within their limits: none lowers a Locked Rule breach below serious, or sets critical without a core task.

## Certainty

How sure the Review Skill is of a Finding, independent of its Severity. A serious problem the skill isn't sure of stays serious, with `needs-review`.

- `confirmed`: read or measured exactly from the design.
- `likely`: the evidence points to it, but part of it was estimated, such as a contrast ratio involving opacity.
- `needs-review`: the skill couldn't read or settle what it needed, so a person checks it.

## Finding ids

An id is a fingerprint of the Finding's axis, its standard's `ref` and its Root Cause, joined by `/`: `<axis>/<ref>/<rootCause>`. An advisory Finding uses `advisory` in place of the ref. For example, `accessibility/1.4.3/node:5:5`. The calling skill gives the `rootCause`, which is one of:

- `node:<node id>` for a single layer
- `component:<key>`, `style:<key>` or `variable:<key>` for a library asset

Build the id from exactly these parts, so the same Root Cause always gives the same id and two reports can be compared. A Root Cause holds no `/`, so it's always the id's last part: two Findings share a Root Cause when their ids end in the same one.

The Markdown shows a **short id**: the axis's short name, the ref, and the Root Cause without its kind, cut to its first 8 characters. For example, `a11y/1.4.3/5:5`.

## Report JSON

`schemaVersion` 0.2. One object with these fields, in this order:

| Field | Contents |
|---|---|
| `schemaVersion` | `"0.2"` |
| `run` | As handed over: `date`, `scope`, `runtime`, `setVersion`, `factsVersion`, `factGroups`, `settings` |
| `profile` | As handed over, or null |
| `references` | As handed over |
| `findings` | The Findings, fields in the order below |
| `coverage` | The Coverage entries |

**Finding fields**

| Field | Required | Contents |
|---|---|---|
| `id` | yes | The fingerprint above |
| `axis` | yes | An `axis` from the Axes table |
| `title` | yes | One line |
| `severity` | yes | A Severity level |
| `certainty` | yes | A Certainty level |
| `locations` | yes | Each has a `kind`. `node`: `fileKey`, `nodeId`, `layerPath`, `url`. `component` or `style`: `key`, `name`, `library`, `url`. `variable`: `collection`, `name`, `library`. A Finding blamed on the design system lists the library asset first |
| `standard` | yes, except advisory | `{ source, ref, url }`, such as `{ "source": "WCAG 2.2", "ref": "1.4.3", "url": "https://www.w3.org/TR/WCAG22/#contrast-minimum" }`. `url` is left out when the standard has no link, such as a requirement given at run time |
| `evidence` | yes | What was read or measured, with the measurement's inputs and result |
| `fix` | no | What to change |
| `supportingEvidence` | no | Other sources for the same problem |
| `relatedFindings` | no | Ids of Findings on other axes with the same Root Cause |

Leave out an optional field that has nothing in it.

A `node` location's `url` is `https://www.figma.com/design/<fileKey>/?node-id=<node id>`, with each `:` in the node id written as `-` and each `;` as `%3B`. With no file key, leave `url` out.

**Coverage entries**

- For one standard: `{ axis, ref, status }`, adding `note` when there's a reason to give. The status is one of `judged`, `not-applicable`, `needs-annotation`, `needs-state`, `needs-section`, `needs-code`, `not-readable` or `stale`.
- For a whole axis that didn't run: `{ axis, status: "skipped", reason }`.

## Markdown layout

In this order. Leave out a section that has nothing in it, except Coverage.

1. **Title:** `# Design review: <axes>`, with the name in the report of each axis reviewed.
2. **Header,** one line each:
   - Scope: each node's name and id, and the file's link (`https://www.figma.com/design/<fileKey>/`)
   - Date
   - Profile: its name, location and last updated date, or "None". Then, when `settings` isn't null, "Settings for this run:" and each of its settings as `key: value`
   - Notes: each of the `notes`, when there are any
   - Reference Documents: each name, version and location
   - Skills: "design review skills `<setVersion>`, Design Facts `<factsVersion>` (`<factGroups>`), `<runtime>`"
   - The Saved line, under Delivery
3. **Fixes by Root Cause:** one numbered item per Root Cause across all axes: its fix and the short ids of the Findings it clears. When those Findings are on several axes, give each axis's fix. Order them by how many Findings each clears, most first, then by their highest Severity.
4. **Findings, one `##` section per axis,** headed with the axis's name in the report. List its Findings from the most severe down, `confirmed` before `likely` before `needs-review`. Each is a `###` heading with its short id and title, then:
   - Severity and Certainty
   - Where: each location as a link, `[<layerPath>](<url>)`
   - Standard: source, ref and link
   - Evidence
   - Fix
   With no Findings, write "No Findings." under the axis heading.
5. **Coverage:** a `## Coverage` section with a `###` heading for each axis, then its entries, where entries with the same status and the same note share one line: `<status>: <ref>, <ref>, …`, then the note. A skipped axis gets one line with its reason.
6. **The design-stage line,** after the Coverage section, in every report whose axes include accessibility, whatever its Findings or Coverage: "This is a design-stage review, not a WCAG conformance evaluation. Criteria marked needs-code or needs-annotation in Coverage were not assessed."
7. **The report JSON,** in one fenced `json` block, pretty-printed with 2-space indentation.

## Delivery

The whole report always appears in the chat. It's also saved to the first of these destinations that applies:

1. **This run's `saveRequest`.** With "don't save", save nothing. With "save to <location>", that location.
2. **The profile's report location:** `Report location` in `reportSettings`, unless it begins with `none`.
3. **The report page** in the reviewed file.

When a destination can't be used, try the next one, keeping the reason. When the report page can't be used either, the report is in the chat only.

### Locations

- **A local folder,** in an external agent: a path, relative to your working directory unless it's absolute. Create the folder if it's missing. Save the whole report, Markdown and JSON block, as `design-review-<date>-<scope>.md`, where `<scope>` is the first scope node's name in lower case, with each run of characters other than letters and digits written as `-`. If a file of that name exists, add `-2`, `-3` and so on before `.md`.
- **A GitHub folder,** in an external agent: a link to a repo, such as `https://github.com/<owner>/<repo>`, or to a folder in one, such as `https://github.com/<owner>/<repo>/tree/<branch>/<folder>`. Commit the same file to that folder on that branch, or to the repo's root on its default branch, with the GitHub tool you have, such as the `gh` CLI.
- **The report page:** the page named "Design review" in the reviewed file, holding one frame per run, newest first. It needs edit access to the file. You MUST use the skill `design-review-scanner` to write the frame. Hand it the file key, the runtime, and:
  - the frame's name: `<date> · <scope>`, with each scope node's name, separated by `, `
  - the Markdown report without its JSON block, one string per line
  - the report JSON

  It hands back the frame's id, and whether the JSON is in the frame's shared plugin data. When it isn't, the frame says why, and the JSON is in the chat only.

"Save to" also takes "the report page" or "this file". Inside Figma Design's agent, only the report page can be used.

A destination can't be used when:

- it's a local folder or a GitHub folder inside Figma Design's agent: "Figma Design's agent can't save to a folder or to GitHub yet"
- it's none of the locations above: "<location> isn't a local folder, a GitHub link or the report page"
- saving there fails, such as a folder that can't be written, no GitHub tool, or no edit access to the file: the error, as the tool or the scanner gives it

### The Saved line

The header's Saved line says where the report went. Write it for the destination you're saving to, so the saved copy carries it, and correct it in the chat if that save fails.

- **Saved:** "Saved: <the file's path or link>." For the report page, "Saved: frame "<name>" on the "Design review" page, <the frame's link>.", where the link is built as for a `node` location. The copy in the frame leaves out the link. When the JSON isn't in the frame, the chat's line adds "The report JSON is too large for a frame, so it's only in this chat.", or with the scanner's `jsonError`, "The report JSON couldn't be stored in the frame (<jsonError>), so it's only in this chat."
- **After a destination that couldn't be used,** add "<destination> wasn't used: <reason>." for each one.
- **Not saved, with "don't save":** "Not saved: you asked not to save this run."
- **Not saved, when no destination could be used:** "Not saved: <each reason>. The report is in this chat only."

## Report settings

A Review Profile's Report settings section, which the calling skill hands over as `reportSettings`, says where the team's reports go. One `Key: value` per line:

| Setting | Default |
|---|---|
| `Report location`: a local folder, a GitHub repo or folder link, or `none` | `none`: the report page in the reviewed file |
| `Annotate layers`: `on` or `off`, for marking Findings on their layers, which a later version of the skills adds | `off` |
