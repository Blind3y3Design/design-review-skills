# AGENTS.md

This repo holds portable `SKILL.md` files for reviewing design work (primarily in Figma) across multiple vectors, plus a meta skill that orchestrates them. See `README.md`.

## Constraints

- **Agent-agnostic.** Skills are plain, portable `SKILL.md` files. Don't depend on Claude Code plugin packaging or any single agent's features; they must be usable elsewhere, including inside Figma.
- **Configurable, not hard-coded.** No organisation-specific standards baked in. Skills reference design systems, research repositories, and guidelines that the user points them at.
- Use `/writing-for-agents` when creating or editing a `SKILL.md`.

## Agent skills

### Issue tracker

Issues, including the wayfinder map and its tickets, live in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
