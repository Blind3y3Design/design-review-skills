# WCAG 2.2 criteria reference

- Name: WCAG 2.2 criteria reference
- Version: 0.1
- Covers: WCAG 2.2, Levels A and AA

A Reference Document for `design-review-accessibility`. For each WCAG success criterion it gives what a design-stage review needs: whether the criterion can be judged from a design, what triggers it, how to judge it with its thresholds, and its default Severity. The review skill holds only the procedure. Everything specific to a criterion lives here.

W3C publishes no split of criteria into what a design, a prototype or code can show. The groups below are this repo's own analysis ([issue #5](https://github.com/Blind3y3Design/design-review-skills/issues/5)).

This version holds one criterion, 1.4.3. A criterion that isn't listed here isn't judged.

## How an entry reads

Each criterion is a `###` heading with its number and name, then these lines:

- **Level:** A, AA or AAA.
- **Since:** the WCAG version that added it. A criterion applies to a review whose target version is this or later, and whose target level is this level or higher.
- **Group:** `static` (judged from layers and their values), `annotation/prototype` (judged when the annotation or state exists), or `code` (never judged from a design: Coverage gives `needs-code`).
- **Facts:** the Design Facts groups the criterion is judged from.
- **Trigger:** what in the design brings the criterion into play. With no trigger in the scope, Coverage gives `not-applicable`.
- **Markers:** for criteria judged only in an explicitly marked section, the words that mark one. `none` otherwise.
- **Default Severity:** where a failure starts. Level A starts at serious, Level AA at moderate.
- **W3C:** the criterion in the WCAG 2.2 Recommendation, used as the Finding's `standard.url`.

Under the lines, **How to judge** gives the test and its thresholds, and what the evidence and fix say.

## Criteria

### 1.4.3 Contrast (Minimum)

- Level: AA
- Since: 2.0
- Group: static
- Facts: colourPairs
- Trigger: visible text in the scope
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#contrast-minimum

**How to judge.** Judge every colour pair in the Design Facts.

- **Threshold.** Normal text needs a contrast ratio of at least 4.5:1. Large text needs at least 3:1.
- **Large text** is at least 24 px, or at least 18.66 px with a font weight of 700 or more (18 pt, or 14 pt bold). Figma px are read as CSS px.
- **No rounding up.** Compare the ratio as the facts give it. 4.49:1 fails 4.5:1.
- **Fails:** a ratio below the pair's threshold.
- **Exceptions:** logotypes, and text in an inactive control or that is pure decoration, have no requirement. When a failing layer looks like one of these by its name or its component (such as `Logo` or `Disabled`), keep the Finding and give it `needs-review`, saying which exception may apply.
- **Evidence:** `<text colour> on <background colour> = <ratio>:1, needs <threshold>:1`, then the text size and weight, such as `#8A8A8A on #FFFFFF = 3.45:1, needs 4.5:1 (16 px, weight 400)`. Add any flag the facts give, and a token or style name when a colour came from one.
- **Fix:** raise the contrast of the text against its background to the threshold, by darkening or lightening the text colour or the background. Name a colour token only when the facts or the team's documents give one.

## WCAG 2.1 changes

No entries yet.

## AAA criteria judged from a design

No entries yet.
