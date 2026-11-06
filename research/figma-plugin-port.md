# Porting the review to a Figma plugin to cut token cost

Researched 2026-11-06, as a read-only design study. Running the skills through an LLM agent (Figma Design's agent, or Claude Code, Codex or Cursor through the Figma MCP server) is becoming a constraint on price and token use. This note asks how the same review could run as a custom plugin on a file. It builds on [plugin-vs-skills-opus.md](plugin-vs-skills-opus.md) and [plugin-vs-skills-fable.md](plugin-vs-skills-fable.md) and on ADR 0006, which ruled a plugin out as the reviewer because judgement needs an LLM. What's new here is cost as the reason to look again, and a split of the review by what really needs judgement. Token savings below are estimates, not measurements.

## Answer

Move every rule-based check into plain code, which costs no tokens, and keep an LLM only for what's left to judge. The recommended shape is a hybrid (b below). A private org plugin runs the scan, the deterministic checks and the report. A slim agent skill then judges only a small payload of what remains, and runs research alignment. Write the deterministic checks once, as a module that both the plugin and the skills can run (c below), so the agent path gets cheaper too. Start with a spike on design system adherence, which is fully rule-based, and measure the pass rate and the tokens before changing any ADR.

## Verified facts

- A plugin calls `fetch` directly, with a `null` origin, so it can only reach endpoints that send `Access-Control-Allow-Origin: *`. Domains are listed in `manifest.networkAccess.allowedDomains`: `["none"]` blocks all of them, `*` needs a `reasoning`, and any domain not listed is blocked by CSP ([Figma: network requests](https://developers.figma.com/docs/plugins/making-network-requests/)).
- `raw.githubusercontent.com` and `api.github.com` both answer `Origin: null` with `access-control-allow-origin: *` (checked with curl). So a plugin can fetch public Reference Documents pinned to a tag. A private repo needs a token, and a plugin can't keep one secret.
- `figma.teamLibrary` reads variables only, and only from libraries enabled in the file. It needs the `teamlibrary` permission ([Figma: teamLibrary](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/)). Component and style libraries can't be named in a plugin, except by name-prefix hints.
- Private organization plugins need an Organization or Enterprise plan. They skip Figma's review, and guests can't run them ([Help Center](https://help.figma.com/hc/en-us/articles/4404228629655-Create-private-organization-plugins)).
- What an agent loads today: the 14 skills come to about 260 KB and the two Reference Documents to about 64 KB. The six scanner scripts are sent as tool input on every run, and each fact group returns up to about 18,000 characters per frame.

## What needs judgement, and what doesn't

**Rule-based, so plain code with no tokens:**

- All six baseline checks: `raw-value`, `outside-stack`, `unattributed`, `detached-instance`, `override` and `resize`. They test the bindings and components facts against the parsed Design System Layers.
- Attribution (by key, local, or match hint), token suggestions and Severity Overrides.
- The structured lines of a layer's rules document: `Locked`, `Allowed overrides`, `Size` and `Preferred tokens`.
- The numeric WCAG checks:
  - contrast, 1.4.3 and 1.4.6, whose ratios the colour pairs script already computes, with no rounding up;
  - non-text contrast, 1.4.11, once an element is known to be a control or graphic;
  - target size, 2.5.8 and 2.5.5, including the spacing exception and the density rule;
  - link colour, 1.4.1, from the run's colour, decoration and weight;
  - focus indicators, 2.4.7, from a focus variant's fills, strokes and effects against its default;
  - consistent navigation, 3.2.3, from the order of repeated items.
- Coverage bookkeeping: which criteria apply at a version and level, `needs-code`, `needs-section` and markers, `needs-state`, and whether an annotation is present, which drives `needs-annotation` and missing-annotation Findings.
- The Report Writer and Figma Writer side: Finding ids, the report JSON (`schemaVersion` 0.2), the Markdown from templates, report frames and annotations.

**Needs an LLM:**

- Wording tests: instructions (1.3.3), link purpose (2.4.4), headings and labels (2.4.6), labels (3.3.2, partly), the same function labelled differently (3.2.4), and words in an image read from layer names (1.4.5).
- Annotation meaning: an annotation's kind from free text, whether a text alternative conveys the purpose (1.1.1), and the rest of the annotation and prototype criteria, such as 1.3.1, 2.4.3, 2.5.3 and the error states of 3.3.1 and 3.3.3.
- Classifying triggers: what counts as a pointer target, an interactive component, a meaningful icon, or a logo or disabled exception. Today the LLM reads names. A plugin would need heuristics from `reactions`, component names or a list in the profile.
- Free-text `Statement` rules in a rules document.
- Reflow (1.4.10), which compares layouts visually.
- All of research alignment, which also needs the Dovetail connector.
- Rewording the prose.

## Options

| | What runs where | Token cost | What's lost |
|---|---|---|---|
| **(a) Plugin only** | Every rule-based check in the plugin. What needs judgement gets a Coverage status saying it wasn't judged here, which changes the schema | None | Research alignment; every judgement criterion; the profile lookup through `AGENTS.md` or GitHub; Claude Code, Codex and Cursor. Component and style libraries rest on match hints only (`likely`) |
| **(b) Hybrid (recommended)** | The plugin runs (a) and saves its Findings, its Coverage and a compact **judgement payload** on the report page as shared plugin data. A slim "judge" skill reads the payload through `use_figma` or `evaluate_script`, judges only that, runs research alignment, and merges through the Report Writer | Estimated 60–80% lower: no scanner scripts, raw facts or library judging go through the LLM, only the judge skill and its payload | Little. External agents can still run today's full path or the judge skill. The run takes two steps, and the payload must be split to fit `use_figma`'s read limit of about 20 kB |
| **(b′) Plugin calling an LLM through an org proxy** | The plugin sends the payload to a model through a server the org runs | Same as (b) | Needs a server and a key, sends design data out of Figma, breaks the GitHub-or-Figma-only rule, and still loses research unless the proxy also calls Dovetail. Not recommended |
| **(c) One check engine, two hosts** | The rule-based checks written once as a plain JavaScript module (Design Facts in, Findings and Coverage out), run in the plugin and as one more fixed script inside the skills | Cuts the agent path's judging work even before anyone adopts the plugin | Nothing; it's the natural companion to (b) |

For every option the Review Profile is read from the "Review Profile" page, whose `- Key: value` lines can be parsed. A plugin can fetch Reference Documents with `allowedDomains: ["raw.githubusercontent.com"]`, but their "How to judge" prose isn't executable, so the rules must also ship as code or data.

## What carries over from the repo

- **The scanner scripts** use only `figma.*`, so they run in a plugin's main thread almost unchanged: wrap each in an async function and turn its node-id constant into a parameter. Their output-size limits become harmless overhead.
- **One source for the scripts:** a plugin build can pull the scripts out of each `SKILL.md`, as `tests/scripts/skill-script.mjs` does, so the skills stay the single source.
- **Tests:** the tests against the fake Plugin API, `design-facts.test.mjs` included, carry over as they are.
- **Smoke tests:** `tests/smoke/expected/*.json` and `compare.mjs` become the test suite for the check engine. The DS cases and the numeric A11Y cases can run in Node against recorded Design Facts.
- **Formats:** the report JSON and the Figma Writer's frame, annotation and profile-page scripts carry over.

**What has to change:**

- The baseline's and the WCAG reference's "How to judge" prose has to also exist as code and data: thresholds, triggers, markers, Needs kinds, Severity, and templates for evidence and fixes.
- A parser for the Review Profile and one for rules documents.
- A Coverage status for "left for the agent to judge", which bumps `schemaVersion`.
- Each rule then has two sources of truth, prose and code, which need a test that keeps them in step.

## ADRs affected

- **0006:** supersede it. A plugin becomes an allowed reviewer for the rule-based checks, never the one that judges.
- **0001 and 0007:** amend them for a built plugin beside the single-file skills.
- **0003, and 0007's Reference Documents read by URL:** amend them for rules shipped as data.
- **0008:** amend it for where the scripts live.
- **0009 and 0011:** extend the public contract and the publishing steps to cover the plugin.
- **0005:** add cost as a reason for the change.

## Next step

A spike: build the check engine for design system adherence only. Run it in Node on recorded Design Facts against the DS-* expected JSON with `compare.mjs`, then wrap it in a private org plugin on the smoke-test file. Measure the pass rate, and today's token use against the hybrid's on one real file.

## Risks

- Wrong guesses when code decides what counts as a button, target or meaningful image.
- The prose and code versions of a rule drifting apart.
- Weaker component and style attribution inside a plugin.
- The Organization or Enterprise plan requirement, and guests being unable to run it.
- Someone has to own and maintain the plugin.
- The hybrid's two-step run.
