# Design system baseline

- Name: Design system baseline
- Version: 0.2

A Reference Document for `design-review-library`. It holds the built-in design system adherence checks: what triggers each one, how to judge it, and where its Findings start. The review skill holds only the procedure. Everything specific to a check lives here.

A team can fork this document to adjust the built-in checks, and point to its copy from the `Baseline` line of its Review Profile's Design System Layers section. A layer's rules document adds rules of its own on top of these.

This version holds three checks: `raw-value`, `outside-stack` and `unattributed`. Detached instances, overrides and resizing come in later versions.

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

### outside-stack: Asset from outside the Design System Layers

- Facts: bindings, components
- Trigger: a component instance placed in the scope, or a variable or style that a layer in the scope binds itself
- Default Severity: moderate
- Certainty: confirmed

**How to judge.** Attribute each asset the design uses itself, as the skill's Attributing an asset describes: each component with instances placed in the scope (`instances` above 0, counting a set's variants together), and each variable and style that layers bind themselves (`uses` above `inComponents`). An asset that instances take unchanged from their components, a nested instance, and a variable reached only through an alias come with their component or token, so they aren't judged here.

An asset attributed **outside the stack** is a Finding: one from a library that no layer lists, or a local one while no layer lists the reviewed file. With no layers settled, nothing can be outside the stack: Coverage gives `not-applicable`, with the note "no Design System Layers to check against".

- **Root Cause:** the asset, as `component:<key>` (the set's key for a variant), `style:<key>` or `variable:<key>`. Give one Finding per asset, with the asset first in its locations, then each layer the facts list as using it: the placed instances for a component, the `nodes` for a variable or style.
- **Evidence:** what the asset is and where it's from, then how many layers use it. For a library's asset: "`<name>` is from <library>, which no Design System Layer lists." For a local one: "`<name>` is a local <variable, style or component>, defined in this file, which no Design System Layer lists."
- **Fix:** for a library's asset, "Use one from your design system in its place, or list <library> as a layer's library in the Review Profile." For a local one, give all three choices: bind a stack token in its place, naming one only when the skill's token suggestions found one with the same value; list this file as one of a layer's libraries in the Review Profile; or propose `<name>` for a library.

### unattributed: Component or style that can't be attributed

- Facts: bindings, components
- Trigger: a library component placed in the scope, or a library style that a layer in the scope binds itself
- Default Severity: moderate
- Certainty: needs-review

**How to judge.** Of the assets the `outside-stack` check attributes, each library component or style left **unattributed** is a Finding: its library has no name in the facts, and its name starts with no layer's match hint. A person checks where it comes from. A layer's rules document and its Locked Rules apply only to assets attributed to a layer, so none is judged against an unattributed asset. With no layers settled, Coverage gives `not-applicable`, as for `outside-stack`.

- **Root Cause:** the asset, as `component:<key>` (the set's key for a variant) or `style:<key>`. Give one Finding per asset, with the asset first in its locations, then every use the facts list.
- **Evidence:** "`<name>` comes from another file, but its library couldn't be named: <the reason in the facts' `unread`>. Its name starts with no layer's match hint." Then how many uses it has, saying how many more there are than the locations list.
- **Fix:** "Add this component to a library, or list its library in the Review Profile." For a style, "Add this style to a library, or list its library in the Review Profile."
