# Can a skill invoke other skills inside Figma's agent?

Resolves [#2](https://github.com/Blind3y3Design/design-review-skills/issues/2). Researched 2026-09-29 against primary sources only (Figma Help Center, Figma's own skill repo and MCP server, Claude Code docs, Codex source, Cursor docs, Agent Skills spec).

## Answer

**Inside Figma's agent: no documented way to chain skills, and one documented limit that works against it.** A run gets one user-invoked skill per prompt. Figma documents no way for one skill to call, load, or reference another. Plan for an Orchestrator that is a single self-contained `.md` holding every Review Axis inline. Separate Review Skills can still exist, but the user runs them one at a time.

**In external agents (Claude Code, Codex, Cursor) calling the Figma MCP server: yes, in practice.** These clients load several skills in one turn. A skill can name another skill and the model can load it. Figma's own MCP skills rely on this ("You MUST also load figma-use"). The Orchestrator can call separate Review Skills there. Claude Code can also run each one in its own subagent.

## Figma agent (Figma Design and Figma Make)

### Confirmed

- **One skill per prompt.** Under "Known issues": "If you mention multiple skills in a single prompt, only the first skill used will be invoked." ([Custom skills for the Figma agent and Figma Make](https://help.figma.com/hc/en-us/articles/40283639496599), updated 2026-09-23)
- **The user invokes skills with a slash command.** "To use a skill with the Figma agent or in Figma Make, you must invoke the skill. Invoking the skill manually ensures the agent uses it during a step in a conversation. To invoke a skill, enter slash commands in the prompt box." (same page; also [Find and use skills from the Figma Community](https://help.figma.com/hc/en-us/articles/42287852075543), updated 2026-08-14)
- **Each skill is one file.** "The skill must be a single Markdown (`.md`) file that follows the Agent Skills specification. Custom skills *do not* support optional directories such as `scripts/`, `references/`, and `assets/`." Also: "Figma Make only supports standalone skill files when you're uploading skills. You can't include additional files for the skill." (40283639496599). A skill therefore cannot bring a shared rubric as a reference file.
- **The documented way to combine skills is to merge them.** Figma suggests asking the agent to "Merge these two skills together" when two related skills overlap (40283639496599).
- **What a skill can reference is connectors, not skills.** "Your skills can reference your connectors and you can invoke a skill and reference a connector in the same prompt." Neither help page says anything about a skill referencing another skill (40283639496599, 42287852075543).
- **Org and team publishing only changes who can see a skill.** Skills can be published to a team (only the team the source file is in) or to the whole organization. Nothing says a published skill can depend on or call another (40283639496599).
- **Your Figma custom skills are not served to external agents.** Figma's MCP server skill index (`skill://index.json`, read 2026-09-29) lists only Figma's own skills (`figma-use`, `figma-generate-design`, and others). It lists no user or org custom skills. The custom-skills page offers **Export** "so you can use it with your own agents" (40283639496599).

### Uncertain (not documented; needs a hands-on test)

- **Model-initiated loading.** The same page mentions a skill being "invoked automatically", and says a disabled skill "cannot be invoked automatically in chat or directly". This suggests the agent may choose some skills from their descriptions. But the "Use custom skills" section says you *must* invoke manually. It is unclear whether automatic loading exists, and whether it can happen mid-run after a user-invoked skill.
- **A skill naming another skill in its body.** Text like "now run /axis-contrast" might load a second skill mid-run, or might not. Figma does not say. The "only the first skill used will be invoked" limit makes this unlikely to work reliably.
- **Whether "first skill used" means first in the prompt text or first the agent loads.** The wording is ambiguous.
- **Whether a skill can be invoked on a later prompt in the same chat.** The Make-specific known issue ("you can't immediately invoke a skill in the first prompt that follows" a model switch; "Invoking skills in subsequent prompts after the first works as expected") suggests you can invoke one skill per turn across several turns. That points to a manual, turn-by-turn workaround.

Suggested test (for a prototype ticket): publish two trivial skills, A and B. A's body says "then use /B". Invoke `/A` and check whether B's marker text appears. Repeat with B only described (no slash) to probe automatic loading.

## External agents calling the Figma MCP server

### Confirmed

- **Figma expects skills to call other skills here.** `figma-generate-design`'s description says "Use this skill alongside figma-use". Its body says "**MANDATORY**: You MUST also load [figma-use](../figma-use/SKILL.md) before any `use_figma` call" and "invoke `/figma-create-new-file` … first" ([figma/mcp-server-guide@38308b7, skills/figma-generate-design/SKILL.md](https://github.com/figma/mcp-server-guide/blob/38308b7bbc676a9e9d57795ad4793fa9682d1644/skills/figma-generate-design/SKILL.md)). Figma calls `figma-generate-library` and `figma-generate-design` "examples of what's possible when you build on top of `figma-use`" and credits them with "multi-step orchestration" ([Figma skills for MCP](https://help.figma.com/hc/en-us/articles/39166810751895), updated 2026-09-22).
- **The MCP server can serve skills by URI.** It exposes `skill://index.json` (Agent Skills discovery schema 0.2.0) and `skill://figma/<name>/SKILL.md` through its `get_figma_skill` tool. A client without a Figma plugin can fetch Figma's skills mid-run. How clients pick skills depends on the client: they "may automatically apply a relevant skill when your prompt matches that skill's description", or the user types `/name` ([Use skills with the Figma MCP server](https://help.figma.com/hc/en-us/articles/39287396773399), updated 2026-09-23).
- **Claude Code.** "By default, both you and Claude can invoke any skill". Claude loads a skill on its own "when relevant". When Claude invokes a skill, "the rendered `SKILL.md` content enters the conversation as a single message and stays there across later turns". So a skill that says "use skill X" can lead Claude to load X in the same turn. `context: fork` runs a skill in its own subagent (`agent` sets the type), and subagents can preload skills with a `skills` field. `disable-model-invocation: true` blocks Claude from loading a skill on its own, so a skill meant to be called by the Orchestrator must leave it unset. Each skill's description plus `when_to_use` is truncated at 1,536 characters in the listing. ([Claude Code: Extend Claude with skills](https://code.claude.com/docs/en/skills))
- **Codex.** The skills system prompt says: "If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned." It also says "If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them" and "Do not delegate reading, summarizing, or interpreting skill instructions to a subagent." Explicit `$skill-name` mentions are collected into a list, so several skills load at once ([openai/codex@26dd19e, codex-rs/ext/skills/src/catalog_prompt.rs](https://github.com/openai/codex/blob/26dd19ef478cfa294406413bafedb84b49f93ea4/codex-rs/ext/skills/src/catalog_prompt.rs); [codex-rs/skills/src/selection.rs](https://github.com/openai/codex/blob/26dd19ef478cfa294406413bafedb84b49f93ea4/codex-rs/skills/src/selection.rs)).
- **Cursor.** Cursor "automatically discovers skills from skill directories and makes them available to Agent", and the agent decides when they are relevant. `/name` attaches a skill to one message. `disable-model-invocation: true` makes a skill load only on explicit `/name` ([Cursor: Agent Skills](https://cursor.com/docs/context/skills)).
- **The Agent Skills spec has no field for depending on or calling another skill.** Its frontmatter fields are `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. File references are relative paths inside the skill's own directory. Cross-skill loading is behavior each client adds on top of the spec ([agentskills.io/specification](https://agentskills.io/specification)).

### Uncertain

- **Cursor** documents neither several skills per turn nor one skill referencing another. It probably works through the same description-matching, but that is inferred.
- **Codex** says skills load "for that turn" only and are not carried forward unless mentioned again. A chain across several turns must re-mention each skill.
- **No client guarantees chaining.** Everywhere, loading a second skill is a model decision driven by instructions, not a runtime call with a guaranteed result. Firm wording ("MUST load X", as Figma uses) makes it more reliable.

## Implications for the Orchestrator

1. **Figma's agent:** ship the Orchestrator as one self-contained `.md` with each Review Axis inline (or in a compact form). Assume it cannot call separate Review Skills. Separate Review Skills are still worth publishing for users who want one axis at a time.
2. **External agents:** the same Orchestrator can tell the model to load the separate Review Skills by name when they are installed, and fall back to its inline copies when they are not. One file then works in both runtimes. Claude Code users can also run each axis in a forked subagent.
3. **Keep inline copies in sync with the standalone skills.** This is a maintenance cost. A build step that generates the combined Orchestrator from the Review Skills would remove it.
4. Leave `disable-model-invocation` unset on Review Skills so external agents can load them when the Orchestrator asks.
5. Run the test in "Uncertain" above before ruling out mid-run loading in Figma for good.
