# Which WCAG 2.2 success criteria can be judged from a static design?

Research for [issue #5](https://github.com/Blind3y3Design/design-review-skills/issues/5). Researched 2026-09-29.

## Answer in brief

Of the 55 WCAG 2.2 Level A and AA success criteria, 12 can be judged from a static Figma design (layers, styles, screenshots). Two more can be judged when the right frames or variants exist (a 320 px frame for 1.4.10, focus variants for 2.4.7). Another 33 can be judged at design time only if the design has **annotations** (such as reading order, alt text, headings, accessible names) or **prototype states** (hover, focus, error or timeout). The last 8 can only be checked against rendered code. axe-core automates part of the code-side checks, mostly names, roles, language and structure. Figma's AI accessibility checker covers a small part of the static group: contrast, legibility, target size, colour-blindness and "missing structure". The practical way to run axe-core is on rendered output: a published Figma Make app, a Make code download, or code generated through the Figma MCP server. axe-core cannot read a Figma file.

## Confirmed facts

- WCAG 2.2 has **31 Level A and 24 Level AA** success criteria. 4.1.1 Parsing is "obsolete and removed". Source: [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) (counted from the spec's `conformance-level` markers).
- 2.5.8 Target Size (Minimum) requires targets of at least 24 by 24 CSS pixels. It has a spacing exception (a 24 px circle around each target must not overlap another target or its circle) and exceptions for inline, user-agent, equivalent and essential targets. Source: [Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- W3C's design-stage guidance ([Designing for Web Accessibility tips](https://www.w3.org/WAI/tips/designing/)) maps design work to these criteria: 1.4.3 contrast, 1.4.1 use of colour, 2.4.7 and 3.2.4 identifiable interactive elements, 3.2.3 and 2.4.5 navigation, 3.3.2 and 2.4.6 form labels, 3.3.1–3.3.3 feedback, 2.4.6 headings, 1.1.1 image alternatives, and 1.4.2 and 2.2.2 controls for auto-playing content. It also covers viewport sizes. This is W3C's own list of the criteria designers own.
- **axe-core** (rule list for v4.13, [rule-descriptions.md](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)) tests the DOM. Many of its rules return "needs review" as well as "failure". Its **WCAG 2.2 rules, currently only `target-size` (2.5.8), are disabled by default** "until WCAG 2.2 is more widely adopted and required". Experimental rules are also disabled by default: `css-orientation-lock` (1.3.4), `label-content-name-mismatch` (2.5.3), and `p-as-heading`, `table-fake-caption` and `td-has-header` (1.3.1).
- Deque says its automated tests found **57.38% of issues by volume** across roughly 13,000 pages and 300,000 issues. It also acknowledges that coverage measured by number of success criteria is much lower (the "20–30%" figure). Source: [Deque automated coverage report](https://www.deque.com/automated-accessibility-coverage-report/).
- **Figma AI accessibility checker** ([figma.com](https://www.figma.com/solutions/ai-accessibility-checker/)): in open beta, on paid plans, and uses no AI credits during the beta. It runs through the agent in Figma Design on a selected frame, component or screen. It checks "contrast ratios, text legibility, touch targets, and color blindness issues" and missing structure or labels for screen readers. Figma says it is "less reliable for contextual issues that require human judgment". The page names no WCAG version or level and does not mention prototypes or code.
- **Figma Make** code can be downloaded as a .zip ("Download code", Full or Dev seat). Its main file is `App.tsx`, a React/TypeScript project. Source: [Figma help: Edit the code of a functional prototype or web app](https://help.figma.com/hc/en-us/articles/33649966245783-Edit-the-code-of-a-functional-prototype-or-web-app).
- **Figma MCP server**: `get_design_context` returns React + Tailwind code by default (the framework can be changed in the prompt). `get_screenshot` returns a PNG, `get_metadata` returns sparse XML (IDs, names, types, positions, sizes) and `get_variable_defs` returns the variables and styles used. Make files can be brought in as MCP resources. Source: [Figma MCP tools and prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/), [Make → MCP](https://developers.figma.com/docs/figma-mcp-server/bringing-make-context-to-your-agent/).

## Uncertain or unverified

- The classification below is **my analysis** of each criterion's normative text and Understanding document. W3C does not publish a design, prototype and code split. Several criteria are hybrids, so each row gives the *earliest* stage at which a reviewer can give a real pass or fail and notes the rest.
- Figma does not say which WCAG thresholds its checker uses. For example, it is unknown whether "touch targets" means 24 px (2.5.8 AA), 44 px (2.5.5 AAA) or platform guidance. Treat its results as advisory until this is tested against known cases.
- Whether Make's hosted "Publish" URL is reachable by a headless browser, and so by axe, was not confirmed from a Figma primary source. A third-party tutorial describes publishing but was not used as evidence.
- Whether the MCP Make resources expose raw source files, or only component and style context, is unclear from Figma's docs.
- Measuring 2.5.8 and 1.4.10 from frames assumes 1 Figma px = 1 CSS px. That holds for web frames at 1x, but it is a convention and not guaranteed.

## Classification of WCAG 2.2 A and AA criteria

Key:
- **S** (static): can be judged from layers, styles and screenshots alone.
- **A/P** (annotations or prototype): needs designer annotations (reading order, alt text, names, language, autocomplete, keyboard behaviour) or prototype states and flows (hover, focus, error, timeout, motion).
- **C** (code only): needs rendered code in a browser or with assistive technology.
- *axe*: axe-core rules tagged to the criterion (\* = experimental or disabled by default).

| SC | Name | Lvl | Class | Why / what a design review can do | axe rules |
|---|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | A/P | Static review can list images and icons that need alternatives and spot decorative ones. The alt text itself must be annotated. | image-alt, svg-img-alt, role-img-alt, input-image-alt, object-alt |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | A/P | The media content is not in the design. Annotate the transcript or alternative. | — |
| 1.2.2 | Captions (Prerecorded) | A | A/P | Design can show caption controls. Caption presence and quality are content or code checks. | video-caption |
| 1.2.3 | Audio Description or Media Alternative | A | A/P | Annotation of description or alternative. | — |
| 1.2.4 | Captions (Live) | AA | C | Runtime only. | — |
| 1.2.5 | Audio Description (Prerecorded) | AA | A/P | Annotation. | — |
| 1.3.1 | Info and Relationships | A | A/P | Visual structure (headings, lists, tables, groups) is visible in the design, but its programmatic form needs heading, landmark and table annotations. Verify in code. | list, listitem, definition-list, dlitem, td-headers-attr, th-has-data-cells, aria-required-children/parent, p-as-heading\* |
| 1.3.2 | Meaningful Sequence | A | A/P | Needs a reading-order annotation. Layer order is not a reliable proxy. | — |
| 1.3.3 | Sensory Characteristics | A | **S** | Instruction copy ("click the round button on the right") is visible in the design. | — |
| 1.3.4 | Orientation | AA | A/P | Check whether landscape and portrait frames exist or are annotated. Orientation locking is a code check. | css-orientation-lock\* |
| 1.3.5 | Identify Input Purpose | AA | A/P | Annotate autocomplete purpose on user-data fields. | autocomplete-valid |
| 1.4.1 | Use of Color | A | **S** | Colour-only cues can be seen in the design, for example links, error states, charts and status indicators. | link-in-text-block |
| 1.4.2 | Audio Control | A | A/P | Autoplay behaviour and controls must be annotated or prototyped. | no-autoplay-audio |
| 1.4.3 | Contrast (Minimum) | AA | **S** | Compute from fills and text styles. Text over images or gradients needs pixel sampling from a screenshot. | color-contrast |
| 1.4.4 | Resize Text | AA | C | Needs browser zoom to 200%. Static review can only flag risks such as fixed-height text containers. | meta-viewport |
| 1.4.5 | Images of Text | AA | **S** | Text inside raster or vector images can be seen as image layers containing words. | — |
| 1.4.10 | Reflow | AA | **S** if 320 px frames exist, else C | Judge from a 320 CSS px wide frame if one is supplied. Otherwise it needs rendered code. | — |
| 1.4.11 | Non-text Contrast | AA | **S** | Borders, icons, focus rings and control boundaries can be computed from fills. State variants must exist in the design. | — (color-contrast covers text only) |
| 1.4.12 | Text Spacing | AA | C | Needs spacing overrides applied in a browser. Static review can flag fixed-height text boxes. | avoid-inline-spacing |
| 1.4.13 | Content on Hover or Focus | AA | A/P | Needs tooltip and popover behaviour (dismissable, hoverable, persistent) from prototype or annotation. | — |
| 2.1.1 | Keyboard | A | C | Operability is a runtime property. Annotate keyboard interactions for custom widgets. | scrollable-region-focusable, frame-focusable-content, server-side-image-map |
| 2.1.2 | No Keyboard Trap | A | C | Runtime. | — |
| 2.1.4 | Character Key Shortcuts | A | A/P | Annotate any single-key shortcuts and how to turn them off or remap them. | — |
| 2.2.1 | Timing Adjustable | A | A/P | Annotate time limits and warning or extend flows (prototype the warning screen). | meta-refresh |
| 2.2.2 | Pause, Stop, Hide | A | A/P | Moving or auto-updating content: needs a prototype or annotation. Pause controls are visible statically. | blink, marquee |
| 2.3.1 | Three Flashes or Below Threshold | A | A/P | Only visible in prototype animation or video, and confirmed in code. | — |
| 2.4.1 | Bypass Blocks | A | A/P | Skip link or landmarks need annotation. | bypass |
| 2.4.2 | Page Titled | A | A/P | Page `<title>` needs annotation. | document-title |
| 2.4.3 | Focus Order | A | A/P | Needs a focus-order annotation. | — |
| 2.4.4 | Link Purpose (In Context) | A | **S** | Link text and its surrounding context are visible in the design. Annotate if the accessible name differs from the visible text. | link-name, area-alt |
| 2.4.5 | Multiple Ways | AA | A/P | A site-level property. Needs several screens or a flow (search, sitemap, navigation). | — |
| 2.4.6 | Headings and Labels | AA | **S** | Whether headings and labels are descriptive can be judged from the copy. | — |
| 2.4.7 | Focus Visible | AA | **S** if focus variants exist | Judge from focus-state variants. If none exist, report a gap. Confirm in code. | — |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | A/P | Needs sticky headers, footers or overlays shown together with focused items (prototype scroll). Confirm in code. | — |
| 2.5.1 | Pointer Gestures | A | A/P | Annotate multipoint or path gestures. A single-pointer alternative can be seen statically. | — |
| 2.5.2 | Pointer Cancellation | A | C | Down- versus up-event behaviour is only in code. | — |
| 2.5.3 | Label in Name | A | A/P | Compare the visible label with the annotated accessible name. | label-content-name-mismatch\* |
| 2.5.4 | Motion Actuation | A | A/P | Annotate shake or tilt features and their UI alternative. | — |
| 2.5.7 | Dragging Movements | AA | A/P | Drag interactions come from prototype or annotation. Check that a visible non-drag alternative exists. | — |
| 2.5.8 | Target Size (Minimum) | AA | **S** | Measure target bounds and spacing in the frame. Inline and essential exceptions need judgement. | target-size\* (disabled by default) |
| 3.1.1 | Language of Page | A | A/P | Annotate the page language. | html-has-lang, html-lang-valid, html-xml-lang-mismatch |
| 3.1.2 | Language of Parts | AA | A/P | Other-language passages are visible statically. The `lang` markup needs annotation. | valid-lang |
| 3.2.1 | On Focus | A | A/P | Prototype or annotation of focus behaviour. Confirm in code. | — |
| 3.2.2 | On Input | A | A/P | Prototype or annotation (for example, a select that auto-submits). | — |
| 3.2.3 | Consistent Navigation | AA | **S** (multi-screen) | Compare navigation order across frames. | — |
| 3.2.4 | Consistent Identification | AA | **S** (multi-screen) | Compare icons and labels for the same function across frames. Component instances help. | — |
| 3.2.6 | Consistent Help | A | **S** (multi-screen) | Compare where help appears across frames. | — |
| 3.3.1 | Error Identification | A | A/P | Needs error-state frames or variants. Once those exist, the error copy and styling can be judged statically. | — |
| 3.3.2 | Labels or Instructions | A | **S** | Visible labels and instructions on inputs. Placeholder-only labels are flagged. | label, select-name (code-side name) |
| 3.3.3 | Error Suggestion | AA | A/P | Needs error-state frames, then judge the copy. | — |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | A/P | Needs a flow showing review, confirm or undo steps. | — |
| 3.3.7 | Redundant Entry | A | A/P | Needs a multi-step flow. | — |
| 3.3.8 | Accessible Authentication (Minimum) | AA | A/P | Auth flow design (puzzles, transcription) is visible. Paste and password-manager support needs annotation or code. | — |
| 4.1.2 | Name, Role, Value | A | C | Programmatic. Design can annotate role, name and state for custom components. | button-name, link-name, label, aria-\* rules, nested-interactive, frame-title, and more |
| 4.1.3 | Status Messages | AA | C | Live-region behaviour. Design can annotate which messages are status messages. | — |

Counts:
- **S**: 12 core criteria (1.3.3, 1.4.1, 1.4.3, 1.4.5, 1.4.11, 2.4.4, 2.4.6, 2.5.8, 3.3.2, and the multi-screen 3.2.3, 3.2.4, 3.2.6).
- **S if the right frames or variants exist**: 2 more (1.4.10 with 320 px frames, 2.4.7 with focus variants).
- **A/P**: 33.
- **C**: 8 (1.2.4, 1.4.4, 1.4.12, 2.1.1, 2.1.2, 2.5.2, 4.1.2, 4.1.3). Many A/P rows also need a final check in code.

## Implications for the Review Skill

1. **Core (all environments, no scripts):** fully judge the S rows. For A/P rows, check that the annotation or state exists, judge it if it does, and report "not assessable: missing annotation or state" if it does not. For C rows, output "defer to code testing" rather than a verdict.
2. **Figma agent:** the built-in checker overlaps with 1.4.3, 1.4.11, 2.5.8, 1.4.1 and part of 1.3.1. The skill should add to it with the copy, consistency and annotation checks rather than repeat it, and should state its own thresholds (24 px for AA 2.5.8).
3. **External agent add-on (axe-core):** axe-core runs against rendered pages. Realistic routes:
   - (a) Run axe with Playwright or Puppeteer against a published Figma Make app (reachability unconfirmed).
   - (b) Take Figma Make's "Download code" React project, run it locally (the project appears to use Vite, per third-party reports; unverified), and run axe on it.
   - (c) Render the React + Tailwind output of MCP `get_design_context` in a harness and run axe.

   For routes (b) and (c), results show the accessibility of the *generated code*, not the design. Most DOM-level failures (names, roles, lang) will come from how the code was generated. Enable the `wcag22aa` tag or turn on `target-size` explicitly, because it is off by default.
