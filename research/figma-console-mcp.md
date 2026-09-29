# What design data can a skill read through Southleft's Figma Console MCP?

Research for [#15](https://github.com/Blind3y3Design/design-review-skills/issues/15), extending [#3](https://github.com/Blind3y3Design/design-review-skills/issues/3) ([findings](https://github.com/Blind3y3Design/design-review-skills/blob/research/figma-design-data/research/figma-design-data.md)). Researched 2026-09-29 against the project docs, the source at commit `db1967f` (v1.40.7, released 2026-09-28), and Figma's developer and help docs. Nothing was installed or run.

## Short answer

- **It is the Plugin API plus the REST API, reached through a Figma plugin you run yourself.** Figma Console MCP (FCM) is an MIT-licensed MCP server. Its data tools either call the Figma REST API with your token, or send commands over WebSocket to the **Desktop Bridge**, a development plugin running in Figma Desktop [F1, F3]. The key tool is `figma_execute`, which runs arbitrary Plugin API JavaScript [F2]. So it can read the same things `use_figma` can on the native server: `detachedInfo`, `mainComponent`, `remote`/`key`, `boundVariables`, style ids, `annotations`, `reactions` and `figma.teamLibrary`.
- **It has a design-system lint, but the lint is weaker than it looks.** `figma_lint_design` has `hardcoded-color`, `no-text-style`, `detached-component` and `token-misuse` rules [F2]. In the source, `detached-component` only flags a FRAME whose name contains `/`. It never reads `detachedInfo`. `hardcoded-color` only checks solid fills, not strokes, spacing, radius or effects [F4]. The lint does not report which library anything comes from.
- **Library attribution is no better than native.** Variables resolve to `libraryName` through `figma_get_library_variables`, the same `figma.teamLibrary` path as native [F2, F5]. Components resolve from key to source `fileKey` through REST (`figma_get_library_component_by_key`) but not to a library name [F2, F6]. Styles have no dedicated resolver.
- **Rate limits:** the Plugin API path has no Figma rate limit. The REST-backed tools are subject to Figma's REST rate limits on your token. FCM's "no rate limits" claim is about FCM itself, not Figma's REST quotas [F7, F8].
- **Figma's agent:** Figma's agent accepts custom MCP connectors, but only remote HTTPS servers [F9]. It could in principle point at Southleft's hosted endpoint. Plugin-backed tools would still need the Desktop Bridge running and paired in Figma Desktop. Untested.

## Sources

| # | Source | Kind |
|---|---|---|
| F1 | [README](https://github.com/southleft/figma-console-mcp/blob/main/README.md), [docs site](https://docs.figma-console-mcp.southleft.com/) | Project docs |
| F2 | [`docs/tools.md`](https://github.com/southleft/figma-console-mcp/blob/main/docs/tools.md) (all tools reference) | Project docs |
| F3 | [`docs/mode-comparison.md`](https://github.com/southleft/figma-console-mcp/blob/main/docs/mode-comparison.md), [`docs/setup.md`](https://github.com/southleft/figma-console-mcp/blob/main/docs/setup.md), [`figma-desktop-bridge/manifest.json`](https://github.com/southleft/figma-console-mcp/blob/main/figma-desktop-bridge/manifest.json) | Project docs / source |
| F4 | [`figma-desktop-bridge/code.js`](https://github.com/southleft/figma-console-mcp/blob/main/figma-desktop-bridge/code.js): `LINT_DESIGN` handler (~L4108–5200), deep-component extraction (~L1420–1640) | Source |
| F5 | [`src/core/library-tools.ts`](https://github.com/southleft/figma-console-mcp/blob/main/src/core/library-tools.ts) | Source |
| F6 | [`src/index.ts`](https://github.com/southleft/figma-console-mcp/blob/main/src/index.ts) (cloud tool registration), [`src/core/figma-api.ts`](https://github.com/southleft/figma-console-mcp/blob/main/src/core/figma-api.ts) (REST client, 429 retry) | Source |
| F7 | [`docs/figma-mcp-vs-figma-console-mcp.md`](https://github.com/southleft/figma-console-mcp/blob/main/docs/figma-mcp-vs-figma-console-mcp.md) | Project docs (vendor comparison) |
| F8 | [Figma REST API rate limits](https://developers.figma.com/docs/rest-api/rate-limits/) | Figma developer docs |
| F9 | [Figma help: custom MCP connectors](https://help.figma.com/hc/en-us/articles/38147204302743) | Figma help |
| F10 | [Plugin quickstart](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/): "Plugin development and testing requires the Figma desktop app." | Figma developer docs |
| F11 | [`southleft/figma-console-mcp-skills`](https://github.com/southleft/figma-console-mcp-skills) README and `figma-lint-design` skill | Companion repo |
| F12 | GitHub API / npm metadata for `southleft/figma-console-mcp` (queried 2026-09-29) | Registry metadata |
| S* | Source numbers from the [#3 findings](https://github.com/Blind3y3Design/design-review-skills/blob/research/figma-design-data/research/figma-design-data.md) (for example S7 = Figma MCP tools, S9 = MCP plans and limits, S10 = Plugin API typings) | Prior research |

## How it connects

There are four modes. The docs give inconsistent tool counts across pages (114, 121, 101, 94, 93, 9), so treat the numbers as rough [F1, F3, F7].

| Mode | Where the server runs | Reaches Figma via | Auth | Notes |
|---|---|---|---|---|
| **NPX / Local Git** | Your machine (`npx figma-console-mcp`, stdio) | REST API + Desktop Bridge over `ws://localhost:9223–9232` | Personal access token (`FIGMA_ACCESS_TOKEN`); scopes File content, File versions, Variables (read), Comments (read/write) [F1] | Full tool set, including selection tracking, `figma_execute_across_files` and `figma_audit_design_system_report` [F2] |
| **Cloud Mode** | Southleft's Cloudflare Worker, `https://figma-console-mcp.southleft.com/mcp` | REST + Desktop Bridge paired through a cloud relay (6-character code) | PAT as Bearer token [F1] | Write access from web clients. No real-time selection or console monitoring [F1, F3] |
| **Remote SSE** | Southleft's Worker, `/sse` | REST only (plus a headless browser) | OAuth | Documented as read-only, "9 tools". `src/index.ts` registers most tool groups on both endpoints, but plugin-backed tools need a paired bridge [F3, F6] |
| **Self-hosted** | Your Cloudflare account | Same as Cloud | Same | [F1] |

- **The Desktop Bridge is required for anything Plugin API-based.** That covers `figma_execute`, lint, annotations, library variables, deep component trees, selection and plugin screenshots. The bridge is a *development* plugin imported from a manifest (Plugins → Development → Import plugin from manifest) [F1]. Figma says plugin development needs the desktop app [F10], and setup lists "Figma Desktop installed (not just the web app)" [F3].
- The manifest declares `permissions: ["teamlibrary"]`, `documentAccess: "dynamic-page"`, `enablePrivatePluginApi: true`, and network access limited to localhost ports and `figma-console-mcp.southleft.com` [F3].
- **Without the bridge**, only REST tools work: file JSON, components, styles, images, comments, versions, and variables (Enterprise-only REST endpoint) [F2].

## Data, item by item (FCM)

### Node properties

- **REST:** `figma_get_file_data` returns the file tree with `depth` 0–3 and `verbosity` of summary, standard or full. It can also take `nodeIds` [F2]. The REST node JSON includes `componentId` on instances, `boundVariables` and `styles`. This is the Figma REST shape, not something FCM adds.
- **Plugin:** `figma_get_component_for_development_deep` returns an unlimited-depth tree with visual props, `boundVariables` resolved to token names, `mainComponent` {id, name, key, component set}, `reactions` and `annotations` [F2, F4]. **Caveat from source:** the token-name map comes from `getLocalVariablesAsync()`, so bindings to *library* variables come back as a bare `{id}` with no name [F4].
- **Any property:** `figma_execute` runs any Plugin API code (timeout 5 s by default, 30 s at most) [F2].

### Component instances and their library

- `mainComponent.key` appears in deep extraction. `remote` is not included, but `figma_execute` can read it [F4, S10].
- `figma_get_library_component_by_key` calls REST `/v1/component_sets/{key}` and falls back to `/v1/components/{key}`. It returns the source `fileKey` + `nodeId`, properties and variants. It needs the `library_assets:read` + `files:read` scopes and works on all plans [F2, F5]. It gives a file key, **not a library name**. Getting the name takes one more `GET /v1/files/{key}` call. That is inferred from the REST API, not an FCM tool.
- `figma_search_components` can search a library by `libraryFileKey`/`libraryFileUrl`. Results carry `source: "local" | "library"` [F2].
- `figma_get_library_components` lists a library file's published components. It is Local mode only [F2].

### Detached instances

- **There is no dedicated detached-instance reader.** The lint's `detached-component` rule is a naming heuristic: "Frames with '/' in name but not component/instance" [F4]. The companion skill documents it the same way [F11]. It misses detached frames without a `/` and flags any frame named `a/b`.
- The precise route is `figma_execute` reading `FrameNode.detachedInfo` (`{type:'local', componentId}` or `{type:'library', componentKey}`) [S10]. A library `componentKey` can then go to `figma_get_library_component_by_key` to find the source file. That chain is inferred, not tested.

### Variables and styles, with the defining library

- `figma_get_library_variables` runs `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` + `getVariablesInLibraryCollectionAsync()` through the bridge. It returns `collections[]: {libraryName, collectionKey, collectionName, variables:[{key,name,resolvedType}]}`. It works on every plan, but only for libraries enabled in the file ("subscribing libraries is UI-only") [F2, F5]. This is the same `libraryName` route the #3 research found for `use_figma`.
- `figma_get_variables` prefers REST (the Variables REST API is Enterprise-only) and falls back to the Plugin API or styles. It can include usage and dependencies [F2]. `figma_get_token_values` / `figma_get_design_system_summary` read through the plugin [F2].
- `figma_get_styles` covers color, text, effect and grid styles, with optional usage [F2]. There is no tool that maps a remote style key to its library.
- **Raw values:** `hardcoded-color` flags visible SOLID fills with no `fillStyleId` and no `boundVariables.color`. `no-text-style` flags TEXT nodes with no `textStyleId` [F4]. Nothing covers strokes, effects, corner radius, spacing/padding or typography variables. `token-misuse` checks whether a variable's name prefix matches how it is used (for example `bg/*` used on text) [F2].

### Published library metadata

- REST-backed: `figma_get_library_components`, `figma_get_library_component_by_key`, `figma_get_design_system_kit` (published components, tokens and styles with visual specs; full, summary or compact) [F2].
- There is no equivalent of the native `get_libraries` (a list of libraries enabled on or available to a file). For variables, `figma_get_library_variables` indirectly lists enabled libraries by name [F2, F5].

### Screenshots

- `figma_capture_screenshot` uses the plugin's `exportAsync` on a node and shows the current, unsaved state [F6 → `src/core/figma-tools.ts`].
- `figma_get_component_image` renders through REST (png, jpg, svg or pdf; scale 0.01–4; image URLs expire after 30 days) [F2].
- `figma_take_screenshot` captures the plugin UI, the page or the viewport [F2].

### Prototype flows

- `reactions` are included in deep component extraction and in `figma_get_component_for_development` [F4]. There is no flow or `flowStartingPoints` tool. Use `figma_execute` [S10].

### Annotations and comments

- `figma_get_annotations` (`nodeId`, `include_children`, `depth`) returns `label`, `labelMarkdown`, `properties`, `categoryId` and `categoryName`. `figma_get_annotation_categories` lists the categories. Both need the bridge [F2].
- `figma_get_comments` / `figma_post_comment` / `figma_delete_comment` use REST (`include_resolved`, `as_md`, pinned `client_meta`) [F2]. **The native MCP has no comment tools** [S7].

### Review scope

- **Selection:** `figma_get_selection` returns the selected nodes' ids, names, types and sizes, and needs the bridge [F6 → `src/local.ts`]. `figma_audit_component_accessibility` falls back to the selection [F2]. Selection tracking is Local mode only [F1].
- **Page:** `figma_lint_design` defaults to the current page. It takes `nodeId`, `maxDepth` (default 10) and `maxFindings` (default 100) [F2].
- **Frame/node:** most tools take `nodeId`.
- **File:** `figma_get_file_data` via REST. `figma_audit_design_system_report` crawls live one page per round trip (30 s cap per page) and caches for 5 minutes [F2]. `figma_execute` can loop pages because the manifest uses `dynamic-page` [F3].
- **Several files:** `figma_execute_across_files` runs one script in several files that have the bridge open, concurrently. Local mode only [F2]. The native server has nothing like it.

## Side by side with the native Figma MCP server

| | Native Figma MCP server (#3) | Figma Console MCP |
|---|---|---|
| Maker, licence | Figma, closed source [F7] | Southleft, MIT, self-hostable [F1] |
| Runs | Figma-hosted remote server, or desktop server [S7] | Local stdio (NPX), or Southleft/self-hosted Cloudflare Worker [F1] |
| Auth | OAuth; catalogued clients only [S9] | PAT (local, cloud) or OAuth (remote SSE); any MCP client [F1, F7] |
| Needs a plugin running | No | Yes, for all Plugin API tools (Desktop Bridge, Figma Desktop only) [F1, F10] |
| Arbitrary Plugin API code | `use_figma` [S7] | `figma_execute`, `figma_execute_across_files` [F2] |
| Node properties | `get_metadata`, `get_design_context`, `use_figma` | `figma_get_file_data` (REST), deep component tree, `figma_execute` |
| Instance → main component | `use_figma` (`getMainComponentAsync`, `remote`, `key`) | Deep tree gives `mainComponent.key`; `figma_execute` for `remote` |
| Component library | Key only; name via `get_libraries` / `search_design_system` (unverified) | Key → source `fileKey` via REST (`figma_get_library_component_by_key`); no name |
| Detached instances | `use_figma` + `detachedInfo` | `figma_execute` + `detachedInfo`; lint rule is a name heuristic |
| Variable library | `use_figma` + `teamLibrary` → `libraryName` | `figma_get_library_variables` → `libraryName` (same API, packaged as a tool) |
| Style library | Key only; search to name | Key only; no resolver |
| Raw-value detection | Hand-written in `use_figma` | `hardcoded-color` (solid fills), `no-text-style`; otherwise `figma_execute` |
| Library listing | `get_libraries`, `search_design_system` | Per-library-file component listing; `figma_get_design_system_kit` |
| Screenshots | `get_screenshot`, `node.screenshot()` | `figma_capture_screenshot` (plugin), `figma_get_component_image` (REST) |
| Prototype flows | `use_figma` (`reactions`, `flowStartingPoints`) | `reactions` in deep tree; `figma_execute` |
| Annotations | `use_figma` | `figma_get_annotations`, categories |
| Comments | None | Read, post, delete (REST) |
| Version history | None | Versions, diff, changelog, `figma_blame_node` (REST) [F2] |
| Selection scope | Desktop server only | `figma_get_selection` (Local mode) |
| Lint / audits | None built in | `figma_lint_design` (14 WCAG + 5 design-system + 2 layout rules), `figma_audit_design_system_report`, `figma_audit_component_accessibility` [F2] |
| Token extraction | `get_variable_defs` (name → value) | `figma_export_tokens` (DTCG, CSS, Tailwind, and more) [F2] |
| Rate limits | 6 calls a month (Starter, View, Collab); 200–600/day for Full/Dev seats, plus per-minute limits [S9] | None of its own on local mode. REST tools use your token's REST quota [F8]. The hosted Worker is under "shared rate limits (fair use)" [F3] |
| Inside Figma's agent | Figma's own tools; skill can't call them by name (#3) | Only as a custom remote connector (`/mcp` or `/sse`); local mode impossible [F9]. Untested |

## Rate limits in detail

- **The Plugin API path** (the bridge: `figma_execute`, lint, annotations, library variables) runs inside the Figma client. Figma publishes no rate limit for it, and FCM adds none [F7].
- **The REST path** is metered per user and per plan for a PAT, and per user, plan and app for OAuth [F8]. For a Full or Dev seat, per minute: Tier 1 (file, nodes, images) 10 on Starter, 15 on Pro, 20 on Org/Enterprise. Tier 2 (comments, variables, versions) 25, 50 and 100. Tier 3 (components & styles, metadata) 50, 100 and 150. View and Collab seats: Tier 1 is up to 20 **a month**, Tier 2 up to 5/min, Tier 3 up to 10/min [F8]. In effect since 2025-11-17. FCM retries a 429 up to 3 times and honours `Retry-After`, capped at 30 s [F6].
- **Compared with native:** a file-wide adherence audit on native MCP costs one metered tool call per `use_figma` page call [S9]. On FCM Local mode, the same work through `figma_execute` isn't metered. On a View or Collab seat the difference is large (native: 6 calls a month). Even there, FCM's REST tools are very limited (Tier 1 at 20 a month), so a skill should prefer the bridge tools.

## Can it run inside Figma's agent?

- Figma's agent and Make support **custom MCP connectors**. They must be a "publicly accessible MCP server over HTTPS"; localhost and stdio are not supported. Auth can be OAuth, client credentials, custom headers or none. Paid plans only; admins can publish connectors or disable them [F9].
- So the NPX/local mode **cannot** run inside Figma's agent. Southleft's hosted `/mcp` (PAT in a custom header) or `/sse` (OAuth) endpoints meet the transport rule. The Plugin API tools would still need the user to run the Desktop Bridge in Figma Desktop and pair it with a code. That would be a second plugin alongside the agent, in the same file. Whether this works in practice is **untested and undocumented** by both Figma and Southleft.
- In external agents (Claude Code, Codex, Cursor) it works as documented in any MCP client [F1].
- **Related:** Southleft's companion repo [`figma-console-mcp-skills`](https://github.com/southleft/figma-console-mcp-skills) packages 22 of FCM's workflows as folder skills that run on the *native* server's `use_figma` (lint, library variables, annotations, token export). Four of them call REST with a PAT. They are folder skills with `scripts/`, so they don't meet the single-`.md` rule for Figma agent skills [F11, S1]. The repo has no mention of Figma's agent.

## Setup cost, licence and maintenance

- **Licence:** MIT. Free. Southleft, LLC is the maintainer, and a DPA is available for the hosted Worker [F1, `docs/security.md`].
- **Setup (local):** Node 18+, Figma Desktop, a PAT with four scopes, an MCP config entry, importing the plugin manifest once and running the plugin in each file. About 10 minutes by their estimate. The plugin must be re-imported when release notes say so [F1]. Organisations that block development plugins would block this. That is inferred, not documented.
- **Maintenance:** created 2025-10-05. v1.40.7 was published 2026-09-28. 81 GitHub releases, 12 contributors, about 2.4k stars, 67 open issues, last push 2026-09-29 [F12]. It is actively maintained and moves fast, so tool names and counts change between releases.
- **Security:** `figma_execute` runs arbitrary JS in the plugin sandbox, and the bridge WebSocket is localhost-only with no auth [`docs/security.md`].

## What FCM offers that a Review Skill could use

1. **`figma_lint_design`**: a ready-made page- or node-scoped lint with WCAG contrast, target size and focus checks, plus `hardcoded-color`, `no-text-style` and `token-misuse`. Useful for the accessibility review. For adherence, its detached check and raw-value coverage are too weak to trust alone (see above).
2. **`figma_audit_design_system_report`**: a scored six-category audit (naming, tokens, metadata, accessibility, consistency, coverage) of the *design system file* itself, not of a product screen's adherence to one [F2]. It is Local mode only.
3. **Library variable catalogue with `libraryName`** as a single tool call.
4. **Comments and version history**, which the native server can't reach [S7]. These would let a review skill post findings as pinned comments.
5. **Multi-file execution**, for auditing several files at once.
6. **Token export** (`figma_export_tokens`) for design-to-code token parity. It is only indirectly useful to review.

For the adherence skill, the precise checks (detached instances, library of each component, raw values beyond fills) still need custom Plugin API code in either server: `use_figma` or `figma_execute`. The code is the same Plugin API either way, so one inline snippet could target both.

## Open questions

- Does Southleft's hosted endpoint work as a custom connector in Figma's agent, with the Desktop Bridge paired in the same file? A hands-on test is needed.
- Do organisation admin settings commonly block the development plugin, or the `enablePrivatePluginApi` flag it sets?
- What is the exact tool set on the `/sse` endpoint today? The docs say 9, but the source registers far more.
- Are Southleft's hosted "fair use" limits documented anywhere as numbers? None were found.
