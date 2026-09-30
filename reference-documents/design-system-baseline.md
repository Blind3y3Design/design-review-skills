# Design system baseline

- Name: Design system baseline
- Version: 0.1

A Reference Document for `design-review-library`. It holds the built-in design system adherence checks: what triggers each one, how to judge it, and where its Findings start. The review skill holds only the procedure. Everything specific to a check lives here.

A team can fork this document to adjust the built-in checks, and point to its copy from the `Baseline` line of its Review Profile's Design System Layers section. A layer's rules document adds rules of its own on top of these.

This version holds one check, `raw-value`. Detached instances, overrides, resizing and assets outside the stack come in later versions.

## How an entry reads

Each check is a `###` heading with its id, a colon and its name, then these lines:

- **Facts:** the Design Facts groups it's judged from.
- **Trigger:** what in the design brings the check into play. With no trigger in the scope, Coverage gives `not-applicable`.
- **Default Severity:** where a Finding starts. Every built-in check is an unlocked deviation, so it starts at moderate unless a layer's rule says otherwise.
- **Certainty:** the Certainty of its Findings.

Under the lines, **How to judge** gives the test, what's a Finding, its Root Cause, and what its evidence and fix say.

## Checks

### raw-value: Raw value where a variable or style could be bound

- Facts: bindings
- Trigger: a layer in the scope with a fill, stroke, effect, corner radius, auto-layout padding or gap, or text
- Default Severity: moderate
- Certainty: confirmed

**How to judge.** Every raw value in the bindings facts is part of a Finding: a value set where a variable or style could be bound, and bound to neither.

- **Root Cause:**
  - For a layer in the facts' `raw` list, the layer. Give one Finding per layer, covering every raw value on it. This includes a value an instance overrides.
  - For a component in the facts' `inherited` list, the component (`component:<key>`), since its instances take the raw values from it unchanged. Give one Finding per component, with the component first in its locations and then the layers the facts list.
- **Evidence:** each raw value as `<property> <value>`, such as `fill #E0115F`, then "bound to no variable or style". For a layer inside an instance, add "overridden in the instance <name>". For a component, add how many raw values its instances hold, and in how many instances.
- **Fix:** for each raw value, "Bind the <property> to <token>", naming the token that the skill's token suggestions found, with its library. With several, name every one and ask the designer to pick. With none, "Bind the <property> to a variable or style from your design system", naming no token. For a component, the fix is made in the component: say so, and for a library's component (`remote`), that its library's owner makes it.
