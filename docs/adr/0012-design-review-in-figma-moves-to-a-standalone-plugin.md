# Design review in Figma moves to a standalone Cat plugin that shares no code with this set

ADR 0006 ruled out a plugin as the reviewer, because judgement needs an LLM. Two things have changed since. Running the review through an LLM agent has become a constraint on price and token use ([research/figma-plugin-port.md](../../research/figma-plugin-port.md)). And the owner has chosen to replace this one sweeping skill set with several smaller tools. Design review in Figma therefore becomes Cat's Design review plugin: a private organisation plugin that a designer runs alone, with no agent and no tokens. Code makes every decision a rule can make, and anything that needs judgement becomes a checklist item the designer answers. So the plugin still never calls an LLM, holds no secret, or sends design data out of Figma, and ADR 0006's reasons against an LLM-calling plugin still stand. The plugin is its own system, in its own private repository, with Cat's standards built in. It shares no code, formats or tests with this set: it starts from a one-time copy of what it can use, and owns that copy from then on. Research alignment is a separate tool, outside the plugin.

## Considered options

- **The research's hybrid:** the plugin runs the rule-based checks and hands a judgement payload to a slim agent skill. Rejected, because the plugin must work with no agent.
- **One check engine shared by the plugin and the skills.** Rejected, because this set is expected to be sunset, and sharing code would tie the plugin to it.
- **A plugin that calls an LLM through an organisation proxy.** Rejected for ADR 0006's reasons: it needs a server holding a key, and design data would leave Figma.

## Consequences

- ADR 0006's "a plugin is never the delivery path" no longer holds. Its other decisions still hold for this set: Design Facts come from the scanning skills, as ADR 0008 shapes them.
- This set is unchanged and keeps working in Figma Design's agent and in external agents. Whether and when it is sunset is a separate decision. When that decision is made, ADR 0009's deprecation rules apply: deprecate in a minor release, and remove no earlier than the next major.
- AGENTS.md's constraints (agent-agnostic, configurable rather than hard-coded) govern this set only. The plugin's repository has its own constraints. Nothing Cat-specific goes into this repository, which is public.
- Changes here don't flow to the plugin, and the plugin's changes don't flow back, so the two can review the same file differently.
- The plugin's plan lives in its own repository. [docs/plugin-migration-plan.md](../plugin-migration-plan.md) points to it.
