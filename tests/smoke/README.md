# Smoke test

Runs each case through the skills and compares the report's JSON with the case's expected JSON. That JSON is the only seam. Prose, wording and step order are never compared, and neither are the intermediate Design Facts. A scanner fault shows up as a wrong Finding or Coverage entry, and the report's `factsVersion` and `factGroups` help trace it.

It must pass before every release, and after Figma changes its agent or its help page on skills.

## The Figma test file

[Design review smoke test](https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/Design-review-smoke-test), file key `MavZEc8FpIpNX0bagnQQ33`. Link access is limited to people at Cat, because this repo is public.

**Page convention.** Every case is one top-level frame on the **Cases** page (`5:2`). The frame's name is its case id, such as `A11Y-01`, and its content is made up. Each case prefix (A11Y, DS, X, RES, CLEAN, RUN) has a row of its own. Add a case at the end of its prefix's row, and start a new prefix as a row below the others. Reviews scan whole frames, so keep a case's frame free of anything the case doesn't need. A variant of a case, such as `A11Y-01-override`, runs on its base case's frame with other settings. Leave "Page 1", the file's original page, empty.

**The Review Profile page** (`16:2`) holds the test profile as one text layer, a copy of [`profiles/smoke-test-profile.md`](profiles/smoke-test-profile.md). Its Design System Layers are DRS Test Foundation, then DRS Test Product. The override profiles in `profiles/` are the same profile with a Severity Overrides section, and [`profiles/local-folder.md`](profiles/local-folder.md) is the same with a Report settings section. Keep them all the same otherwise: a ticket that adds a profile section, such as Design System Layers, adds it to each.

## Running a case

**In an external agent** with the Figma MCP server connected:

1. Make the skills in `skills/` available to the agent, by copying the folder or with `npx skills add`.
2. Ask for the review, giving the test profile at run time, such as: "Run design-review-accessibility on https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/?node-id=5-3 with the Review Profile at https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/?node-id=16-2." A profile given at run time counts as agreeing to use it, so the run doesn't stop to ask. Until the Reference Documents are on `main`, also give the one the review reads, such as "Use the criteria reference at reference-documents/wcag-2.2-criteria.md." For a design system adherence case, run `design-review-library` in the same way, with "Use the Design system baseline at reference-documents/design-system-baseline.md."

   End the prompt with "Don't save the report." unless the case checks saving. A run saves its report by default, as a frame on the file's **Design review** page, so smoke runs would otherwise pile up frames there. The comparison is the same either way.

   For a case run through the Orchestrator, such as X-01, ask for `/design-review` in the same way, naming the reviews to run ("all reviews", or "just accessibility") so the run doesn't stop to ask, and giving every Reference Document the chosen reviews read.
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

With `--axis <axis>`, such as `--axis accessibility`, it compares only that axis's Findings and Coverage entries, and leaves out `relatedFindings`, which only link to other axes. That checks a merged `/design-review` report against a one-axis case (see Orchestrator checks):

```
node tests/smoke/compare.mjs A11Y-01 reply.md --axis accessibility
```

Its own tests: `node --test tests/smoke/compare.test.mjs`. The Design Scanner's report frame script has tests too, run against a fake of the Plugin API: `node --test tests/scripts/report-frame.test.mjs`.

## Cases

Each built case has a frame on the Cases page and, if its result is a report, an expected file in `expected/`. The rest come with the tickets that build them.

| Id | Case | Frame | Expected |
|---|---|---|---|
| A11Y-01 | Body text at 3.4:1: `#8A8A8A` 16 px text on a `#FFFFFF` frame (3.45:1), under a title that passes | `5:3` | [`A11Y-01.json`](expected/A11Y-01.json): one 1.4.3 Finding on the body text (`5:5`), `moderate`, `confirmed`. Coverage has all 55 WCAG 2.2 A/AA criteria: 1.4.3 `judged`, the 8 code-only criteria `needs-code`, and the rest `not-readable` until the scanner reads their facts |
| A11Y-01-override | A11Y-01 with [`profiles/override-serious.md`](profiles/override-serious.md) given at run time, whose Severity Override is "WCAG AA failures: serious" | `5:3` | [`A11Y-01-override.json`](expected/A11Y-01-override.json): the same Finding at `serious`. Coverage as for A11Y-01. Checked by hand: its evidence names the override |
| CLEAN-01 | A frame that follows every rule. For now, every text pair passes 1.4.3, on a frame's fill, a nested frame's fill and a rectangle beneath the text | `5:6` | [`CLEAN-01.json`](expected/CLEAN-01.json): no Findings. Coverage as for A11Y-01 |
| RUN-04 | A run with `design-review-report-writer` or `design-review-scanner` missing | any case frame | Checked by hand: the run stops, names the missing skill and writes no report |
| A11Y-02 | Text over an image | | `needs-review`, or `not-readable` in Coverage |
| A11Y-03 | Target smaller than 24×24 px | | Target size Finding (2.5.8) |
| A11Y-04 | Meaningful image with no text-alternative annotation | | Missing-annotation Finding (`needs-review`), with 1.1.1 `needs-annotation` in Coverage. With `coverage only`, the Coverage entry alone |
| A11Y-05 | Contrast failure inside an unmodified library instance | | Blamed on the design system; Root Cause is the library component |
| A11Y-06 | Reflow with no section marked for it | | `needs-section`, naming the title to add; no Finding |
| DS-01 | Raw hex fill matching exactly one stack token: a `Raw swatch` filled `#E0115F`, beside a `Token swatch` bound to Foundation's `signal/500` (`#E0115F`), on a frame bound to `color/surface/default` | `45:16` | [`DS-01.json`](expected/DS-01.json): one `raw-value` Finding on the raw swatch (`45:18`), `moderate`, `confirmed`. Coverage: `raw-value` `judged`. Checked by hand: the fix names `signal/500` |
| DS-01-no-baseline | DS-01 with the profile given at run time and no baseline location, while the baseline's default link can't be read. Until the baseline is on `main`, that's any run without its location. After that, block the link for the run | `45:16` | [`DS-01-no-baseline.json`](expected/DS-01-no-baseline.json): no Findings, and a whole-axis `skipped` entry whose reason says the baseline couldn't be read |
| DS-02 | Raw value no token matches: a `Raw swatch` filled `#7A3EF0`, beside a `Token swatch` bound to `color/action/primary` (`#0B5FFF`) | `45:19` | [`DS-02.json`](expected/DS-02.json): one `raw-value` Finding on the raw swatch (`45:21`), `moderate`, `confirmed`. Coverage as for DS-01. Checked by hand: the fix names no token |
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
| X-01 | Raw fill that also fails contrast: `/design-review` with all reviews, on a frame bound to `color/surface/default` holding a `Title` bound to `color/text/default` and a `Body` in the `Test Foundation/Body` text style, filled a raw `#8A8A8A` (3.45:1) | `62:6` | [`X-01.json`](expected/X-01.json): two Findings on the body text (`62:8`), `design-system/raw-value` and `accessibility/1.4.3`, both `moderate` and `confirmed`, each listing the other in `relatedFindings`. Coverage: `raw-value` `judged`, and the accessibility entries as for A11Y-01. Checked by hand: the report's Fixes by Root Cause has one item clearing both |
| RES-01 | Frame that follows a known Insight | | Coverage `judged`; listed under "Research this design follows" |
| RES-02 | Frame contradicting an Insight that reports task failure | | Finding at `serious`, citing the Insight; no participant details |
| RES-03 | Frame showing a screen an Insight names, doing nothing about it | | Finding at `minor` |
| RES-04 | Orchestrator run with no research topic | | Axis-level `skipped`, "no topic given" |
| RES-05 | Insight older than `Research current for` | | Coverage `stale`; not judged |
| RUN-01 | Orchestrator run: `/design-review` on X-01 with the test profile and no reviews named, so it asks | `62:6` | Asks once, before the scan, with Design system adherence and Accessibility ticked and Research alignment "not set up". Then passes `X-01` (`node tests/smoke/compare.mjs X-01 reply.md`), which only both Review Skills together can give. Checked by hand: each chosen Review Skill loaded, and the scanner ran once for both |
| RUN-02 | Reading the public Reference Documents | | Read from GitHub through `curl` |
| RUN-03 | Orchestrator run with one Review Skill not installed | | Axis-level `skipped` naming the skill; other axes run |
| RUN-05 | `/design-review` after a release | | The same version for all six skills |

## Orchestrator checks

`/design-review` runs the Review Skills in JSON-only mode from one shared scan, then merges their reports. These checks show that gives each axis the same results as its Review Skill on its own.

| Check | Set-up | Expected |
|---|---|---|
| Every case through `/design-review` | Each case above that has an expected file, run as `/design-review` with all reviews, the case's profile and its Reference Documents | Each passes its case with `--axis` set to the case's axis. The other axis's results on the frame aren't compared |
| One review named | A11Y-01 as `/design-review` with "just accessibility", and DS-01 with "just design system adherence" | Hands off to the Review Skill in full-report mode, so each passes its case without `--axis`, as the Review Skill on its own does |
| One scan | Every run with two reviews | The scanner is used once for the run, one call per node and fact group, and no Review Skill scans |

## Review Profile checks

Checked by hand in an external agent, on A11Y-01 unless the check names another case, because the JSON seam doesn't cover them. Each lookup step is reached only when the steps before it find nothing, so the checks marked "page off" rename the Review Profile page to `Review Profile (off)` for the run, and name it back afterwards.

| Check | Set-up | Expected |
|---|---|---|
| Given at run time | The page's link, or a file in `profiles/`, in the prompt, as in A11Y-01 and CLEAN-01 runs | No question. The report's `profile` and header name the profile |
| The file's page | No profile in the prompt | Asks whether to use the page's Accessibility section. On yes, `profile` names the page |
| A pointer in `AGENTS.md` | Page off. The project's `AGENTS.md` has `Review Profile: <path to profiles/smoke-test-profile.md>` | Asks whether to use it. On yes, `profile` names the file |
| No profile | Page off, and no pointer | Says why it's asking and asks what to check against. The header lists the answers under "Settings for this run", `profile` is null, and no profile is saved |
| An unreadable pointer | Page off. `AGENTS.md` points to a file that doesn't exist | Stops with the location and the reason, and writes no report |
| An unreadable pointer on the page | Page off. A temporary page named `Review Profile` holds only `Review Profile: <link to a file with no Review Profile page>`, such as [DRS Test Unlisted](https://www.figma.com/design/8DhePf1jHSsrvwFxpiYoQf/DRS-Test-Unlisted). Delete it afterwards | Stops with the location and the reason, and writes no report |
| A critical override without a core task | [`profiles/override-critical.md`](profiles/override-critical.md) given at run time | Passes `A11Y-01`, and the header's Notes say the override wasn't applied |

## Saving checks

Checked by hand in an external agent, because the JSON seam doesn't say where a report went. These are the runs that leave out "Don't save the report." The report page is the **Design review** page, where each saved report is a frame, newest first. Delete a check's frames once it has passed, and the page when it's empty, so the next check adds it again.

| Check | Set-up | Expected |
|---|---|---|
| The report page | A11Y-01 with the test profile's page link, and no Design review page in the file | Adds the Design review page with one frame, named `<date> · A11Y-01`. The chat's Saved line links to it. The frame's JSON, read back with the script below, passes `compare.mjs A11Y-01` |
| Newest first | Then CLEAN-01 the same way | Its frame is above the A11Y-01 frame, and first in the script's `frames`. The A11Y-01 frame hasn't moved |
| Don't save | A11Y-01-override, with "Don't save the report." | Passes `A11Y-01-override`. No frame is added, and the Saved line says "Not saved: you asked not to save this run." |
| A local folder | A11Y-01 with [`profiles/local-folder.md`](profiles/local-folder.md) given at run time | The report is saved as `reports/smoke-test/design-review-<date>-a11y-01.md` (a folder git ignores), and that file passes `compare.mjs A11Y-01`. No frame is added |
| Without edit access | A11Y-01, run by someone with view access to the test file | No frame is added. The chat's Saved line says the report is in the chat only, with Figma's error |
| An oversized report | The frame script in the scanner run by hand with a `REPORT` over 100 kB, such as one Finding whose `evidence` is `'x'.repeat(110000)` | The frame's last line says the JSON stayed in the chat, and the frame has no JSON |

To read a report frame back, run this through `use_figma` on the test file. `frames` lists the page's frames from the top of the layers panel down, and `json` is the report JSON of the frame named in `FRAME_ID`, or of the newest. Save `json` to a file to compare it.

```js
const FRAME_ID = null;
const page = figma.root.children.find((p) => p.name.trim().toLowerCase() === 'design review');
if (!page) return { page: null };
await page.loadAsync();
const frames = [...page.children].reverse().map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y, jsonLength: n.getSharedPluginData('designreview', 'report').length }));
const frame = FRAME_ID ? await figma.getNodeByIdAsync(FRAME_ID) : page.children[page.children.length - 1];
return { page: page.id, frames, json: frame ? JSON.parse(frame.getSharedPluginData('designreview', 'report') || 'null') : null };
```
