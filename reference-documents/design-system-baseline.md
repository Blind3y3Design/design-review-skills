# Design system baseline

- Name: Design system baseline
- Version: 0.3

A Reference Document for `design-review-library`. It holds the built-in design system adherence checks: what triggers each one, how to judge it, and where its Findings start. The review skill holds only the procedure. Everything specific to a check lives here.

A team can fork this document to adjust the built-in checks, and point to its copy from the `Baseline` line of its Review Profile's Design System Layers section. A layer's rules document adds rules of its own on top of these.

This version holds six checks: `raw-value`, `outside-stack`, `unattributed`, `detached-instance`, `override` and `resize`.

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
  - For a layer in the facts' `raw` list, the layer. Give one Finding per layer, covering every raw value on it. This includes a value an instance overrides, unless the `override` check puts that change in one of its Findings: the override left the raw value, so one Finding covers both.
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

### detached-instance: Detached instance

- Facts: components
- Trigger: a frame in the scope, the scanned frame included
- Default Severity: moderate
- Certainty: confirmed

**How to judge.** Every frame in the components facts' `detached` list is a Finding. The frame's `detachedInfo` records the component it was detached from, so the Finding is `confirmed` from it, whatever was changed after detaching.

- **Root Cause:** the frame, `node:<id>`. Give one Finding per frame, with the frame first in its locations, then the component it came from (for a variant, its set's key and name), when the facts name one.
- **Evidence:** "Detached from `<component>`, as its detachedInfo records", naming the set and the variant, and the component's library as the skill's Attributing an asset gives it. When the component couldn't be read, give its key and the reason from the facts' `unread`. Then list the changes the facts' `overrides` give for instances inside the frame (their `detached` is the frame's id): they may have come with the component, so they belong to this Finding, not to `override`.
- **Fix:** "Replace this frame with an instance of `<component>`, then make the change through its properties." When the component can't give what the design needs, add "or ask the owner of `<component>` for a variant or property that does", naming its library's owner for a library's component.

### override: Direct override on a style property

- Facts: components, bindings
- Trigger: a component instance in the scope
- Default Severity: moderate
- Certainty: confirmed, or likely when the facts can't tell how a change was made

**How to judge.** A change in the components facts' `overrides` is part of a Finding when it's a direct change to a style property:

- its `property` is `fill`, `stroke`, `effect`, `radius`, `spacing`, `text`, `opacity` or `layout`, or `variables`, which changes bound variables on a property the facts can't name;
- it has no `through`: a change made through a component property (a variant, text, boolean or instance swap property), or one Figma carried over in a swap, is how the component is meant to be used;
- its entry has no `detached`: changes inside a detached frame belong to that frame's `detached-instance` Finding.

Changes to `size`, `content`, `visible`, `component` or `other` are never part of this check. Text content and swaps are ordinary use of a component, and a size is the `resize` check's.

- **Root Cause:** the changed layer, `node:<id>`. Give one Finding per layer, covering each of its changes that's part of a Finding. A raw value the bindings facts' `raw` list gives on that layer, for the same property, is part of this Finding, and not a `raw-value` Finding.
- **Certainty:** `confirmed`. When every change in the Finding has `uncertain`, or is to `variables`, it's `likely`, and the evidence gives the reason.
- **Evidence:** for each change, "`<property>` overridden in the instance `<instance>` of `<component>`", where `<component>` is the main component the entry's `instance.component` key names in the facts' `components`. Then what the layer has now, from the change's `values`: "now `<token>` (<library>)" for a variable or style, found by its key in the bindings facts' `variables` or `styles` and attributed as the skill's Attributing an asset describes, or "now `<value>`, bound to no variable or style" for a raw value. Name the swapped-in token whenever there is one.
- **Fix:** "Reset the `<property>` override on `<instance>`, so it takes `<component>`'s value." When the design needs the change, add "or ask the owner of `<component>` for a variant or property that gives it." It names no token to bind: resetting the override restores the component's own.

### resize: Resized instance

- Facts: components
- Trigger: a component instance in the scope
- Default Severity: moderate
- Certainty: confirmed

**How to judge.** A `size` change in the components facts' `overrides` is a Finding only when a layer's rules document sets that component's size, and the layer's size now (its `values`) breaks it. This document sets no sizes, so on its own a resize is never a Finding: Coverage gives `judged`, with no Findings.

A hugging instance takes a new size whenever its content changes, such as through a text property, so the facts list a `size` change for it too. Judge a size rule against the layer's size now, never against the change being listed.

- **Root Cause:** the resized layer, `node:<id>`, one Finding per layer.
- **Evidence:** the layer's size now and its component's, from `values`, and the rule's size.
- **Fix:** "Resize `<instance>` to `<size>`, as `<rule>` sets it."
