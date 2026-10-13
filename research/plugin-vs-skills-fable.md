# Orchestrator and skills, or a custom Figma plugin?

Independent review for [#20](https://github.com/Blind3y3Design/design-review-skills/issues/20), written by Claude Fable 5.1 on 2026-09-30. It reads every decision on the map (#2–#19), the ADRs, the glossary and the six research notes, and checks the plugin path against Figma's own sources only: developers.figma.com, help.figma.com, `@figma/plugin-typings` 1.139.0 and `figma/mcp-server-guide`. Facts marked UNCONFIRMED have no primary source.

## Answer

**Stay on the current path.** The review's value is in judgement, and two of the three axes (research alignment and most of accessibility) can't be judged by code. A plugin that judges must call an LLM, and a Figma plugin can't hold a secret, so that means an org-run proxy, a per-user key, or a backend: more to build and run than the whole skill set, and a plugin still can't reach Dovetail without one. What a plugin does better is the deterministic scan: `figma.teamLibrary` names the library of a variable, whole-page traversal runs unmetered and repeatably, and a panel can select a layer on click. Those are real, but they improve one axis's Certainty and speed, not the review. The honest weaknesses of the current path are that it rests on undocumented agent behaviour (chaining, `evaluate_script`, `Bash` network access), the agent improvises the scan each run, and the agent has unpublished monthly beta limits. The right response is to harden the skills, not to switch: put a fixed, tested scan script into the design system skill, and keep a plain "facts" hand-off inside it so a read-only plugin can slot in later if real files show the agent's scan is too slow or unreliable.

## Side by side

| | Current path: Orchestrator + Review Skills | Custom classic plugin | Best hybrid: read-only "facts" plugin + skills |
|---|---|---|---|
| How a review starts | Select frames, open Agents, `/design-review`, answer one set of questions (#8). Externally: point Claude Code or Cursor at a file URL through the MCP server. | Select frames, Tools tab > plugin (Full or Starter seat only in Design). Panel opens; pick axes; Run. Parameters can be typed in quick actions [S18]. | Run the facts plugin once on the scope, then run the skill. Or the skill reads facts the plugin left on the nodes. Two steps. |
| What the designer sees | Markdown report in the chat, a report page in the file, optional annotations (#13). Links to layers. | A panel listing Findings, filterable, click selects the node (`figma.currentPage.selection`, `figma.viewport`). Same report page and annotations are possible [S9, S12]. | Chat report as today. The plugin's own panel shows raw facts only. |
| Acting on Findings | Follow the link, fix by hand, re-run (#13). | Click a row, fix, re-run. Best in class. | As current path. |
| What can be read | Plugin API through `evaluate_script` (#14): main component key and `remote`, bindings, styles, `detachedInfo` (#9), annotations. No library name for anything (#14). MCP adds `get_libraries`, `search_design_system` [S33]. | Same Plugin API, plus `figma.teamLibrary` with the `teamlibrary` permission: `libraryName` for **variable collections only** [S1, S5, S19]. Components and styles still expose `key` and `remote` only [S8]. `overrides` per instance [S8]. Screenshots via `exportAsync`. | Everything in the plugin column, computed once and written to the nodes as shared plugin data (100 kB per entry) [S10] for the skill to read. |
| Where profiles, references and reports live | Public GitHub via `curl`, a shared Figma file, a page, a custom skill (#17). Private GitHub unproven (#18, #19). | Main-thread `fetch` [S16] against `networkAccess.allowedDomains` [S1]: public GitHub raw works. Private GitHub needs a token, which can't ship in the plugin (source is client-side, readable [S34]). `clientStorage` is per machine, 5 MB, "stability, not security" [S11]. Writes to Figma: pages, text, annotations, plugin data. No GitHub write without a token. | As current path for documents. Facts live on the nodes. |
| How judgement is made | The agent's model, steered by the skill and the Reference Document. Certainty is explicit (#6). | Code: deterministic for raw values, detached instances, overrides, contrast, target size. Prose rules (layer rules documents, most WCAG criteria, all research) need an LLM call. | Code for facts, model for judgement. Each does what it's good at. |
| LLM cost, keys and data | Included in the agent (free in beta, monthly limits [S35]). Externally, the user's own agent subscription. Design data stays inside Figma's agent or the user's MCP client. | Plugin must call a vendor via `fetch`. Key can't be embedded, so: a proxy the org runs (its own auth, cost centre, uptime), or each user pastes a key into `clientStorage`. Design JSON leaves Figma to the proxy and vendor. Dovetail needs a 30-day token per user (#4). Publishing requires disclosing network access [S25, S26]. | No LLM in the plugin. Skills carry the judgement as today. |
| Build and maintenance | Markdown only. No build step since ADR 0005. Test with sample files (#1, open). | TypeScript, `@figma/plugin-typings`, a bundler, the desktop app to develop [S15]. Two runtimes to test (sandbox and UI iframe) [S3, S12]. Dynamic page loading rules [S4]. No documented test harness for the `figma` global. | Plugin is small and read-only, but it's a second codebase that must stay in step with the Design system baseline Reference Document. |
| Publishing and updates | Upload the `.md` or `create_custom_skill` (#17); publish to team or org [S36]. External agents install from the repo. | Private org plugin: any member publishes, no Figma review, no admin approval, updates immediate and users always get the latest [S21, S22, S23]. Org and Enterprise plans only [S20]. Community: Figma review, "approval times vary" [S20, S25]; after first approval, updates ship without review [S21]. | Both channels. |
| Portability beyond Figma | Same files run in Claude Code, Codex, Cursor via the MCP server (ADR 0001). | None. Runs only inside Figma, only where the user has a Full or Starter seat in Design [S27]. Breaks the AGENTS.md constraint. | Skills stay portable. The plugin is optional; without it the skill computes facts itself. |
| Reuse of the existing spec | All of it. | Finding JSON, Coverage, Severity and Certainty rules, the baseline checks and tie-break port well to code. Review Profile and Report Writer prose need a strict parser and a template. Research alignment doesn't port. | All of it, plus the facts schema. |
| Main risks | Chaining, `evaluate_script` and `Bash` network are undocumented (ADR 0005). Agent limits unpublished. Scan improvised per run (#14 guessed instead of reading `detachedInfo`). GitHub write unproven. | Backend for the LLM. Key and data handling. Community review if published beyond the org. Single-vendor lock-in is total. One plugin at a time [S27]; no background runs [S3]. `loadAllPagesAsync` "may be slow" [S4]. | Two artefacts to keep in sync. Stale facts if the plugin ran before edits. Extra step for the designer. |

## Day to day

**Current path, a designer.** Open the file, select the three checkout frames, open the agent, type `/design-review`. It asks once: which axes (all preselected), what scope (the selection), and a research topic ("checkout errors"). It runs, and the report appears in the chat: fixes grouped by Root Cause, then per-axis Findings and Coverage. A "Design review" page appears with a frame for this run. They click the link on the contrast Finding, swap the token, and re-run. The wait is the model's, and every run consumes agent capacity that Figma caps monthly without saying how much [S35].

**Current path, a lead.** Same prompt on the designer's file, or from Claude Code against the file URL, where they get the JSON block and can diff two snapshots by Finding id (#13). Externally the MCP server is metered at 200–600 calls a day per Full seat [S37]; inside Figma it isn't.

**Plugin, a designer.** Select the frames, Tools > "Design review". A panel opens (PropsKit or custom HTML in the UI iframe [S12]). First run: paste the Review Profile URL; it's kept in `clientStorage` on this machine only [S11]. Tick axes, Run. Code checks finish in seconds and the panel lists Findings; click one and the layer is selected. The accessibility copy checks and the layer rules judgement need the LLM: the plugin posts design JSON to the org's proxy and waits. Research alignment isn't in the panel, because the plugin has no Dovetail session. "Write report page" and "Annotate" buttons do what the Report Writer does. If they open another plugin, this one closes [S27].

**Plugin, a lead.** Same panel, plus an "Export JSON" button. Nothing outside Figma can run it.

**Hybrid.** The designer runs the facts plugin first (a progress bar over the selected frames, then "Facts written for 312 layers"), then the skill as today. The skill reads the facts from shared plugin data instead of scanning, so it's faster and attribution is `confirmed` for variables.

## What carries over, decision by decision

| Decision | Skills path | Plugin path |
|---|---|---|
| Review Profile (#7): Markdown with fixed headings, lookup order | As decided. | Parse Markdown in code; headings must be strict. Lookup step 3 (project context file) has no equivalent; step 2 (pointer in the file) fits plugin data. First-run creation becomes a form. |
| Finding format, Severity, Certainty (#6) | As decided. | Ports directly; the JSON was designed to be machine-readable. |
| Coverage (#11) | As decided. | Ports; a plugin can only mark criteria it has rules for, so `needs-code` and `needs-annotation` would be tables in code. |
| Report Writer (#8, #13) | As decided. | Becomes a Markdown template plus the page-writing code. The prose rules for people don't apply to a panel. |
| Orchestrator (#8): axes from profile and user, one set of questions, parallel subagents | As decided. | Becomes a panel and a loop. Parallelism is moot; skipped-axis rules port. |
| Design System Layers (#9): attribution by lookup or hints, baseline checks, tie-break | Attribution is `likely` by hints inside Figma; `confirmed` only externally. | Variables become `confirmed` through `teamLibrary` [S5]. Components and styles stay hint-based [S8]. Baseline checks and the five-step tie-break are exactly what code does well. |
| Accessibility scope (#11): static, annotation, code groups; markers; WCAG Reference Document | As decided. | Static measurements port (contrast, target size, non-text contrast). Judging descriptive labels, sensory instructions and consistent identification needs the LLM. The Reference Document still drives thresholds, but a plugin would read it as data, not as instructions. |
| Research alignment (#10) | Dovetail connector in Figma, MCP externally. | Doesn't port. No OAuth in a plugin, no connector, and the axis is pure judgement. |
| Storage: GitHub or Figma only (#1, #17) | Proven routes: public GitHub, shared file, page, custom skill. | Same set, minus `curl` and plus plugin data. Private GitHub needs a token the plugin can't hold. |
| Annotations optional, comments never (#13) | As decided. | Same API [S9]. Same open question on several annotations per node: the type is an array, and Figma states no limit [S9]. |
| ADR 0001 portable single-file skills; ADR 0004 and 0005 chained skills | The path itself. | Abandoned. A plugin is a Claude-Code-plugin-shaped decision in another vendor's box. |

## Hybrids and generative plugins

**A read-only facts plugin** is the hybrid worth defining. It needs `documentAccess: "dynamic-page"`, `permissions: ["teamlibrary"]`, `networkAccess.allowedDomains: ["none"]` [S1]. It traverses the selected frames with `findAllWithCriteria`, records per node: main component key and `remote`, `detachedInfo`, `boundVariables` resolved to variable name, collection and `libraryName` where the collection is in an enabled library [S5], style ids, `overrides`, raw fills, and annotations. It writes them with `setSharedPluginData("drs", "facts", json)` [S10] and lists a summary. Skills read them through `getSharedPluginData` in `evaluate_script` or `use_figma` (#13 found shared plugin data readable there). It doesn't judge, so it needs no network, no key and no review. A Dev Mode `inspect` variant is possible for Dev seats: Dev Mode plugins can't edit the document, but Figma says they can "modify metadata (pluginData and relaunchData)" [S14], which is all a facts plugin writes.

**A skill that runs a plugin.** Figma Design's agent listed a `run_generative_plugin` tool in #14. Figma doesn't document it anywhere I could find: not on help.figma.com, not on developers.figma.com. UNCONFIRMED what it takes and whether a custom skill can trigger it reliably. Classic plugins have no agent-facing run tool at all; a user runs them.

**Generative plugins.** Figma's definition: "built by prompting the Figma agent and the agent writes the code for you" [S28]; "hosted on Figma's database", they "don't support third-party API calls", use PropsKit UI, and cost AI credits to build and nothing to run [S32]. They are for people "not familiar with code" [S32]. Admins can turn them off org-wide [S30]. They publish privately to an org or to the Community with review [S31], and after approval updates ship without review [S29]. From the MCP server, `create_generative_plugin` "creates a runnable square-drawing scaffold" and `update_generative_plugin` can replace `code.ts` and `ui.html` but "cannot replace `manifest.json`" [S33, S34]. Figma's authoring rules say every plugin "must provide functional UI", "Never embed API keys", "Do not use authenticated network calls" [S34].

Does one fit a review? As the facts plugin, partly: the repo could hold `code.ts` and `ui.html` as source and an external agent could push them through `update_generative_plugin`, giving a Figma-hosted, no-install plugin with no build tooling. Two blockers. The manifest can't be changed, so whether the scaffold carries `teamlibrary` is UNCONFIRMED, and without it the plugin adds nothing over `evaluate_script`. And no third-party calls rules out any judging or fetching. As the whole review, no.

## Recommendation

Keep the Orchestrator and Review Skills as the delivery path, and record the decision. Reasons, in order:

1. **Judgement is the product.** Research alignment can't exist in a plugin, and most accessibility criteria and every layer rule statement need a model. The plugin path either drops two thirds of the review or adds a backend that costs more to run than the skills cost to write.
2. **A plugin can't keep a secret.** Figma's own authoring guidance says plugin source "is readable by people who can access it" [S34]; `clientStorage` is "not security" [S11]. Every LLM or Dovetail call needs a proxy or a per-user key, and the design data leaves Figma to reach it.
3. **The read gain is narrow.** The one thing a plugin reads that the agent can't is `libraryName` for variables [S5, S19]. Components and styles are still `key` and `remote` [S8]. `detachedInfo` is already reachable; #14 missed it because the skill didn't name it, which #9 fixed.
4. **Distribution is a wash for Cat, worse beyond.** Private org plugins are easy (no review, immediate updates [S21, S22]), but need Organization or Enterprise [S20]. Skills publish to an org the same way and also install in external agents from the repo.
5. **Cat's seats favour the agent.** All designers have Full seats, so the agent runs in every file [S35]. Plugins in Design would run too [S27]; neither path is blocked, so the tie goes to the path with judgement.

The current path is weaker than the map admits in three places, and these are the changes I'd make if it stays:

- **Stop improvising the scan.** The design system skill should carry one fixed Plugin API snippet (single file, so inline) that reads `detachedInfo`, `getMainComponentAsync`, `boundVariables`, style ids and `overrides` for the scope, and returns a facts JSON. #14 shows what happens when the model writes its own: it guessed at detachment. Test the snippet on real files (#9's open items), and test `figma.teamLibrary` inside `evaluate_script` once more, since the tool differs from `use_figma`.
- **Name the facts hand-off.** Inside the design system skill, split scanning from judging with a plain facts list, the way research alignment splits fetching from judging (ADR 0004). That seam is where a facts plugin, or Figma's `check_designs`, would plug in later without changing the Findings.
- **Treat agent limits as a risk.** Figma caps the agent monthly during beta and publishes no numbers [S35]. Record it beside the undocumented-chaining risk in ADR 0005, and re-run #14's tests on each agent change. A file-wide scan in one `evaluate_script` call costs one tool call; the skill should prefer that to many small calls.
- **Write ADR 0006**: no custom plugin as the delivery path; a read-only facts plugin is an optional accelerator with no judgement, no network and no secrets, built only if real-file testing shows the agent's scan is too slow or unreliable.

## Sources

| # | Source | Used for |
|---|---|---|
| S1 | [Plugin manifest](https://developers.figma.com/docs/plugins/manifest/) | `networkAccess`, `permissions: teamlibrary`, `documentAccess`, `editorType`, `capabilities` |
| S2 | [Making network requests](https://developers.figma.com/docs/plugins/making-network-requests/) | Fetch API recommended over iframe; null-origin CORS rule |
| S3 | [How plugins run](https://developers.figma.com/docs/plugins/how-plugins-run/) | Sandbox and UI iframe; `closePlugin`; no background |
| S4 | [Accessing the document](https://developers.figma.com/docs/plugins/accessing-document/) | Dynamic page loading; `loadAllPagesAsync` "can be slow" |
| S5 | [figma.teamLibrary](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/) | Variables only; libraries enabled via UI |
| S6 | [FrameNode](https://developers.figma.com/docs/plugins/api/FrameNode/) | `detachedInfo`, `annotations` |
| S7 | [boundVariables](https://developers.figma.com/docs/plugins/api/properties/nodes-boundvariables/) | Fields covered |
| S8 | [InstanceNode](https://developers.figma.com/docs/plugins/api/InstanceNode/) | `getMainComponentAsync`, `overrides`, remote |
| S9 | [Annotation](https://developers.figma.com/docs/plugins/api/Annotation/) | Array per node; node types; no limit stated |
| S10 | [setSharedPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setsharedplugindata/) | Readable by any plugin; 100 kB per entry |
| S11 | [figma.clientStorage](https://developers.figma.com/docs/plugins/api/figma-clientStorage/) | Local, 5 MB, "stability, not security" |
| S12 | [Creating a UI](https://developers.figma.com/docs/plugins/creating-ui/) | `showUI`, `postMessage`, null-origin iframe |
| S13 | [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins/) | 3-second timeout; output in Inspect panel |
| S14 | [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode/) | `inspect`/`codegen`; can't edit the document; can set pluginData |
| S15 | [Plugin quickstart](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/) | Desktop app, Node, TypeScript, typings |
| S16 | [fetch](https://developers.figma.com/docs/plugins/api/properties/global-fetch/), [Global objects](https://developers.figma.com/docs/plugins/api/global-objects/) | Main-thread `fetch` signature |
| S17 | [figma.on](https://developers.figma.com/docs/plugins/api/properties/figma-on/) | `run`, `documentchange` needs all pages |
| S18 | [Plugin parameters](https://developers.figma.com/docs/plugins/plugin-parameters/) | Quick-action input; menu commands |
| S19 | `@figma/plugin-typings` 1.139.0 (npm, 2026-09-23): `plugin-api.d.ts` lines 2275, 2473–2485, 8543–8551, 9301–9303, 9353–9358, 9402, 6426–6428, 11105–11109, 11152–11155; `index.d.ts` line 27 | `libraryName`, `TeamLibraryAPI`, `DetachedInfo`, `Annotation`, size limit, `getMainComponentAsync`, `overrides`, global `fetch` |
| S20 | [Publish classic plugins to the Community](https://help.figma.com/hc/en-us/articles/360042293394) | Flow; review; Organization or Community choice |
| S21 | [Manage classic plugins as a developer](https://help.figma.com/hc/en-us/articles/360042293714) | Updates without review; users get latest only |
| S22 | [Create internal plugins for an organization](https://help.figma.com/hc/en-us/articles/4404228629655) | "Any member of an organization can make and share a private plugin" |
| S23 | [Manage plugins and widgets in an organization](https://help.figma.com/hc/en-us/articles/4404228724759) | Approval settings don't apply to private plugins; admins emailed on network-access changes |
| S24 | [Save plugins and widgets for an organization](https://help.figma.com/hc/en-us/articles/4404239055127) | Saved resources appear for all members |
| S25 | [Plugin and widget review guidelines](https://help.figma.com/hc/en-us/articles/360039958914) | Network access, privacy policy, support, "approval times vary" |
| S26 | [Security disclosure principles](https://help.figma.com/hc/en-us/articles/16354660649495) | Restrict domains; disclosure form |
| S27 | [Use plugins in files](https://help.figma.com/hc/en-us/articles/360042532714) | Seat table; "You can only run one plugin at a time" |
| S28 | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743) | Definition; Tools tab; credits |
| S29 | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023) | Updates after approval; no revert |
| S30 | [Manage access to generative plugins and shaders](https://help.figma.com/hc/en-us/articles/43029320389655) | Org-wide admin toggle |
| S31 | [Publish generative plugins to the Community](https://help.figma.com/hc/en-us/articles/43029200314135) | Community review or private org |
| S32 | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879) | Classic vs generative: hosting, third-party APIs, PropsKit, credits |
| S33 | [MCP server: tools and prompts](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) | `create/update/get/list_generative_plugin`, `use_figma`, `get_libraries` |
| S34 | [figma-generative-plugins skill](https://github.com/figma/mcp-server-guide/blob/2c8af036a758af150ec0244489f6fb3d12e394db/skills/figma-generative-plugins/SKILL.md) and [references/authoring.md](https://github.com/figma/mcp-server-guide/blob/2c8af036a758af150ec0244489f6fb3d12e394db/skills/figma-generative-plugins/references/authoring.md) | Manifest can't change; no secrets; functional UI required; source readable |
| S35 | [AI agent beta access](https://help.figma.com/hc/en-us/articles/34932042346775) | Full seat; free in beta with monthly limits |
| S36 | [Custom skills for the Figma agent](https://help.figma.com/hc/en-us/articles/40283639496599) | Single `.md`; team or org publishing (via #2) |
| S37 | [MCP plans, access and permissions](https://developers.figma.com/docs/figma-mcp-server/plans-access-and-permissions/) | 200–600 calls a day per Full seat (via #3) |
| — | Repo: #3, #9, #13, #14, #17, #18; ADRs 0001–0005 | Established facts about the current path |

## Facts I couldn't confirm

- **`run_generative_plugin`**: not documented by Figma. Its inputs, whether it runs classic plugins, and whether a custom skill can trigger it are UNCONFIRMED. Only #14's tool list shows it exists.
- **Generative plugin manifest**: whether the `create_generative_plugin` scaffold includes `permissions: ["teamlibrary"]` or any `networkAccess`. `update_generative_plugin` can't change it [S34]. Not documented.
- **Generative plugin scope**: whether one is bound to the file it was created in, or to the creator's account library. Help says Tools tab and "any Figma Design file" for updates [S29]; the MCP says "account library" [S33]. Not documented clearly.
- **`figma.teamLibrary` inside `evaluate_script`**: #9 says it isn't available in `use_figma`; nobody has called it from the agent's `evaluate_script`. UNCONFIRMED.
- **Seat needed to develop plugins**: Figma documents the desktop app [S15] but not a seat. Running in Design needs Starter or Full [S27]; I assume development is the same. Not documented.
- **Community review time**: Figma's own pages say only "approval times vary" [S20, S25]. Forum posts cite 5–10 business days; not a primary source.
- **Whether an admin can stop members publishing private plugins**: not documented on [S22] or [S23]. Only Community publishing is limited to admins.
- **Main-thread `fetch` and CORS**: Figma states the null-origin `Access-Control-Allow-Origin: *` rule for iframes [S2]; whether main-thread `fetch` has the same restriction is not documented.
- **Agent monthly limits**: exist [S35]; the numbers are not published.
- **Plugin performance on large pages**: Figma warns `loadAllPagesAsync` "may be slow" [S4] and publishes no figures. Whether a facts scan over a 25k-layer page completes acceptably is untested.
