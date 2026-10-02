# Smoke test

Runs each case through the skills and compares the report's JSON with the case's expected JSON. That JSON is the only seam. Prose, wording and step order are never compared, and neither are the intermediate Design Facts. A scanner fault shows up as a wrong Finding or Coverage entry, and the report's `factsVersion` and `factGroups` help trace it.

The whole suite must pass before every release, and after Figma changes its agent or its help page on skills. While building, a change runs only the cases it affects, to keep within the Figma MCP's daily call limit.

## The Figma test file

[Design review smoke test](https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/Design-review-smoke-test), file key `MavZEc8FpIpNX0bagnQQ33`. Link access is limited to people at Cat, because this repo is public.

**Page convention.** Every case is one top-level frame on the **Cases** page (`5:2`). The frame's name is its case id, such as `A11Y-01`, and its content is made up. Each case prefix (A11Y, DS, X, RES, CLEAN, RUN) has a row of its own. Add a case at the end of its prefix's row, and start a new prefix as a row below the others. Reviews scan whole frames, so keep a case's frame free of anything the case doesn't need. A variant of a case, such as `A11Y-01-override`, runs on its base case's frame with other settings. Leave "Page 1", the file's original page, empty.

**The Review Profile page** (`16:2`) holds the test profile as one text layer, a copy of [`profiles/smoke-test-profile.md`](profiles/smoke-test-profile.md). Its Design System Layers are DRS Test Foundation, then DRS Test Product, and its Product context is `Target platforms: Web`. The other profiles in `profiles/` are the same profile with one change each: the override profiles add a Severity Overrides section, [`profiles/local-folder.md`](profiles/local-folder.md) a Report settings section, [`profiles/annotate.md`](profiles/annotate.md) one with `Annotate layers: on`, [`profiles/native.md`](profiles/native.md) `Target platforms: iOS`, [`profiles/coverage-only.md`](profiles/coverage-only.md) `Missing annotations: coverage only`, and [`profiles/research-sources.md`](profiles/research-sources.md) a Research Sources section. Two differ in their Design System Layers: [`profiles/foundation-only.md`](profiles/foundation-only.md) lists only the Foundation layer, and [`profiles/working-file.md`](profiles/working-file.md) adds a third layer whose library is this file. [`profiles/no-layers.md`](profiles/no-layers.md) leaves the Design System Layers section out, so design system adherence is "not set up" (RUN-12). Keep them all the same otherwise: a ticket that adds a profile section, such as Design System Layers, adds it to each.

**Annotations on case frames.** A case frame carries the native annotations, in the Accessibility category, that the criteria it triggers need, other than the one the case is about. A11Y-04's photo, for instance, has no text alternative, but its heading is annotated, so the case raises only the 1.1.1 Finding. Case frames hold none of the review's own annotations, in the `Design review: <axis>` categories: delete any that a run leaves, unless the case needs them.

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
- each Coverage entry's `status`, matched by axis and `ref`, and each whole-axis entry, matched by axis, for the entries the expected JSON lists
- a whole-axis `skipped` entry's `reasonCode`, when the expected entry lists one. The `reason` sentence is never compared

A missing, extra or duplicate Finding fails, and so does a missing or duplicate Coverage entry. A Coverage entry the expected JSON doesn't list fails only when the expected JSON sets `"fullCoverage": true`.

**Which Coverage entries an expected file lists.** CLEAN-01 lists every entry and sets `fullCoverage`, so it alone checks that every criterion has a status. Every other accessibility case lists only the entries that say something about it, leaving out `not-applicable` and `needs-code`. That way a change to one criterion's trigger in the reference touches CLEAN-01 and the cases about that criterion, not every case. Design system cases list all of their few checks. It prints `PASS <case>` and exits with 0, or `FAIL <case>` and one line per difference and exits with 1. It exits with 2 when it can't run.

With `--axis <axis>`, such as `--axis accessibility`, it compares only that axis's Findings and Coverage entries, and leaves out `relatedFindings`, which only link to other axes. That checks a merged `/design-review` report against a one-axis case (see Orchestrator checks):

```
node tests/smoke/compare.mjs A11Y-01 reply.md --axis accessibility
```

`compare-profile.mjs` does the same for a Review Profile that a first run saved: `node tests/smoke/compare-profile.mjs tests/smoke/expected-profiles/RUN-10.md saved-profile.md`. It compares the title, the profile version, the `##` and `###` headings in order, and each section's `Key: value` lines, and checks that each `##` section has one sentence line. It leaves out the sentences' wording and the `Last updated` date, which only has to be a date. To read the saved page, run the Profile Finder's page script through `use_figma` on the copy, or copy the page's text.

Its own tests: `node --test tests/smoke/compare.test.mjs`. The fixed scripts in the Design Scanner and the Figma Writer have tests too, run against a fake of the Plugin API: `node --test tests/scripts/*.test.mjs`, which include the profile comparison's.

## Cases

Each built case has a frame on the Cases page and, if its result is a report, an expected file in `expected/`. The rest come with the tickets that build them.

| Id | Case | Frame | Expected |
|---|---|---|---|
| A11Y-01 | Body text at 3.4:1: `#8A8A8A` 16 px text on a `#FFFFFF` frame (3.45:1), under a title that passes, whose heading is annotated | `5:3` | [`A11Y-01.json`](expected/A11Y-01.json): one 1.4.3 Finding on the body text (`5:5`), `moderate`, `confirmed`. Coverage has all 55 WCAG 2.2 A/AA criteria: 1.3.1, 1.4.3 and 2.4.6 `judged`, the 8 code-only criteria `needs-code`, and the rest `not-applicable`, since the frame holds nothing else that triggers them and is too small to be a screen |
| A11Y-01-override | A11Y-01 with [`profiles/override-serious.md`](profiles/override-serious.md) given at run time, whose Severity Override is "WCAG AA failures: serious" | `5:3` | [`A11Y-01-override.json`](expected/A11Y-01-override.json): the same Finding at `serious`. Coverage as for A11Y-01. Checked by hand: its evidence names the override |
| CLEAN-01 | A frame that follows every rule: text pairs that pass 1.4.3 on a frame's fill, a nested frame's fill and a rectangle beneath the text, an instruction naming a button by its label, an underlined link in running text, a checked 24×24 checkbox with its label, and a 312×48 Place order button. At 360 × 384 it's a screen, so its frame's annotations give its heading, page title, language, orientation, reading and focus order, behaviour on focus and input, and order review | `5:6` | [`CLEAN-01.json`](expected/CLEAN-01.json): no Findings. Every static criterion that needs no marked section is `judged`, and so are the annotation criteria it triggers (1.3.1, 1.3.4, 2.4.2, 2.4.3, 3.1.1, 3.2.1, 3.2.2, 3.3.4). 1.4.10, 2.4.7 and 3.2.4 are `needs-section`. The rest as for A11Y-01 |
| RUN-04 | A run with `design-review-report-writer`, `design-review-scanner` or `design-review-profile` missing, as a Review Skill on its own and through `/design-review` | any case frame | Checked by hand: the run stops, names the missing skill (every missing skill, when more than one) and writes no report. Through `/design-review` it makes no Figma call |
| A11Y-01-figma | A11Y-01 run in Figma Design's agent | `5:3` | Passes `A11Y-01.json`. Checked by hand: the line suggesting Figma's accessibility checker follows the design-stage line. In an external agent, it doesn't appear |
| A11Y-02 | Text over an image: a white caption (`64:6`) over a photo, under a title that passes. The heading and the photo's text alternative are annotated | `64:2` | [`A11Y-02.json`](expected/A11Y-02.json): one 1.4.3 Finding on the caption, `moderate`, `needs-review`, with the scanner's reason. 1.4.3 is `judged` from the title, and 1.1.1, 1.3.1, 1.4.5 and 2.4.6 are `judged` |
| A11Y-03 | Target smaller than 24×24 px: two 16×16 icon buttons, `Previous` (`64:9`) and `Next` (`64:12`), 4 px apart, so the spacing exception doesn't apply. Their text alternatives and focus order are annotated | `64:7` | [`A11Y-03.json`](expected/A11Y-03.json): a 2.5.8 Finding on each button, `moderate`, `confirmed`. 1.1.1, 1.4.5, 1.4.11, 2.4.3 and 2.5.8 `judged`, 2.4.7 and 3.2.4 `needs-section`, 3.2.1 `needs-state` |
| A11Y-03-native | A11Y-03 with [`profiles/native.md`](profiles/native.md) given at run time, so the frame is native and states no density | `64:7` | [`A11Y-03-native.json`](expected/A11Y-03-native.json): one 2.5.8 Finding on the frame (`node:64:7`), `moderate`, `needs-review`, and 2.5.8 `not-readable`. The rest as for A11Y-03 |
| A11Y-04 | Meaningful image with no text-alternative annotation: a photo, `Hero photo` (`38:4`), under a title whose heading is annotated, in a 360 × 300 frame | `38:2` | [`A11Y-04.json`](expected/A11Y-04.json): one missing-annotation Finding on the photo, `serious`, `needs-review`, with 1.1.1 `needs-annotation` in Coverage |
| A11Y-04-coverage-only | A11Y-04 with [`profiles/coverage-only.md`](profiles/coverage-only.md) given at run time, which sets `Missing annotations: coverage only` | `38:2` | [`A11Y-04-coverage-only.json`](expected/A11Y-04-coverage-only.json): no Findings. 1.1.1 `needs-annotation` in Coverage |
| A11Y-05 | Contrast failure inside an unmodified library instance: a `Test Product/Badge` instance, `Status badge` (`152:62`), whose `Label` property is set to "Shipped". Its text resolves to `#8A8A8A` on `#F2F2F2` (3.08:1) at 12 px, as the library publishes it. The title above it is annotated as on A11Y-01 | `152:60` | [`A11Y-05.json`](expected/A11Y-05.json): one 1.4.3 Finding, `moderate`, `confirmed`, blamed on the design system: its Root Cause is the Badge component (`component:7956e646…`), not the layer. Coverage lists 1.3.1, 1.4.3 and 2.4.6 `judged`. 1.4.1 and 1.4.11 are left out, since runs differ on whether a badge triggers them. Checked by hand: the first location is the component, and the fix names DRS Test Product as the owner |
| A11Y-06 | Reflow with no section marked for it: a 1024 × 480 screen of text, with its heading, page title, ways to find it and language annotated | `38:5` | [`A11Y-06.json`](expected/A11Y-06.json): no Findings. 1.4.10 `needs-section`, whose note names the title "Reflow". 1.3.1, 2.4.2, 2.4.5 and 3.1.1 `judged` from their annotations, and 1.3.3 from the tracking instruction |
| A11Y-07 | A missing reading-order annotation that affects 1.3.2 and 2.4.3: two plan cards side by side, each with a bordered button, in a 640 × 180 frame. Its headings and structure are annotated | `38:9` | [`A11Y-07.json`](expected/A11Y-07.json): one Finding on the frame, standard 1.3.2, `serious`, `needs-review`, whose evidence names 2.4.3. 1.3.2 and 2.4.3 `needs-annotation`, 2.4.7 and 3.2.4 `needs-section`, 3.2.1 `needs-state`, and 1.3.1, 1.4.11 and 2.5.8 `judged` |
| A11Y-08 | A "Focus states" section whose focus indicator fails 1.4.11: a button's `Default` and `Focused` variants, the focused one with a 2 px outside `#C7C7C7` stroke on white (1.69:1) | `38:20` | [`A11Y-08.json`](expected/A11Y-08.json): one 1.4.11 Finding on the `State=Focused` variant (`38:24`), `moderate`, `confirmed`. 1.4.1 (the focused state), 1.4.11, 2.4.7 and 2.5.8 `judged`, 3.2.4 `needs-section`, 3.2.1 `needs-state` |
| A11Y-09 | Layer annotations: A11Y-04's title and photo, with `#8A8A8A` 16 px body text (`109:4070`) between them, which carries a designer's own annotation in the Content category | `109:4067` | [`A11Y-09.json`](expected/A11Y-09.json): a 1.1.1 missing-annotation Finding on the photo (`109:4069`), `serious`, `needs-review`, and a 1.4.3 Finding on the body text, `moderate`, `confirmed`. Coverage as for A11Y-04. Its annotation runs are in Layer annotation checks |
| A11Y-10 | A failing pair of valid tokens, placed by the designer: `Body` (`152:66`) bound to Foundation's `color/text/subtle` on a frame bound to `color/surface/muted` (3.08:1 at 16 px). Both tokens are valid, and the pair fails. The title is bound to `color/text/default` and annotated | `152:64` | [`A11Y-10.json`](expected/A11Y-10.json): one 1.4.3 Finding, `moderate`, `confirmed`, on the designer's side: its Root Cause is the text colour's variable (`variable:d085be2f…`), not a library component. Coverage lists 1.3.1, 1.4.3 and 2.4.6 `judged` |
| A11Y-11 | An override on the failing property of a library instance: a `Test Product/Badge` instance, `Status badge` (`152:69`), whose label fill is changed from `color/product/badge-text` to a raw `#9A9A9A` (still failing) | `152:67` | [`A11Y-11.json`](expected/A11Y-11.json): one 1.4.3 Finding on the label (`node:I152:69;1004:35`), `moderate`, `confirmed`, on the designer's side. Coverage as for A11Y-10. Checked by hand: the evidence names the fill override and the Badge |
| A11Y-12 | A library instance whose override state can't be settled: a `Test Product/Badge` instance, `Status badge` (`152:73`), whose label has a change the facts can't classify (its export settings and lock, listed under `other`) | `152:71` | [`A11Y-12.json`](expected/A11Y-12.json): one 1.4.3 Finding on the label (`node:I152:73;1004:35`), `moderate`, `confirmed`, on the designer's side. Coverage as for A11Y-10. Its Root Cause is the layer, though its text colour is bound to a variable. Checked by hand: the evidence says "possibly inherited from" the Badge |
| A11Y-13 | The same failing pair of valid tokens as A11Y-10, with a rules document or docs that document a passing pairing | | Deferred to v0.2 (#50). Designer's Finding whose fix suggests the documented pairing (`color/text/default` on `color/surface/muted`, about 15.6:1) |
| DS-01 | Raw hex fill matching exactly one stack token: a `Raw swatch` filled `#E0115F`, beside a `Token swatch` bound to Foundation's `signal/500` (`#E0115F`), on a frame bound to `color/surface/default` | `45:16` | [`DS-01.json`](expected/DS-01.json): one `raw-value` Finding on the raw swatch (`45:18`), `moderate`, `confirmed`. Coverage: `raw-value`, `outside-stack` and `detached-instance` `judged`, `unattributed`, `override` and `resize` `not-applicable`. Checked by hand: the fix names `signal/500` |
| DS-01-no-baseline | DS-01 with the profile given at run time and no baseline location, run with the skills copy that has a dead baseline link (see The dead-link copy). It runs in an external agent only: in Figma Design's agent it would need the dead-link copy published as the organisation's skill | `45:16` | [`DS-01-no-baseline.json`](expected/DS-01-no-baseline.json): no Findings, and a whole-axis `skipped` entry whose reason says the baseline couldn't be read |
| DS-02 | Raw value no token matches: a `Raw swatch` filled `#7A3EF0`, beside a `Token swatch` bound to `color/action/primary` (`#0B5FFF`) | `45:19` | [`DS-02.json`](expected/DS-02.json): one `raw-value` Finding on the raw swatch (`45:21`), `moderate`, `confirmed`. Coverage as for DS-01. Checked by hand: the fix names no token |
| DS-04 | Detached library instance: `Primary button` (`119:71`), a frame detached from an instance of `Test Foundation/Button`, `Type=Primary`. It still holds an instance of `Test Foundation/Icon/Check`, whose stroke the Button's component had changed | `119:66` | [`DS-04.json`](expected/DS-04.json): one `detached-instance` Finding on the frame (`node:119:71`), `moderate`, `confirmed`, and no `override` Finding for the icon's stroke. Coverage: all six checks `judged`. Checked by hand: the evidence says the frame is detached from a component the scanner didn't name, and gives its key, since no instance of `Test Foundation/Button` is in the scope and the scanner only reads |
| DS-05 | Direct fill override that swaps in another stack token: a `Test Foundation/Button` instance, `Primary button` (`119:75`), whose fill is changed from `color/action/primary` to `color/text/default` | `119:74` | [`DS-05.json`](expected/DS-05.json): one `override` Finding on the instance (`node:119:75`), `moderate`, `confirmed`. Coverage: all six checks `judged`. Checked by hand: the evidence names `color/text/default` (DRS Test Foundation) |
| DS-06 | Instances changed only through component properties, on four components: `Test Foundation/Button` as `Back button` (`119:80`, the `Type` variant set to Secondary and the `Label` text property to Back), `Continue button` (`119:88`, the `Show icon` boolean off), and `Next button` (`119:92`, the `Icon` instance swap set to Arrow), then `Test Foundation/Tag` (`119:97`), `Test Product/Pill Button` (`119:99`) and `Test Product/Badge` (`119:101`), each with its `Label` changed | `119:79` | [`DS-06.json`](expected/DS-06.json): no Findings. Coverage: all six checks `judged`. The facts show what the override split has to get right: each hugging instance has a `size` change, and the swapped icon's stroke is carried over from the Button's component (`carried`) |
| DS-07 | Instance from a published library the profile doesn't list: an instance of `Test Unlisted/Promo Tile` (`88:47`) on a frame bound to `color/surface/default` | `88:46` | [`DS-07.json`](expected/DS-07.json): one `outside-stack` Finding on the component (`component:4bf5425d…`), `moderate`, `confirmed`. Coverage: all six checks `judged`. Checked by hand: the component's location names DRS Test Unlisted |
| DS-07-figma | DS-07 run in Figma Design's agent, which has no library lookup for components | `88:46` | [`DS-07-figma.json`](expected/DS-07-figma.json): the same component as an `unattributed` Finding, `moderate`, `needs-review`, since no layer's match hint fits it. To confirm in #47 |
| DS-08 | One unattributable component used several times: three pasted instances of `_Ghost Chip`, a component no library publishes. Built by hand: in [DRS Test Unlisted](https://www.figma.com/design/8DhePf1jHSsrvwFxpiYoQf/DRS-Test-Unlisted?node-id=2012-4), copy the three instances on the "Ghost source (not published)" page, and paste them into the DS-08 frame. Scripts can't paste across files | `88:49` | [`DS-08.json`](expected/DS-08.json): one `unattributed` Finding on the component (`component:8021bcd7…`), `moderate`, `needs-review`, listing the three instances. Coverage: all six checks `judged`. Once it's pasted, check that the component's key in this file is still `8021bcd7b7c397da34e96ce9c4c99ac95db0f403` |
| DS-09 | Fill bound to a local variable: a `Local swatch` (`88:53`) bound to `local/accent` (`#1F8A70`) in this file's `Local tokens` collection | `88:50` | [`DS-09.json`](expected/DS-09.json): one `outside-stack` Finding on the variable (`variable:b990b604…`), `moderate`, `confirmed`. Coverage: `raw-value`, `outside-stack` and `detached-instance` `judged`, `unattributed`, `override` and `resize` `not-applicable`. Checked by hand: the evidence names `local/accent` |
| DS-09-listed | DS-09 with [`profiles/working-file.md`](profiles/working-file.md) given at run time, which lists this file as a layer's library | `88:50` | [`DS-09-listed.json`](expected/DS-09-listed.json): no Findings. Coverage as for DS-09 |
| DS-10 | Product-library component breaking a Foundation Locked Rule | | Deferred to v0.2 (#50). Blamed on the Product layer, at least `serious` |
| DS-11 | Instance resized, no size rule anywhere: a `Test Foundation/Button` instance, `Wide button` (`119:104`), resized from 102×36 to 160×44 | `119:103` | [`DS-11.json`](expected/DS-11.json): no Findings. Coverage: all six checks `judged` |
| DS-12 | The same resize where a rules document sets the size | | Deferred to v0.2 (#50). Finding citing that rule |
| DS-13 | Direct fill override replacing a bound variable with a raw value: a `Test Foundation/Button` instance, `Primary button` (`119:109`), whose fill is a raw `#1F4E8C` in place of `color/action/primary` | `119:108` | [`DS-13.json`](expected/DS-13.json): one `override` Finding on the instance (`node:119:109`), `moderate`, `confirmed`, and no `raw-value` Finding for the same fill. Coverage: all six checks `judged` |
| DS-14 | Two libraries sharing collection names, both used: `Foundation theme` (`88:55`) bound to Foundation's `Theme` `color/surface/muted`, `Product theme` (`88:56`) to Product's `Theme` `color/product/accent`, and `Foundation size` (`88:57`) and `Product size` (`88:58`) with their radius bound to Foundation's `Size` `radius/sm` and Product's `Size` `radius/pill` | `88:54` | [`DS-14.json`](expected/DS-14.json): no Findings. Coverage as for DS-09 |
| DS-14-foundation-only | DS-14 with [`profiles/foundation-only.md`](profiles/foundation-only.md) given at run time, so only the Product variables are outside the stack. Attributing by collection name would report all four variables or none | `88:54` | [`DS-14-foundation-only.json`](expected/DS-14-foundation-only.json): one `outside-stack` Finding for each Product variable (`variable:ba3f4e8e…`, `variable:31165e14…`), `moderate`, `confirmed`. Checked by hand: each variable location names DRS Test Product. Run it in Figma Design's agent too (#47) |
| X-01 | Raw fill that also fails contrast: `/design-review` with all reviews, on a frame bound to `color/surface/default` holding a `Title` bound to `color/text/default`, whose heading is annotated as on A11Y-01, and a `Body` in the `Test Foundation/Body` text style, filled a raw `#8A8A8A` (3.45:1) | `62:6` | [`X-01.json`](expected/X-01.json): two Findings on the body text (`62:8`), `design-system/raw-value` and `accessibility/1.4.3`, both `moderate` and `confirmed`, each listing the other in `relatedFindings`. Coverage: `raw-value`, `outside-stack`, `unattributed` and `detached-instance` `judged`, since the frame binds Foundation's variables and text styles, `override` and `resize` `not-applicable`, since it holds no instance, and the accessibility entries as for A11Y-01. Checked by hand: the report's Fixes by Root Cause has one item clearing both |
| X-02 | Same layer, different properties: `/design-review` with all reviews on A11Y-07's frame (`38:9`), whose raw `fill #FFFFFF` and missing reading-order annotation (1.3.2) are on the same frame. It has no frame of its own, and runs on A11Y-07's | `38:9` | [`X-02.json`](expected/X-02.json): the frame's `design-system/raw-value` Finding (`node:38:9`) and `accessibility/1.3.2`, which A11Y-07 expects, plus a `raw-value` Finding for each of the cards and their texts and buttons (`38:10` to `38:19`), all `moderate` and `confirmed`. No Finding lists a `relatedFindings`, since no two share a property. Coverage: `raw-value` and `detached-instance` `judged`, `outside-stack`, `unattributed`, `override` and `resize` `not-applicable`, since the frame holds no instance, and A11Y-07's accessibility entries. Checked by hand: the report's Fixes by Root Cause has the reading-order annotation and the frame's raw values as separate items |
| RES-01 | Frame that follows a known Insight | | Deferred to v0.2 (#50). Coverage `judged`; listed under "Research this design follows" |
| RES-02 | Frame contradicting an Insight that reports task failure | | Deferred to v0.2 (#50). Finding at `serious`, citing the Insight; no participant details |
| RES-03 | Frame showing a screen an Insight names, doing nothing about it | | Deferred to v0.2 (#50). Finding at `minor` |
| RES-04 | Orchestrator run with no research topic | | Deferred to v0.2 (#50). Axis-level `skipped`, "no topic given" |
| RES-05 | Insight older than `Research current for` | | Deferred to v0.2 (#50). Coverage `stale`; not judged |
| RUN-01 | Orchestrator run: `/design-review` on X-01 with the test profile and no reviews named, so it asks | `62:6` | Asks once, before the scan, with Design system adherence and Accessibility ticked and Research alignment "not set up". Then passes `X-01` (`node tests/smoke/compare.mjs X-01 reply.md`), which only both Review Skills together can give. Checked by hand: each chosen Review Skill loaded, and the scanner ran once for both |
| RUN-02 | Reading the public Reference Documents | | Read from GitHub through `curl` |
| RUN-03 | `/design-review` on X-01 with all reviews and [`profiles/research-sources.md`](profiles/research-sources.md) given at run time. The profile has Research Sources, and `design-review-research` doesn't exist in this release | `62:6` | [`RUN-03.json`](expected/RUN-03.json): X-01's two Findings, `raw-value` and 1.4.3 `judged`, and a whole-axis `skipped` entry for research with `reasonCode` `skill-not-installed`. Checked by hand: its reason names `design-review-research`, and the run asks no research topic |
| RUN-05 | `/design-review` asked which versions are installed. After a release, the same | | Checked by hand: one line per skill, `design-review`, the two Review Skills, `design-review-research` as `not installed`, and the four other skills, each at `0.1.0-dev` (the release's version, after one). It ends "All installed skills are at 0.1.0-dev." The run makes no Figma call and no review |
| RUN-06 | A Review Skill that fails: `/design-review` on A11Y-01 with all reviews and the test profile, where the copy of `design-review-library` has this line added under its heading: "Test fault: when run in json only mode, stop at once and reply with only `ERROR: the review crashed`." | `5:3` | [`RUN-06.json`](expected/RUN-06.json): the accessibility Finding and 1.4.3 `judged`, and a whole-axis `skipped` entry for design-system with `reasonCode` `skill-failed`. Checked by hand: the reason names `design-review-library`, a note says to run it on its own, and the Orchestrator didn't run the review itself |
| RUN-07 | An unreadable Reference Document under the Orchestrator: `/design-review` on A11Y-01 with all reviews, the test profile, the criteria reference at its local path and "Use the Design system baseline at reference-documents/no-such-baseline.md" | `5:3` | [`RUN-07.json`](expected/RUN-07.json): as RUN-06, with `reasonCode` `reference-unreadable` on the design-system entry. The accessibility review ran |
| RUN-08 | A version mismatch: `/design-review` on X-01 with all reviews and the test profile, where the copy of `design-review-library` says "Version 0.2.0 of the design review skills." | `62:6` | Passes `X-01`. Checked by hand: the report's header Notes carry a version warning that names `design-review-library`, `0.2.0` and `0.1.0-dev`. The same run with "just design system adherence" carries it too |
| RUN-09 | None of the Review Skills loads: `/design-review` with all reviews and the test profile, where `design-review-library` and `design-review-accessibility` are not installed | any case frame | Checked by hand: the reply says the run can't run, names both skills, and says to install them or run each review in its own prompt. It asks nothing, makes no Figma call and writes no report |
| RUN-10 | A first run: `/design-review` on the RUN-10 frame, in a copy of this file with no Review Profile page (see The first-run copy), with the scripted answers below. The frame holds a title bound to Foundation's `color/text/default` on a frame bound to `color/surface/default`, a `Test Foundation/Button` instance, a `Test Product/Badge` instance (whose Product variables alias Foundation's) and one `Test Unlisted/Promo Tile` instance, which no other library links to | `175:29` | [`expected-profiles/RUN-10.md`](expected-profiles/RUN-10.md), compared with `compare-profile.mjs`: the saved "Review Profile" page. Checked by hand: the questions come one per message and in order (set up or point, which reviews, name and owner, Design System Layers from `design-review-library`, the accessibility target from `design-review-accessibility`, product context, review and save); the research source isn't asked and research alignment is listed as "not available in this release"; the Design System Layers question proposes Foundation then Product, leaves DRS Test Unlisted out with its reason, and asks for no rules document or owner; all questions come before the review runs; the full profile is shown in the chat; the review then runs once, with no further question, and the report's Profile line names the page |
| RUN-11 | Neither option: the same run, answering question 1 with "Neither" | `175:29` | Checked by hand: the run stops after question 1, says each review can run on its own, and asks nothing else. It scans nothing, writes no report, and the file has no "Review Profile" page afterwards |
| RUN-12 | Adding a "not set up" axis: `/design-review` on the RUN-10 frame, in a copy whose "Review Profile" page holds [`profiles/no-layers.md`](profiles/no-layers.md), choosing both reviews | `175:29` | [`expected-profiles/RUN-12.md`](expected-profiles/RUN-12.md), compared with `compare-profile.mjs`: the page after the run. Checked by hand: design system adherence is listed as "not set up" in the one question that settles the run; choosing it runs the library skill's set-up question, then asks whether to add the section to the profile or use it for this run only; only after "add" does the page change, in one text layer, with the section between Identity and Accessibility. With "this run only" the page is unchanged. The same run on a page that also holds a designer's note shows the section in the chat, names the profile's owner, and leaves the page as it was |
| RUN-13 | Pointing to a profile: question 1 answered with a link to the test file's own "Review Profile" page (`16:2`), in a copy with no page | `175:29` | Checked by hand: the Profile Finder reads it from the other file, the run asks no set-up question, step 3 also asks whether to save a pointer, and on yes the copy gets a "Review Profile" page whose one line is `Review Profile: <the link>`, which a later run follows to the test profile. With a link to a file that has no such page, the run stops with the location and the reason and creates no profile |

## The first-run copy

A first run needs a file with no Review Profile page, and the test file's page can't be taken away while other runs use it. So the first-run cases run in a **copy** of the test file: in Figma, File > Duplicate on the test file, then delete the copy's "Review Profile" and "Design review" pages. The copy keeps the test libraries, because they're enabled for the team, but a file made from scratch doesn't. Use the copy's own link and file key in the prompt. After each case, delete the "Review Profile" page it saved, and the pointer page RUN-13 saves, so the next case starts from a file with none. RUN-12 starts from the copy with a "Review Profile" page holding `profiles/no-layers.md` as one text layer.

**The scripted answers.** A run can't wait for a person, so the agent under test gets a script for the user's side. Each question goes in a block that starts `QUESTION <n>:`, and the next scripted answer follows it. RUN-10's answers, by what the question is about:

| Question | Answer |
|---|---|
| Set one up, or point to a profile | Set one up with you. |
| Which reviews | Both. |
| Name and owner | Call it "Design review first-run test", owned by the Design review skills maintainers. |
| Design System Layers | Yes, that looks right. |
| Accessibility target | Yes, WCAG 2.2 AA. |
| Product context | Yes. |
| Review and save | Save it as a page in this file. |

End the prompt with "Don't save the report." Read the saved page back with the Profile Finder's page script, and compare it.

## The dead-link copy

DS-01-no-baseline needs the Design system baseline's default link to fail, whatever the live link returns, so it runs with a copy of the skills whose link points at a file that doesn't exist. The copy goes in `.scratch/` (a folder git ignores), and is installed into a scratch project or handed to the agent as its only skills:

```
rm -rf .scratch/no-baseline && mkdir -p .scratch/no-baseline && cp -R skills .scratch/no-baseline/skills
sed -i.bak 's#reference-documents/design-system-baseline.md#reference-documents/no-such-baseline.md#' .scratch/no-baseline/skills/design-review-library/SKILL.md
rm .scratch/no-baseline/skills/design-review-library/SKILL.md.bak
```

Then, in a scratch project, `npx skills add <this repo>/.scratch/no-baseline --all`. The run is the one in Running a case, with the profile given at run time and no baseline location. Delete the copy afterwards, so no other case reads it.

## Orchestrator checks

`/design-review` runs the Review Skills in `json only` mode from one shared scan, then merges their reports. These checks show that gives each axis the same results as its Review Skill on its own.

| Check | Set-up | Expected |
|---|---|---|
| Every case through `/design-review` | Each case above that has an expected file, run as `/design-review` with all reviews, the case's profile and its Reference Documents | Each passes its case with `--axis` set to the case's axis. The other axis's results on the frame aren't compared |
| One review named | A11Y-01 as `/design-review` with "just accessibility", and DS-01 with "just design system adherence" | Hands off to the Review Skill in `full report` mode, so each passes its case without `--axis`, as the Review Skill on its own does |
| One scan | Every run with two reviews | The scanner is used once for the run, one call per node and fact group, and no Review Skill scans |
| Unreadable profile | `/design-review` with a profile given at run time, a local path that doesn't exist | Stops after the lookup with the location and the reason. No question, no scan, no report |
| No review set up | X-01 as `/design-review` with "just research alignment", which the test profile doesn't set up | Stops before the scan, saying research alignment isn't set up and which reviews the profile covers. No report |

## Review Profile checks

Checked by hand in an external agent, on A11Y-01 unless the check names another case, because the JSON seam doesn't cover them. Each lookup step is reached only when the steps before it find nothing, so the checks marked "page off" rename the Review Profile page to `Review Profile (off)` for the run, and name it back afterwards.

| Check | Set-up | Expected |
|---|---|---|
| Given at run time | The page's link, or a file in `profiles/`, in the prompt, as in A11Y-01 and CLEAN-01 runs | No question. The report's `profile` and header name the profile |
| The file's page | No profile in the prompt | Asks whether to use the page's Accessibility section. On yes, `profile` names the page |
| A pointer in `AGENTS.md` | Page off. The project's `AGENTS.md` has `Review Profile: <path to profiles/smoke-test-profile.md>` | Asks whether to use it. On yes, `profile` names the file |
| No profile | Page off, and no pointer | Says why it's asking and asks what to check against. The header lists the answers under "Settings for this run", `profile` is null, and no profile is saved |
| No profile, design system adherence | DS-01 with `design-review-library`, page off, and no pointer | Runs the scan, then says why it's asking and asks which libraries make up the design system, most general first. The header lists the answers under "Settings for this run", `profile` is null, and the file has no "Review Profile" page afterwards |
| An unreadable pointer | Page off. `AGENTS.md` points to a file that doesn't exist | Stops with the location and the reason, and writes no report |
| An unreadable pointer on the page | Page off. A temporary page named `Review Profile` holds only `Review Profile: <link to a file with no Review Profile page>`, such as [DRS Test Unlisted](https://www.figma.com/design/8DhePf1jHSsrvwFxpiYoQf/DRS-Test-Unlisted). Delete it afterwards | Stops with the location and the reason, and writes no report |
| A critical override without a core task | [`profiles/override-critical.md`](profiles/override-critical.md) given at run time | Passes `A11Y-01`, and the header's Notes say the override wasn't applied |
| No Product context | A copy of the test profile without its Product context section, given at run time as a local file | No question. Passes `A11Y-01`, the header's Notes say every frame was measured as a web frame, and `run.settings.productContext` has `from: "default"` |

## Annotation checks

Checked by hand in an external agent, because they need something on the canvas that would change other cases if it stayed there.

| Check | Set-up | Expected |
|---|---|---|
| A free-text note on the canvas | A temporary text layer, "Alt text: IMG_2041.jpg", on the page 20 px below A11Y-04. Delete it afterwards | 1.1.1 `judged` from the note, and `accessibility/1.1.1/node:38:4` at `serious`, `likely`, since a file name isn't a text alternative and the judgement rests on a canvas note |

## Saving checks

Checked by hand in an external agent, because the JSON seam doesn't say where a report went. These are the runs that leave out "Don't save the report." The report page is the **Design review** page, where each saved report is a frame, newest first. Delete a check's frames once it has passed, and the page when it's empty, so the next check adds it again.

| Check | Set-up | Expected |
|---|---|---|
| The report page | A11Y-01 with the test profile's page link, and no Design review page in the file | Adds the Design review page with one frame, named `<date> · A11Y-01`. The chat's Saved line links to it. The frame's JSON, read back with the script below, passes `compare.mjs A11Y-01` |
| Newest first | Then CLEAN-01 the same way | Its frame is above the A11Y-01 frame, and first in the script's `frames`. The A11Y-01 frame hasn't moved |
| Don't save | A11Y-01-override, with "Don't save the report." | Passes `A11Y-01-override`. No frame is added, and the Saved line says "Not saved: you asked not to save this run." |
| A local folder | A11Y-01 with [`profiles/local-folder.md`](profiles/local-folder.md) given at run time | The report is saved as `reports/smoke-test/design-review-<date>-a11y-01.md` (a folder git ignores), and that file passes `compare.mjs A11Y-01`. No frame is added |
| Without edit access | A11Y-01, run by someone with view access to the test file | No frame is added. The chat's Saved line says the report is in the chat only, with Figma's error |
| An oversized report | The Figma Writer's frame script run by hand with a `REPORT` over 100 kB, such as one Finding whose `evidence` is `'x'.repeat(110000)` | The frame's last line says the JSON stayed in the chat, and the frame has no JSON |

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

## Layer annotation checks

Checked by hand in an external agent, because the JSON seam doesn't say what was written on the canvas. These runs ask for annotations, with "Annotate the layers." or [`profiles/annotate.md`](profiles/annotate.md), and still end with "Don't save the report." Read a frame's annotations back with the script below. Delete the review's annotations once a check has passed, so the case frames hold none.

| Check | Set-up | Expected |
|---|---|---|
| Marking Findings | A11Y-09 with the test profile and "Annotate the layers." | Passes `A11Y-09`. Body and the photo each hold one annotation in `Design review: Accessibility`, whose text starts with the Finding's short id. Body's Content annotation and the frame's heading annotation are as they were. The Annotated line says 2 Findings, with 2 annotations, and, in a file without the category, that the run added it |
| A fixed Finding | Then Body's fill set to `#5C5C5C` (6.86:1), and A11Y-09 run with `profiles/annotate.md` | Only the 1.1.1 Finding. Body holds only its Content annotation, and the photo one review annotation, not two. The Annotated line says 2 annotations from earlier reviews were cleared. Set Body back to `#8A8A8A` afterwards |
| A file holding review annotations | A11Y-04 with "Annotate the layers.", then again without it | Both pass `A11Y-04`: the review's annotation on the photo isn't read as its text alternative, and the facts count it in `excluded`. The second run has no Annotated line and leaves the annotation as it is |
| Another axis | DS-01, run with `design-review-library` and "Annotate the layers." | Passes `DS-01`. Raw swatch holds one annotation in `Design review: Design system adherence` |
| Without edit access | A11Y-01 with "Annotate the layers.", run by someone with view access to the test file | The Annotated line starts "Not annotated:", with Figma's error, and no annotation in the file changes |

To read the annotations back, run this through `use_figma` on the test file, with the case frame's id in `FRAME_ID`. It lists each layer in the frame that holds annotations, with each annotation's category and text.

```js
const FRAME_ID = '109:4067';
const frame = await figma.getNodeByIdAsync(FRAME_ID);
let page = frame;
while (page.type !== 'PAGE') page = page.parent;
await page.loadAsync();
const labels = new Map((await figma.annotations.getAnnotationCategoriesAsync()).map((c) => [c.id, c.label]));
const layers = [frame, ...frame.findAll()].filter((n) => 'annotations' in n && n.annotations.length);
return layers.map((n) => ({ id: n.id, name: n.name, annotations: n.annotations.map((a) => ({ category: labels.get(a.categoryId) || null, text: a.labelMarkdown || a.label || '' })) }));
```
