# Orchestrator and skills, or a custom Figma plugin?

Research for [#20](https://github.com/Blind3y3Design/design-review-skills/issues/20), one of two independent reviews. Researched 2026-09-30. It builds on the decisions in the map (#1) and its tickets, and on the hands-on tests in #14 and #17. Plugin facts come only from Figma's developer docs, the Help Center, `@figma/plugin-typings` 1.139.0 and Figma's own MCP skills. Source ids (P, H, M, R) refer to the sources table.

## Answer

Keep the Orchestrator and Review Skills as the way reviews are judged, and don't build a custom plugin that replaces them. Two of the three axes depend on judgement. Research alignment matches Research Insights to a design, and many accessibility criteria ask whether copy is descriptive. A plugin can only do that by calling an LLM through a server Cat would have to host, which puts design data outside Figma and sits outside the GitHub-or-Figma constraint. A plugin also gives up external agents, can't use Figma's Dovetail connector, and can't read other Figma files. The current path does have two real weaknesses, and they are the plugin's real strengths. It rests on undocumented Figma behaviour (chaining and `evaluate_script`), and the agent writes its own inspection code on every run, which is why it guessed at detached instances in #14 instead of reading `detachedInfo`. Fix both inside the current plan by shipping tested inspection code in the skills. Treat a small plugin as an optional add-on: one that collects facts only a real plugin can reach, and one that lets designers move through Findings. Don't make a plugin the review.

## Side by side

| | Current path: Orchestrator + Review Skills | Custom plugin (classic, private to the org) | Best hybrid: skills judge, tested code gathers facts, optional plugin panel |
|---|---|---|---|
| How a review starts | `/design-review` in Figma Design's agent, or a prompt in Claude Code, Codex or Cursor with the Figma MCP server. One set of upfront questions (#8). | Actions or Plugins, then **From Cat**, then Run. A panel with checkboxes and a Run button [H1, H2]. | As the current path. The panel is opened afterwards, only if wanted. |
| What the designer sees | A Markdown report in the chat, plus a report frame on a page in the file (#13). | A panel list they can filter by Severity or axis. Clicking a Finding selects its layer. | The chat report and report frame, plus an optional panel that reads the saved JSON and selects layers. |
| Acting on Findings | Follow the links, fix by hand, re-run (#13). | Click to select, fix by hand, re-run from the panel (the panel can stay open between runs). | Click to select from the panel, or follow the links. |
| What can be read | Plugin API through `evaluate_script` or `use_figma`: bindings, main component key and `remote`, `detachedInfo`, annotations. **No library name**, even for variables (#14). No `fetch` in `evaluate_script`, but `curl` works (#17). Other Figma files by file key (#17). Dovetail through the connector. | The full Plugin API. With the `teamlibrary` permission, `libraryName` for **variables only** [P1, P2]. `detachedInfo` [P1]. `loadAllPagesAsync` for whole files [P7], which `use_figma` doesn't support [M3]. `fetch` to allowed domains [P2, P4]. `figma.fileKey` for private plugins only [P1]. **No API for reading another Figma file** [P1] and no Figma connectors. | The current path, plus variable library names and whole-file scans if the fact-collector plugin is used. |
| Where profiles, references and reports live | A shared Figma file, a custom skill, a page in the file, public GitHub through `curl`. Private GitHub waits on the connector (#17, #18). | Public GitHub via `fetch`. The open file (a page, or shared plugin data up to 100 kB per node [P1]). `clientStorage` is 5 MB on one machine and isn't shared [P6], so it can't hold a shared profile. Private GitHub needs OAuth through a server you run [P5]. | As the current path. The plugin reads the report the Report Writer already saves in the file. |
| How judgement is made | An LLM in the agent, following the skill and Reference Documents. | Code for measurable checks. An LLM only through your own server. Figma's plugin API has no built-in AI [P1]. | The LLM judges. Tested code gathers the facts, so evidence is the same on every run. |
| LLM cost, keys and data handling | The Figma agent is free during the beta, with monthly limits [H12]. After that it uses AI credits (4,250 a month per Enterprise Full seat [H13]). No keys. Data stays with Figma's AI, or goes to the user's own external agent. | A paid LLM API account. The key sits on a proxy server, because plugin code is readable [M2, P5]. Design data leaves Figma for that server and the LLM vendor. The domains go in `networkAccess` [P2], and the review guidelines ask for a privacy policy if user data is processed [H5]. | Same as the current path. The plugin makes no network calls. |
| Build and maintenance | Markdown skills. Testing needs sample files and re-running the #14 tests whenever Figma changes its agent (ADR 0005). | TypeScript, a bundler and the desktop app for development [P10]. A test harness, plus a proxy server to run and secure if an LLM is used. | Markdown, plus tested Plugin API snippets. Optionally one small plugin with no network access. |
| Publishing and updates | Each skill uploaded to Figma's org by hand; external agents install from the repo. Syncing copies is still open (#16). | Private org plugins skip review and update for everyone automatically [H2]. Community plugins need review, 2FA, and up to two weeks when there's a security disclosure [H4]. | As the current path, plus one private plugin that updates automatically. |
| Portability beyond Figma | Works in Figma Design and in external agents (ADR 0001). | Figma Design only. Dev Mode plugins are read-only and can't write annotations or pages [P8]. | Skills stay portable. The plugin is an extra that runs only in Figma. |
| Reuse of the existing spec | All of it: it was written for this path. | The format, Severity, Certainty and Coverage carry over. Chaining, the Report Writer as a skill, the lookup order and research alignment need redesigning. | Nearly all of it. |
| Main risks | Undocumented chaining and `evaluate_script` (#14, ADR 0005). The agent improvises its inspection code. Beta usage limits. Pricing after the beta. | A server and data leaving Figma. Only the Figma vendor. Build cost. Code can't judge prose. Two stacks to maintain if the skills are kept for external agents. | Two small codebases. The plugin's reading of the saved report format must follow `schemaVersion`. |

## Day to day

**Current path, designer.** Priya selects three checkout frames and types `/design-review` in the agent. The Orchestrator finds the Review Profile through the pointer on the file's cover page, lists the covered axes (all preselected), asks what to review and for a research topic, then runs each Review Skill. A few minutes later the report is in the chat and a dated frame is on the "Design review" page. She follows the Figma links, rebinds two raw fills and re-runs. The friction points are these. She has to remember a slash command. The run uses her monthly agent allowance. A long report is hard to work through in a chat pane. Two runs may inspect the file slightly differently, because the agent writes its script fresh each time.

**Current path, lead.** Sam opens Priya's file (Full seat, edit access), reads the newest report frame, or runs the same review against the team profile. For a whole project, Sam can run it from Claude Code with the Figma MCP server across several files (the Full seat allows 600 calls a day on Enterprise, per the #3 research).

**Plugin path, designer.** Priya opens **Plugins → From Cat → Design review**. The panel remembers her last profile and axes and shows a Run button. Measurable checks finish in seconds and appear as a list. Clicking one selects the layer. It's the smoother experience for design system and contrast checks. For research alignment she has to type a topic, and the plugin has to reach Dovetail through Cat's own server, since plugins can't use Figma's connectors. Judgement Findings take as long as an LLM call does. Only one plugin runs at a time, and it stops when closed; nothing runs in the background [H1].

**Plugin path, lead.** Sam needs a Full seat and edit access to run it; Dev seats run plugins only in Dev Mode, where plugins are read-only [H1, P8]. Sam can't run it from Claude Code or across files.

## What carries over

| Decision | Current path | Plugin | Hybrid |
|---|---|---|---|
| Finding format, Severity, Certainty (#6) | As decided | Becomes a TypeScript schema; unchanged | As decided; the panel reads it |
| Coverage (#11) | As decided | Carries over; the plugin must fill it too | As decided |
| Report Writer (#8, #13) | A required skill | Becomes a code module. The chat, custom skill and connector routes are lost; the page route stays | As decided |
| Orchestrator, chaining, ADR 0004/0005 | As decided | Not needed: axes are modules | As decided |
| Review Profile and lookup order (#7) | As decided | The profile must be parsed by code, so it has to become machine-readable (it isn't, by #7's decision). Lookup loses the project context file, custom skills and other Figma files | As decided |
| First-run creation (#12) | A conversation | A form in the panel | As decided |
| Design System Layers and the baseline (#9) | As decided. Attribution is `likely` in Figma | Carries over well; checks are exact code. Variables can be `confirmed` through `teamLibrary`; components and styles still can't without a REST token [P1] | As decided, with variable attribution upgraded where the collector runs |
| Accessibility scope and WCAG Reference Document (#5, #11, ADR 0003) | As decided | Static numeric checks carry over. The "how to judge" prose needs rewriting as rules or an LLM call | As decided |
| Research alignment (#10) | As decided | Needs an LLM and its own Dovetail auth | As decided |
| Storage (#17, #18) | As decided | Loses shared Figma files and custom skills | As decided |
| Portability (ADR 0001) | Kept | Lost | Kept |

## Hybrids and generative plugins

**A generative plugin** is a plugin the Figma agent writes when you prompt it. It's hosted by Figma, uses the Plugin API with Figma's PropsKit UI, and "cannot integrate third-party API calls" [H6, H7]. It is built through the agent or through the MCP server's `create_generative_plugin` and `update_generative_plugin`. Those tools can replace only `code.ts` and `ui.html`, and can't change `manifest.json` [M1, M2]. Figma's own authoring skill says never to embed keys or make authenticated calls [M2]. Running one costs no AI credits. It's in open beta, can be published to the org or the Community, and org admins can switch generative plugins off [H7, H9]. You run it with **Run plugin** in the chat or from Tools [H10]. `run_generative_plugin` appears in the agent's tool list (#14), but Figma doesn't document it.

**Does it fit a review?** Not as the reviewer. It can't call an LLM, so it can't judge prose or research. Its manifest is fixed, so whether it has `teamlibrary` is unknown. It fits as a **Findings panel**: it reads the report JSON the Report Writer saves on the report page, lists Findings, and selects layers. It needs no network or keys, and an agent could build it. A fact collector also fits if its fixed manifest allows what it needs.

**Hybrids, from cheapest to dearest:**

1. **Tested inspection code inside the skills.** The Review Skills carry fixed Plugin API snippets for `evaluate_script` and `use_figma` to run as written: read `detachedInfo`, list bindings and raw values, compute contrast. A single `.md` can hold code blocks, so ADR 0001 still holds. This fixes the #14 guessing and makes evidence the same on every run.
2. **A Findings panel** (generative, or a small private plugin). It's read-only apart from selection, and works from the saved report.
3. **A fact-collector plugin** (private classic, `teamlibrary`, `dynamic-page`). It writes a facts JSON to shared plugin data on the report page. Shared plugin data is readable by `use_figma` (#13), so the skills can read it. It adds variable library names and whole-file scans. It's worth doing only if `likely` variable attribution turns out to be noisy in practice.
4. **A skill that runs a plugin.** Only generative plugins can be run by the agent, and only through an undocumented tool, so the skills can't depend on it.

## Recommendation

Keep the current path, for three reasons.

- **The judgement lives in the LLM.** A plugin needs its own server to reach one, and that brings in keys, cost and data leaving Figma.
- **The spec carries over whole.** A plugin would redo the Review Profile, the lookup order, research alignment and delivery.
- **Portability is a stated requirement**, and leads get real use from running the review across files in external agents.

The plugin's advantages are real but narrow: a documented, versioned API instead of undocumented agent tools, a panel, and deterministic checks. The hybrids above get most of them without giving anything up.

**What I'd change in the current plan:**

- Add hybrid 1 to the spec now. Each Review Skill ships tested inspection code, and Findings record that the code ran. #9's reliance on the agent reading `detachedInfo` is otherwise untested.
- Add a smoke test: a fixture file and expected Findings, re-run whenever Figma changes the agent (ADR 0005 already asks for the #14 re-run).
- Record the dependence on undocumented `evaluate_script` and chaining in ADR 0005, with the fallback: a private plugin would become the fact route if `evaluate_script` went away.
- Plan for beta limits and AI credit pricing. Keep the report JSON small and the scope chosen upfront.
- Make the report JSON easy to read back from the file, such as shared plugin data on the report frame, so a Findings panel can be added later without a format change.

## Sources

| Id | Source |
|---|---|
| P1 | [`@figma/plugin-typings` 1.139.0](https://www.npmjs.com/package/@figma/plugin-typings) ([repo](https://github.com/figma/plugin-typings)): `detachedInfo`; `LibraryVariableCollection.libraryName`; `teamLibrary` "requires that users enable libraries … via the UI"; `fileKey` "Only private plugins"; shared plugin data 100 kB; global `fetch` in `index.d.ts`; no AI or comments API; no API for opening another file |
| P2 | [Plugin manifest](https://developers.figma.com/docs/plugins/manifest/): `networkAccess`, `teamlibrary`, `dynamic-page`, `editorType`, capabilities |
| P3 | [How plugins run](https://developers.figma.com/docs/plugins/how-plugins-run/): the sandbox and the UI iframe |
| P4 | [Making network requests](https://developers.figma.com/docs/plugins/making-network-requests/): Figma's fetch API, the null-origin iframe, CSP blocking |
| P5 | [OAuth with plugins](https://developers.figma.com/docs/plugins/oauth-with-plugins/): "run your own server" |
| P6 | [figma.clientStorage](https://developers.figma.com/docs/plugins/api/figma-clientStorage/): 5 MB, local, "not synchronized across users" |
| P7 | [Accessing the document](https://developers.figma.com/docs/plugins/accessing-document/): `loadAllPagesAsync`, delay in large files |
| P8 | [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode/): read-only, VS Code |
| P9 | [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins/): 3-second generate timeout |
| P10 | [Plugin quickstart](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/): desktop app, TypeScript |
| H1 | [Use plugins in files](https://help.figma.com/hc/en-us/articles/360042532714): seats, one plugin at a time, no background |
| H2 | [Create internal plugins for an organization](https://help.figma.com/hc/en-us/articles/4404228629655): no review, automatic updates |
| H3 | [Manage plugins and widgets in an organization](https://help.figma.com/hc/en-us/articles/4404228724759): approvals don't apply to private plugins |
| H4 | [Publish classic plugins to the Community](https://help.figma.com/hc/en-us/articles/360042293394): review, 2FA |
| H5 | [Plugin and widget review guidelines](https://help.figma.com/hc/en-us/articles/360039958914): privacy policy, third-party data |
| H6 | [About building plugins in Figma](https://help.figma.com/hc/en-us/articles/41407987481879): classic versus generative |
| H7 | [Generate plugins with the Figma agent](https://help.figma.com/hc/en-us/articles/43028920030743) |
| H8 | [Manage generative plugins as a creator](https://help.figma.com/hc/en-us/articles/43029048128023) |
| H9 | [Manage access to generative plugins and shaders](https://help.figma.com/hc/en-us/articles/43029320389655) |
| H10 | [AI workflows: build your own plugins](https://help.figma.com/hc/en-us/articles/41159704839831) |
| H11 | [Work with the Figma agent in design files](https://help.figma.com/hc/en-us/articles/37998629035799) |
| H12 | [AI agent beta access](https://help.figma.com/hc/en-us/articles/34932042346775): free in beta, monthly limits |
| H13 | [How AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015): 4,250 a month per Enterprise Full seat |
| H14 | [Check designs](https://help.figma.com/hc/en-us/articles/39592284074263): Organization and Enterprise, UI only |
| M1 | [MCP server tools](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/): the generative plugin tools |
| M2 | `skill://figma/figma-generative-plugins` and `references/authoring.md` ([mcp-server-guide](https://github.com/figma/mcp-server-guide)) |
| M3 | `use_figma` tool schema: "MUST NEVER use loadAllPagesAsync, setPluginData, createImageAsync" |
| R | Repo: #3, #9, #13, #14, #17, #18, ADRs 0001–0005 |

## Facts I couldn't confirm

- **UNCONFIRMED:** what `run_generative_plugin` does. It's listed in #14's tool dump, and Figma doesn't document it.
- **UNCONFIRMED:** a generative plugin's manifest: permissions (`teamlibrary`), `networkAccess`, and whether it works across files or stays in the file it was made in. `list_generative_plugins` returned nothing to inspect.
- **Not documented:** whether Figma's agent can run a classic plugin.
- **Not documented:** whether a plugin panel and the agent chat can be open at the same time.
- **UNCONFIRMED:** whether `evaluate_script` runs with `teamlibrary`. The empty `libraryName` in #14 suggests not.
- **Not documented:** AI credit pricing for the agent after the beta, and the beta's monthly limits as numbers. H11 mentions credits while H12 says the agent is free.
- **UNCONFIRMED:** whether Cat's admins allow private plugins that have `networkAccess`, and whether a security review is required.
- **Not tested:** how fast a plugin runs over a large Cat file with `loadAllPagesAsync`.
