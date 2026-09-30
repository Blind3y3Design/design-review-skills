# design-review-skills

Agent skills for reviewing and evaluating design work, primarily in Figma, across multiple review axes, plus an Orchestrator skill that runs several reviews at once and merges their findings.

> **Status: planning.** The skill set, review axes, and output format are still being decided. Planning is tracked as a wayfinder map in this repo's [GitHub Issues](https://github.com/Blind3y3Design/design-review-skills/issues?q=label%3Awayfinder%3Amap). Anything below marked _planned_ may change.

## What's in here

### Review skills (planned)

Each review skill evaluates a design along one Review Axis and returns structured Findings. The first three axes to be specified:

- **Design system adherence**: components, tokens, variables and detached instances, checked against one or more layered design systems (pace layers)
- **Research alignment**: whether the design addresses, or contradicts, what users have said in research (for example, Dovetail)
- **Accessibility**: a design-stage WCAG review (not a conformance evaluation) covering criteria such as contrast, target size and use of colour, plus annotated items like text alternatives and focus order. It also reports which criteria it couldn't assess.

Visual hierarchy, content and UX writing, and interaction states are candidates for later. Terms are defined in [GLOSSARY.md](GLOSSARY.md); architecture decisions live in [docs/adr/](docs/adr/).

### Orchestrator (planned)

A skill that takes a Figma file, frame, or selection and runs several Review Skills on it: all the axes the Review Profile covers, a subset you name, or the ones you pick when it asks. It runs them in parallel where the agent supports it, and merges their Findings into one report.

### Report Writer (planned)

A skill that every other skill uses to write its report, so output is the same shape whether a Review Skill runs on its own or through the Orchestrator: a Markdown report, then a JSON block of Findings and Coverage.

### Design Scanner (planned)

A skill that reads the design once and returns Design Facts for the Review Skills to judge: components, bindings, detached instances, overrides, text, and measurements such as contrast. It holds all the Plugin API code, so every review reads the file the same way. Design review isn't delivered as a Figma plugin; see [ADR 0006](docs/adr/0006-design-facts-from-a-scanning-skill-not-a-plugin.md).

### Review Profile (planned)

Skills don't bundle any organisation's standards. A team's Review Profile names its design system layers, research sources, and accessibility target. If no profile exists, the skill walks the user through creating one on the first run.

Every skill is a single portable `SKILL.md` that works inside Figma Design's agent and in external agents such as Claude Code, Codex and Cursor. Skills invoke each other rather than copying each other's content. Figma Make isn't supported. See [ADR 0001](docs/adr/0001-portable-single-file-skills.md) and [ADR 0005](docs/adr/0005-chained-skills-only-figma-make-out-of-scope.md).

## Requirements

- [Claude Code](https://claude.com/claude-code) or another agent that supports skills
- The Figma MCP server, connected and authorised, so skills can read design context, screenshots, variables, and components

## Repository layout

```
.agents/skills/     Vendored development skills (mattpocock/skills), pinned by skills-lock.json
.claude/skills/     Symlinks exposing the vendored skills to Claude Code
skills-lock.json    Lockfile for the vendored skills
```

Folders for the design review skills, the Orchestrator and the Report Writer will be added once their structure is decided.

## Development workflow

This repo uses [Matt Pocock's skills](https://github.com/mattpocock/skills) for planning and building:

- **`/wayfinder`**: plans the work as a map of decision tickets on GitHub Issues. The map issue has the `wayfinder:map` label, and each ticket is a sub-issue with a `wayfinder:<type>` label.
- **`/grilling`** and **`/domain-modeling`**: work through decisions and record the terms and ADRs that come out of them.
- **`/writing-for-agents`**: used when writing or editing a `SKILL.md`.

Working through wayfinder tickets requires the [`gh` CLI](https://cli.github.com/), logged in to this repo.
