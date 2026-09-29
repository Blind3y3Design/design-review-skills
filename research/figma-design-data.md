# What design data can a skill read in Figma's agent versus the Figma MCP server?

Research for [#3](https://github.com/Blind3y3Design/design-review-skills/issues/3). Researched 2026-09-29 against Figma's help center, developers.figma.com, the Figma Plugin API typings, and the skills shipped by the Figma MCP server (`skill://figma/...`, mirrored in [figma/mcp-server-guide](https://github.com/figma/mcp-server-guide)).

## Short answer

- **External agents via the Figma MCP server** can read nearly everything a design review needs. The key is `use_figma`, which runs arbitrary Plugin API JavaScript against the file and can read node properties, `mainComponent` / `remote` / `key`, `detachedInfo`, `boundVariables`, style ids, `annotations`, `reactions` and the team-library variable catalogue. The read tools (`get_design_context`, `get_metadata`, `get_variable_defs`, `get_screenshot`, `get_libraries`, `search_design_system`) add code-shaped context, screenshots and library search.
- **Figma's agent** (Figma Design) reads the open file's layers, selection, components, styles, variables, connected libraries and comments. Figma does not document its internal tool surface. There is no documented way for a custom skill to run Plugin API code or call named tools, so a skill can only tell the agent in prose what to inspect.
- **Figma Make** works on a code project. A skill there sees whatever design context the user attaches (pasted layers or frame links) plus Make kit styles/variables extracted as CSS. It is not a node-inspection environment.
- **Library attribution is only partly direct.** Variables resolve to a library *name* (`figma.teamLibrary` → `libraryName`). Components and styles expose only `remote: true` plus a `key`. Mapping a key to a named library needs `search_design_system` / `get_libraries` or the REST API (`file_key`).

## Sources

| # | Source | Kind |
|---|---|---|
| S1 | [Custom skills for the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/40283639496599-Custom-skills-for-the-Figma-agent-and-Figma-Make) | Figma help |
| S2 | [Work with the Figma agent in design files](https://help.figma.com/hc/en-us/articles/37998629035799-Work-with-the-Figma-agent-in-design-files) | Figma help |
| S3 | [Best practices to help Figma AI understand your design system](https://help.figma.com/hc/en-us/articles/38978644498199) | Figma help |
| S4 | [Attach files to a prompt in the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/31304529835671) | Figma help |
| S5 | [Check designs in Figma](https://help.figma.com/hc/en-us/articles/39592284074263-Check-designs-in-Figma) | Figma help |
| S6 | [Bring style context from a Figma Design library into Figma Make](https://help.figma.com/hc/en-us/articles/33024539096471) | Figma help |
| S7 | [MCP server: Tools and prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) | Figma developer docs |
| S8 | [MCP server: Create skills](https://developers.figma.com/docs/figma-mcp-server/create-skills) | Figma developer docs |
| S9 | [MCP server: Plans, access and permissions](https://developers.figma.com/docs/figma-mcp-server/plans-access-and-permissions/) | Figma developer docs |
| S10 | Plugin API typings `plugin-api-standalone.d.ts`, shipped in [figma-use references](https://github.com/figma/mcp-server-guide/tree/main/skills/figma-use/references) | Figma source |
| S11 | `figma-use` and `figma-generate-design` skills (`skill://figma/...`) | Figma MCP skills |
| S12 | Figma MCP tool schemas (`get_metadata`, `get_libraries`, `search_design_system`, `use_figma`), inspected via ToolSearch | Figma MCP server |
| S13 | [REST API component and style types](https://developers.figma.com/docs/rest-api/component-types/) | Figma developer docs |
| S14 | Figma blog: [The Figma agent is here](https://www.figma.com/blog/the-figma-agent-is-here/) (2026-05-20), [Custom tools, context and skills](https://www.figma.com/blog/agent-custom-tools-context-skills/) (2026-06-24) | Figma blog |

## Runtimes at a glance

| | Figma agent (Figma Design) | Figma Make | External agent + Figma MCP server |
|---|---|---|---|
| Skill format | Single `.md` file (Agent Skills spec). No `scripts/`, `references/`, `assets/` [S1] | Same. Standalone file only [S1] | Full `SKILL.md` folder; client-specific path [S8] |
| How the skill reaches data | Prose instructions to the agent. Internal tools not documented | Prose instructions. Works over the Make code project + attachments [S4, S6] | Calls named MCP tools, including `use_figma` (Plugin API JS) [S7, S11] |
| Access requirements | Paid plans for skills; edit access needed for edits; View/Dev/Collab seats can chat but not edit [S1, S2] | Paid plans [S1] | Only catalogued MCP clients. Starter / View / Collab: 6 tool calls a month. Full/Dev seats: 200/day (Pro/Org), 600/day (Enterprise), plus per-minute limits [S9] |
| Other connectors | MCP connectors (Notion, Drive, GitHub…) usable from skills [S1, S14] | Same [S1] | Whatever the client has |

## Data, item by item

### Node properties

- **MCP:** `get_metadata` returns an XML outline (ids, types, names, position, size) for a node or page, or the page list when no node is given [S12]. `get_design_context` returns React + Tailwind reference code, a screenshot and metadata for a node [S7]. `use_figma` exposes the full Plugin API: fills, strokes, effects, auto layout, text segments (`getStyledTextSegments`), `boundVariables`, `fillStyleId` / `textStyleId` / `effectStyleId`, `inferredAutoLayout` and so on [S10, S11].
- **Figma agent:** reads layer and component names, auto layout, component properties and variants, and component, variable and style descriptions [S3]. It can select and modify layers ("select all primary buttons") [S2]. Figma does not say whether it sees raw property values or a summary.

### Component instances and their library

- **MCP / Plugin API (confirmed):** `InstanceNode.getMainComponentAsync()` returns the main component. `ComponentNode.remote` is "Whether this style/component is a remote style/component that doesn't live in the file (i.e. is from the team library)". `key` is the import key [S10]. The Plugin API does **not** expose the source library's name or file for a component or style [S10].
- **Resolving a library name:** `get_libraries` lists libraries added to the file and available to add, each with name, library key, description and source type [S12]. `search_design_system` searches components, variables and styles across libraries and can be scoped with `includeLibraryKeys` [S12, S11]. The REST API's published-component and published-style metadata includes `file_key` (the library file) [S13], but that needs a separate REST token, not the MCP server.
- **Figma agent:** can "connect any library available in the design file to the chat" and @-mention components [S2]. It is not documented whether it can report which library a given instance comes from.

### Detached instances

- **MCP / Plugin API (confirmed):** `FrameNode.detachedInfo: DetachedInfo | null` is `{type:'local', componentId}` or `{type:'library', componentKey}`. It is "null if the node isn't a detached instance" [S10]. So a detached library component yields a component key that can be matched to a library as above.
- **Figma agent:** there is no documented detached-instance capability. Figma's separate **Check designs** feature flags detached components, hard-coded values, and components, variables and styles "from incorrect libraries". It is UI-only, runs on one page at a time (selections up to 25K layers), is limited to Organization/Enterprise plans and is in private beta, with no documented agent or API access [S5].

### Variables and styles, with the defining library

- **MCP (confirmed):** `get_variable_defs` returns the variables and styles used by a node as name → value [S7, S12]. It does not document library attribution.
- **Plugin API (confirmed):** `node.boundVariables` gives variable ids. `Variable.remote`, `Variable.key` and `variableCollectionId` identify the variable [S10]. `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` returns `{name, key, libraryName}` for collections in libraries enabled on the file. It "requires that users enable libraries … via the UI" [S10]. Matching a remote variable's collection `key` to that list gives the **library name**.
- **Local-only trap:** `getLocalVariableCollectionsAsync()` returns only local variables. Remote library variables are invisible to it [S11].
- **Styles:** `BaseStyle.remote`, `key` and `getPublishStatusAsync()` are available [S10], with no library name. Resolve it via `search_design_system` (entity `style`) or REST `file_key` [S12, S13].
- **Raw values:** a property with no `boundVariables` entry and no style id is a raw (hard-coded) value. This is inferred from the API shape; Figma has no single "is raw" flag.
- **Figma agent:** reads text, color, effect and grid styles "from the file or connected libraries", applies variables and switches modes [S2], and reads variable descriptions [S3].

### Published library metadata

- **MCP:** `get_libraries` (paginated, 20 org libraries per page) and `search_design_system` [S11, S12]. The Plugin API gives `getPublishStatusAsync()` and `hiddenFromPublishing` on local collections [S10].
- **Figma agent:** it references published libraries, including "Examples" pages and `_example` components [S3]. There is no documented metadata listing.

### Screenshots

- **MCP (confirmed):** `get_screenshot` (Design, FigJam, Slides; `maxDimension` up to 65536) [S7, S12], `get_design_context` includes one by default [S7], and `await node.screenshot()` works inside `use_figma` [S11].
- **Figma agent:** it reads attached images [S4]. It is not documented whether it renders the canvas to images for its own review.

### Prototype flows

- **Plugin API (confirmed):** `node.reactions` (trigger + actions) and `PageNode.flowStartingPoints` [S10]. These are readable through `use_figma`. No dedicated MCP read tool exists for prototypes [S7].
- **Figma agent:** "Prototyping and interactions" are listed as coming soon [S2]. The agent cannot yet create prototypes; reading them is not documented.

### Annotations

- **Plugin API (confirmed):** `node.annotations` returns an array of `{label, labelMarkdown, properties[], categoryId}`, and `figma.annotations.getAnnotationCategoriesAsync()` lists categories [S10]. These are readable through `use_figma`. Figma's MCP guide recommends annotations for conveying intent [mcp-server-guide README]. Whether `get_design_context` includes annotation text is not documented.
- **Figma agent:** not documented for Dev Mode annotations. It can "summarize, sort, and take action on comments" [S2]. Comments are not exposed through the MCP server tools listed in [S7].

### Review scope (file, page, frame, selection)

- **MCP:** most read tools need a concrete `fileKey` + `nodeId`, usually taken from a URL [S12]. Selection-based prompting for `get_design_context` "only works with the desktop MCP server" [S7]. The remote `get_metadata` does prepend "Currently selected nodes" when the user has a relevant selection [S12]. For a whole page, pass the page id to `get_metadata` or use `use_figma`. For a whole file, `use_figma` must fan out one call per page: it resets to the first page each call and should switch pages at most once per call [S11].
- **Figma agent:** works on the current selection or any layer ("You can prompt it from any selection"), plus other files pasted as links [S2, S4]. File-wide scope is not documented as a limit either way.

## Where the runtimes differ (for the adherence skill)

1. **Determinism.** The MCP path can compute library attribution, detached instances and raw values exactly through `use_figma`. The Figma-agent path depends on the agent's undocumented tools, so the same skill text may produce a less exact audit.
2. **Packaging.** The Figma-agent and Make skill must be one `.md` file. Any Plugin API snippets have to be inline, and there is no evidence the Figma agent can execute them.
3. **Library naming.** In both runtimes, component and style library names need a lookup step (search or `get_libraries`). Variables are the only asset with a direct `libraryName`.
4. **Comments vs annotations.** The Figma agent can act on comments; MCP can read annotations (via `use_figma`) but not comments.
5. **Cost.** MCP tool calls are rate limited per seat. Low-tier seats get 6 calls a month, which a file-wide audit would exhaust [S9].

## Open questions

- What tools does Figma's agent actually call? Does it have Plugin API or `use_figma`-equivalent access that a skill could steer? This needs a hands-on test in a file (for example, ask it to list `detachedInfo` or `remote` for the selection).
- The response shape of `search_design_system` / `get_libraries`: does each result carry a library name, so component keys can be mapped to libraries without the REST API? This needs a live call against a real file.
- Does `get_design_context` or `get_variable_defs` output include annotations or library attribution?
- Does `figma.teamLibrary` work inside `use_figma` on the remote server? It is not listed among the unsupported APIs (`loadAllPagesAsync`, `setPluginData`, `createImageAsync`) [S12], but this is untested.
