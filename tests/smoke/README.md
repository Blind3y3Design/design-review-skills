# Smoke test

Runs each case through the skills and compares the report's JSON with the case's expected JSON. That JSON is the only seam. Prose, wording and step order are never compared, and neither are the intermediate Design Facts. A scanner fault shows up as a wrong Finding or Coverage entry, and the report's `factsVersion` and `factGroups` help trace it.

It must pass before every release, and after Figma changes its agent or its help page on skills.

## The Figma test file

[Design review smoke test](https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/Design-review-smoke-test), file key `MavZEc8FpIpNX0bagnQQ33`. Link access is limited to people at Cat, because this repo is public.

**Page convention.** Every case is one top-level frame on the **Cases** page (`5:2`). The frame's name is its case id, such as `A11Y-01`, and its content is made up. Each case prefix (A11Y, DS, X, RES, CLEAN, RUN) has a row of its own. Add a case at the end of its prefix's row, and start a new prefix as a row below the others. Reviews scan whole frames, so keep a case's frame free of anything the case doesn't need. Leave "Page 1", the file's original page, empty. Later tickets add the "Review Profile" page and the report page.

## Running a case

**In an external agent** with the Figma MCP server connected:

1. Make the skills in `skills/` available to the agent, by copying the folder or with `npx skills add`.
2. Ask for the review, such as: "Run design-review-accessibility on https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/?node-id=5-3 against WCAG 2.2 AA." Until the criteria reference is on `main`, also give its location, such as "Use the criteria reference at reference-documents/wcag-2.2-criteria.md."
3. Save the reply, or just its JSON block, to a file and compare it:

   ```
   node tests/smoke/compare.mjs A11Y-01 reply.md
   ```

   Or pipe it in: `pbpaste | node tests/smoke/compare.mjs A11Y-01 -`.

**In Figma Design's agent,** run the same prompt by hand, then paste the reply into the comparison script as above.

## The comparison script

`compare.mjs` takes a case id (or an expected JSON file) and a report: raw JSON, or a whole Markdown report, whose last fenced `json` block is read. It compares only:

- each Finding's fingerprint `id`, `axis`, `severity` and `certainty`
- each Finding's `relatedFindings`, in any order
- each Coverage entry's `status`, matched by axis and `ref`, and each whole-axis entry, matched by axis

A missing, extra or duplicate Finding or Coverage entry fails. It prints `PASS <case>` and exits with 0, or `FAIL <case>` and one line per difference and exits with 1. It exits with 2 when it can't run.

Its own tests: `node --test tests/smoke/`.

## Cases

Each built case has a frame on the Cases page and, if its result is a report, an expected file in `expected/`. The rest come with the tickets that build them.

| Id | Case | Frame | Expected |
|---|---|---|---|
| A11Y-01 | Body text at 3.4:1: `#8A8A8A` 16 px text on a `#FFFFFF` frame (3.45:1), under a title that passes | `5:3` | [`A11Y-01.json`](expected/A11Y-01.json): one 1.4.3 Finding on the body text (`5:5`), `moderate`, `confirmed`; 1.4.3 `judged` |
| CLEAN-01 | A frame that follows every rule. For now, every text pair passes 1.4.3, on a frame's fill, a nested frame's fill and a rectangle beneath the text | `5:6` | [`CLEAN-01.json`](expected/CLEAN-01.json): no Findings; 1.4.3 `judged` |
| RUN-04 | A run with `design-review-report-writer` or `design-review-scanner` missing | any case frame | Checked by hand: the run stops, names the missing skill and writes no report |
| A11Y-02 | Text over an image | | `needs-review`, or `not-readable` in Coverage |
| A11Y-03 | Target smaller than 24×24 px | | Target size Finding (2.5.8) |
| A11Y-04 | Meaningful image with no text-alternative annotation | | Missing-annotation Finding (`needs-review`), with 1.1.1 `needs-annotation` in Coverage. With `coverage only`, the Coverage entry alone |
| A11Y-05 | Contrast failure inside an unmodified library instance | | Blamed on the design system; Root Cause is the library component |
| A11Y-06 | Reflow with no section marked for it | | `needs-section`, naming the title to add; no Finding |
| DS-01 | Raw hex fill matching exactly one stack token | | Raw-value Finding, `confirmed`; fix names the token |
| DS-02 | Raw value no token matches | | Raw-value Finding, `confirmed`; fix names no token |
| DS-03 | Raw value matched by several tokens, including an alias | | Fix follows the tie-break, or lists every candidate |
| DS-04 | Detached library instance | | Detached-instance Finding, `confirmed` from `detachedInfo` |
| DS-05 | Direct fill override that swaps in another stack token | | Override Finding; evidence names the token |
| DS-06 | Instance changed only through component properties | | No Finding |
| DS-07 | Instance from a published library the profile doesn't list | | Outside-the-stack Finding |
| DS-08 | One unattributable component used several times | | One `needs-review` Finding listing every use |
| DS-09 | Fill bound to a local variable | | Outside-the-stack Finding naming the variable |
| DS-10 | Product-library component breaking a Foundation Locked Rule | | Blamed on the Product layer, at least `serious` |
| DS-11 | Instance resized, no size rule anywhere | | No Finding |
| DS-12 | The same resize where a rules document sets the size | | Finding citing that rule |
| DS-13 | Direct fill override replacing a bound variable with a raw value | | One Finding |
| DS-14 | Two libraries sharing collection names, both used | | Each variable attributed correctly, `confirmed` inside Figma |
| X-01 | Raw fill that also fails contrast | | Two Findings, one per axis, linked by `relatedFindings` |
| RES-01 | Frame that follows a known Insight | | Coverage `judged`; listed under "Research this design follows" |
| RES-02 | Frame contradicting an Insight that reports task failure | | Finding at `serious`, citing the Insight; no participant details |
| RES-03 | Frame showing a screen an Insight names, doing nothing about it | | Finding at `minor` |
| RES-04 | Orchestrator run with no research topic | | Axis-level `skipped`, "no topic given" |
| RES-05 | Insight older than `Research current for` | | Coverage `stale`; not judged |
| RUN-01 | Orchestrator run | | Each chosen Review Skill loads (chaining) |
| RUN-02 | Reading the public Reference Documents | | Read from GitHub through `curl` |
| RUN-03 | Orchestrator run with one Review Skill not installed | | Axis-level `skipped` naming the skill; other axes run |
| RUN-05 | `/design-review` after a release | | The same version for all six skills |
