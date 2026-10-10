---
name: design-review-scanner
description: Reads Figma frames and returns the Design Facts a calling review asks for, colour pairs, text, structure, annotations, and bindings and components with their libraries named, for the other design review skills, which invoke it. It orchestrates six scanning skills, one per fact group. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-alpha.4"
---

# Design Scanner

Version 0.1.0-alpha.4 of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

The scan is one read of one scope, and each fact group comes from one scanning skill that runs one fixed script, tested as written, so every review reads a file the same way. Six scanning skills read the six groups: `design-review-scanner-colour-pairs` reads `colourPairs`, `design-review-scanner-text` reads `text`, `design-review-scanner-structure` reads `structure`, `design-review-scanner-annotations` reads `annotations`, `design-review-scanner-bindings` reads `bindings`, and `design-review-scanner-components` reads `components`. A caller asks this skill for the groups it needs, and this skill runs a scanning skill for each, joins their results per node, and returns one result per node. This skill only reads: finding the Review Profile is the job of `design-review-profile`, and writing to the file is the job of `design-review-figma-writer`.

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs, each read by one scanning skill: `colourPairs`, with The colour pairs script, `text`, with The text script, `structure`, with The structure script, `annotations`, with The annotations script, `bindings`, with The bindings script, and `components`, with The components script.
- **Annotation kits,** optionally, for the `annotations` group: the kits whose instances count as annotations, each named by what its components' names start with, such as `A11y annotations/`.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Check the scanning skills.** For each fact group asked for, check that its scanning skill is available. If one isn't, reply with only the line that fits, and stop: "The Design Scanner can't read `<group>`: the skill `<scanning-skill>` isn't installed. Install it, then run the review again." If several aren't, name each. A group a caller didn't ask for needs no scanning skill.
2. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
3. **Scan each node id.** For each fact group asked for, use its scanning skill, handing it the node id, the runtime and, for `annotations`, the annotation kits. Run one call per id and group, in parallel where the runtime allows. A scanning skill that can't run its script tells you, and you record the id, the group and its error message in that result's `unread`.
4. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of running the same group's scanning skill on each of those ids.
5. **Record groups you can't read.** For each fact group the caller asked for that has no scanning skill, add `{ "what": "<group>", "reason": "not read by any scanning skill" }` to every result's `unread`.
6. **Name the libraries of components and styles.** The bindings scanning skill names each library variable's library, but the Plugin API has no lookup for components or styles, so its script leaves their `library` null. Name them by key with the Figma MCP server's `get_libraries` and `search_design_system` tools. Without those tools, as inside Figma Design's agent, do only 6.1 and 6.4.
   1. List the remote assets the design uses itself, across all the results, each once: each component set or component in `components.components` with `remote: true` and either `instances` above 0 or its key among the components in `bindings.inherited`, counting a set once however many of its variants appear, the `source` of each frame in `components.detached` with `remote: true`, and each style in `bindings.styles` with `remote: true` and `uses` above `inComponents`. Any other asset comes only inside an instance and belongs with that instance's component, so it isn't looked up. Keep the first 20, in the order they first appear. With none, this step is done.
   2. Call `get_libraries` once, with the file key. Keep the `libraryKey` of each library in `libraries_added_to_file`.
   3. For each asset you kept, call `search_design_system` with the file key, `includeLibraryKeys` set to the kept library keys, and one query: `entity` `component` (for a set too) or `style`, and `query` the asset's name, or its set's name for a variant. Find the result whose key is the asset's: `componentKey` against the set's key for a variant, or else the component's key, and `key` for a style. Set the asset's `library` to that result's `libraryName`, in every result that holds the asset. Never take a library from a name that matches without its key.
   4. In each result that still holds one of the assets listed in step 6.1 with no `library`, add `{ "what": "component and style libraries", "reason": "no library name for <n> components and styles: <why>" }` to its `unread`. The why is "`search_design_system` didn't find their keys among the libraries added to this file", "the lookup stops at 20 assets per scan", or, without the tools, as inside Figma Design's agent, "this runtime has no library lookup for components and styles". Give each reason that applies.

The scan is done when every id in the scope has a result for every fact group asked for, every asset listed in step 6.1 has a `library` or is counted in its result's `unread`, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, with `"runtime"` added. When several groups were read on a node, merge their results into one: `factsVersion`, `fileKey` and `scope` from any of them, their `groups` and their `unread` joined, and each group's field from the scanning skill that read it. Pass the values on as the scanning skills returned them, with the libraries step 6 named.

## Design Facts format

`factsVersion` 0.5. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame, which is a frame on the page or directly in a Figma section. A frame in a section is its own top-level frame, and the section is not one. Null for an id with no node.
- `groups`: the fact groups read. It is empty when the node couldn't be read at all.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead. A node that isn't there, or is hidden or at zero opacity, or sits under a layer that is, gives no facts: `groups` is empty and `unread` holds one entry whose `what` is its id.
- One field per group read, `colourPairs`, `text`, `structure`, `annotations`, `bindings` or `components`, as its scanning skill returned it. Each group's shape is described by the scanning skill that reads it, named above.

Positions and sizes are in Figma px. `x` and `y` are measured from the top-level frame's top-left corner, and every `path` starts at the top-level frame.