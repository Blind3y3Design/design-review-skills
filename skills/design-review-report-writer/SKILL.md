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

- `run`: `date`, `scope` (`fileKey`, and `nodes` as `{ id, name }`), `runtime`, `setVersion`, `factsVersion`, `factGroups`, and `settings` (the settings used for this run when no Review Profile gave them, or null).
- `profile`: `{ name, location, lastUpdated }`, or null.
- `references[]`: `{ name, version, location }` for each Reference Document used.
- `findings[]`: each Finding's fields from the table below, with a `rootCause` in place of `id`, and each location without its `url`.
- `coverage[]`: the Coverage entries.

## Steps

1. **Check the hand-over.** Every Finding has each required field, and every axis, Severity, Certainty and Coverage status is one from the lists below. If anything is missing or out of range, write no report. Tell the calling skill which Finding or entry and which field, so it can hand over again.
2. **Give each Finding its id** from its `rootCause`, as Finding ids below describes, and each `node` location its `url`. The `rootCause` itself stays out of the report.
3. **Write the report JSON** as described below.
4. **Write the Markdown,** in the layout below, ending with the JSON in one fenced `json` block.
5. **Deliver.** Show the whole report in the chat. This version saves reports nowhere else, so the header's Saved line says "Not saved: this version shows reports in the chat only."

The report is done when the chat shows the Markdown and its JSON block, and every Finding and Coverage entry handed over is in both.

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

A Review Skill may move a Finding one level from its default Severity, and says why in the evidence.

## Certainty

How sure the Review Skill is of a Finding, independent of its Severity. A serious problem the skill isn't sure of stays serious, with `needs-review`.

- `confirmed`: read or measured exactly from the design.
- `likely`: the evidence points to it, but part of it was estimated, such as a contrast ratio involving opacity.
- `needs-review`: the skill couldn't read or settle what it needed, so a person checks it.

## Finding ids

An id is a fingerprint of the Finding's axis, its standard's `ref` and its Root Cause, joined by `/`: `<axis>/<ref>/<rootCause>`. An advisory Finding uses `advisory` in place of the ref. For example, `accessibility/1.4.3/node:5:5`. The calling skill gives the `rootCause`, which is one of:

- `node:<node id>` for a single layer
- `component:<key>`, `style:<key>` or `variable:<key>` for a library asset

Build the id from exactly these parts, so the same Root Cause always gives the same id and two reports can be compared.

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
| `standard` | yes, except advisory | `{ source, ref, url }`, such as `{ "source": "WCAG 2.2", "ref": "1.4.3", "url": "https://www.w3.org/TR/WCAG22/#contrast-minimum" }` |
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
   - Profile: its name and location. With none: "None. Settings for this run:", then each of the run's settings as `key: value`
   - Reference Documents: each name, version and location
   - Skills: "design review skills `<setVersion>`, Design Facts `<factsVersion>` (`<factGroups>`), `<runtime>`"
   - Saved: where the report was saved
3. **Fixes by Root Cause:** one numbered item per Root Cause across all axes: its fix and the short ids of the Findings it clears. Order them by how many Findings each clears, most first, then by their highest Severity.
4. **Findings, one `##` section per axis,** headed with the axis's name in the report. List its Findings from the most severe down, `confirmed` before `likely` before `needs-review`. Each is a `###` heading with its short id and title, then:
   - Severity and Certainty
   - Where: each location as a link, `[<layerPath>](<url>)`
   - Standard: source, ref and link
   - Evidence
   - Fix
   With no Findings, write "No Findings." under the axis heading.
5. **Coverage:** a `## Coverage` section with a `###` heading for each axis, then one line per status and note: `<status>: <ref>, <ref>, …`, then the note. A skipped axis gets one line with its reason.
6. **The design-stage line,** after the Coverage section, in every report whose axes include accessibility, whatever its Findings or Coverage: "This is a design-stage review, not a WCAG conformance evaluation. Criteria marked needs-code or needs-annotation in Coverage were not assessed."
7. **The report JSON,** in one fenced `json` block, pretty-printed with 2-space indentation.
