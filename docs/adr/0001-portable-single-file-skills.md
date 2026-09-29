# Portable single-file skills, not an agent plugin

Review Skills and the Orchestrator are standalone `SKILL.md` files following the open Agent Skills specification, not a Claude Code plugin. Each must work as a single file, because Figma's agent (in Figma Design and Figma Make) only accepts custom skills as one Markdown file, with no `references/`, `scripts/` or `assets/`. Designers across and beyond the organisation need to use the skills both inside Figma and in external agents (Claude Code, Codex, Cursor) via the Figma MCP server, without being tied to one vendor.

## Consequences

- Standards can't be bundled with a skill. They come from a Review Profile or from sources the user names when running it.
- Capabilities that need scripts, such as running axe, can only be optional additions for external agents. A skill must still produce useful Findings without them.
