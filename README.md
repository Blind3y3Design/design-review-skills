# design-review-skills

Agent skills for reviewing design work in Figma, along several Review Axes, plus an Orchestrator skill that runs several reviews at once and merges their Findings into one report.

> **Status: before the first release.** The set described here is what the repo holds today, working toward v0.1.0. Research alignment follows in v0.2 ([#50](https://github.com/Blind3y3Design/design-review-skills/issues/50)). Planning is tracked as a wayfinder map in this repo's [GitHub Issues](https://github.com/Blind3y3Design/design-review-skills/issues?q=label%3Awayfinder%3Amap).

Every skill is a single portable `SKILL.md` that works inside Figma Design's agent and in external agents such as Claude Code, Codex and Cursor. Skills invoke each other rather than copying each other's content. Figma Make isn't supported. Terms are defined in [GLOSSARY.md](GLOSSARY.md); architecture decisions live in [docs/adr/](docs/adr/).

## What's in here

### Review Skills

Each Review Skill judges a design along one Review Axis and reports Findings and Coverage. Skills don't bundle any organisation's standards: they judge from a Reference Document, a document of standards content that they read from a link.

- **Design system adherence** (`design-review-library`): how a design uses its Design System Layers. Its Reference Document, the [Design system baseline](reference-documents/design-system-baseline.md), holds six built-in checks: raw values where a variable or style could be bound, assets from outside the stack, assets that can't be attributed, detached instances, direct overrides and resized instances. A team can fork the baseline and point to its copy from its Review Profile.
- **Accessibility** (`design-review-accessibility`): a design-stage WCAG review (not a conformance evaluation) against the [WCAG 2.2 criteria reference](reference-documents/wcag-2.2-criteria.md), which covers WCAG 2.2 and 2.1 at Levels A and AA. It judges criteria such as contrast, target size and use of colour from measured Design Facts, and others, such as text alternatives and focus order, from the designer's annotations and marked sections. It reports which criteria it couldn't assess and why.

Visual hierarchy, content and UX writing, and interaction states are candidates for later.

### Orchestrator

`design-review` takes a Figma file, frame or selection and runs several Review Skills on it: all the axes the Review Profile covers, a subset you name, or the ones you pick when it asks. It reads the design once and merges the Findings into one report.

### Supporting skills

The other skills do one job each for the skills above. They are installed and published with them.

- **Report Writer** (`design-review-report-writer`): writes every report, so output is the same shape whether a Review Skill runs on its own or through the Orchestrator. A Markdown report, then a JSON block of Findings and Coverage. It delivers the report to the chat and saves it, and can mark Findings on their layers as annotations.
- **Design Scanner** (`design-review-scanner`): one skill that reads the design once and returns Design Facts for the Review Skills to judge. It orchestrates six scanning skills, one per fact group, joining their results per node: `design-review-scanner-colour-pairs` (contrast ratios), `-text`, `-structure`, `-annotations`, `-bindings` and `-components`. Each scanning skill holds the fixed script that reads its group, so each group's script and shape stays a skill-sized document within Figma's 65,536-character skill limit. Their fixed scripts read the file the same way in every review, and they only read. Design review isn't delivered as a Figma plugin; see [ADR 0006](docs/adr/0006-design-facts-from-a-scanning-skill-not-a-plugin.md) and [ADR 0008](docs/adr/0008-scanner-orchestrator-calls-single-responsibility-scanners.md).
- **Profile Finder** (`design-review-profile`): finds the team's Review Profile and hands back its text.
- **Figma Writer** (`design-review-figma-writer`): writes into the reviewed Figma file: report frames and layer annotations for the Report Writer, and the Review Profile page for the Orchestrator.

### Review Profile

A team's Review Profile names the standards a review is judged against: its Design System Layers, accessibility target, product context, report settings and any Severity overrides. It is found, in order, from a profile given with the request, a page named "Review Profile" in the Figma file, and a `Review Profile: <location>` line in the project's `AGENTS.md` or `CLAUDE.md`. A Review Skill run on its own can work without a profile: it asks what to check against, for that run only. [`tests/smoke/profiles/smoke-test-profile.md`](tests/smoke/profiles/smoke-test-profile.md) is a complete example. Because a team's standards live in its profile and in documents it points to, no skill is edited to suit a team.

## Requirements

- Figma Design's agent, or an external agent that supports skills, such as [Claude Code](https://claude.com/claude-code), Codex or Cursor
- In an external agent, the Figma MCP server, connected and authorised, so skills can read design context, variables and components. Saving a report to the file or marking layers needs edit access to it
- Node.js, for `npx skills`

## Installing

The skills are published and versioned together. Install all of them: a review stops and names any skill it needs that isn't installed. The first release has thirteen; research alignment (`design-review-research`) joins in v0.2.

| Skill | What it does |
|---|---|
| `design-review` | The Orchestrator: runs several reviews and merges them into one report |
| `design-review-library` | Design system adherence: how a design uses its libraries |
| `design-review-accessibility` | Accessibility: a design-stage WCAG review |
| `design-review-report-writer` | Writes every report (used by the other skills) |
| `design-review-scanner` | Reads the design and returns Design Facts, orchestrating the six scanning skills below and joining their results per node (used by the Orchestrator and the Review Skills) |
| `design-review-scanner-colour-pairs` | Reads the colour pairs fact group (contrast ratios) for the Design Scanner |
| `design-review-scanner-text` | Reads the text fact group for the Design Scanner |
| `design-review-scanner-structure` | Reads the structure fact group for the Design Scanner |
| `design-review-scanner-annotations` | Reads the annotations fact group for the Design Scanner |
| `design-review-scanner-bindings` | Reads the bindings fact group (variables and styles) for the Design Scanner |
| `design-review-scanner-components` | Reads the components fact group for the Design Scanner |
| `design-review-profile` | Finds the team's Review Profile (used by the other skills) |
| `design-review-figma-writer` | Writes into the reviewed Figma file: report frames, layer annotations and the Review Profile page (used by the Report Writer and the Orchestrator) |

- **Figma Design:** an organisation's skill owners publish all thirteen to the organisation, in the order in [docs/publishing.md](docs/publishing.md).
- **Claude Code, Codex or Cursor:** in your project, run `npx skills add Blind3y3Design/design-review-skills --all`. It installs the thirteen skills into `.agents/skills/`, and links them for agents that read another folder, such as `.claude/skills/`. `npx skills update` brings in a new release. Copying the `skills/` folder works too. The repo's location will change once it moves into Cat's systems.

Nothing is built or edited before publishing: a published skill is the release file as it stands ([ADR 0007](docs/adr/0007-publish-skills-exactly-as-released.md)). To release the set, follow [docs/publishing.md](docs/publishing.md).

## Using

Ask the agent for a review and link the frames, such as "Run `design-review` on <Figma link>", or for one axis, such as "Run `design-review-accessibility` on <Figma link>". The report is in the chat, and is saved as a frame on a "Design review" page in the file unless you say "don't save" or your Review Profile says where reports go.

## Repository layout

```
skills/<name>/SKILL.md     The design review skills, one folder each, holding only SKILL.md
reference-documents/       WCAG 2.2 criteria reference and the Design system baseline
scripts/release.mjs        Checks the set's version and an install; `set` is the emergency writer (see docs/publishing.md)
tests/smoke/               Smoke test: case list, expected Findings JSON, comparison script, link to the Figma test file
tests/scripts/             Tests for the scripts in the skills and for release.mjs, run against a fake of the Figma Plugin API
docs/adr/                  Architecture decisions
docs/agents/               Issue tracker, triage labels and domain docs for agents
docs/publishing.md         Release and publishing checklist
.agents/skills/            Vendored development skills (mattpocock/skills), pinned by skills-lock.json
.claude/skills/            Symlinks exposing the vendored skills to Claude Code
skills-lock.json           Lockfile for the vendored skills
```

Research notes, hands-on test assets and prototypes live on their own branches (`research/*`, `task/*`, `prototype/*`).

## Development workflow

This repo uses [Matt Pocock's skills](https://github.com/mattpocock/skills) for planning and building:

- **`/wayfinder`**: plans the work as a map of decision tickets on GitHub Issues. The map issue has the `wayfinder:map` label, and each ticket is a sub-issue with a `wayfinder:<type>` label.
- **`/grilling`** and **`/domain-modeling`**: work through decisions and record the terms and ADRs that come out of them.
- **`/writing-for-agents`**: used when writing or editing a `SKILL.md`.

Working through wayfinder tickets requires the [`gh` CLI](https://cli.github.com/), logged in to this repo.

### Releasing

The set ships under one SemVer version against a declared public contract ([ADR 0009](docs/adr/0009-versioning-policy-and-public-contract.md)). Work merges into `integration`; release-please opens a standing Release PR there, the owner merges it, release-please tags the release, and a workflow fast-forwards `main` to the tag — so `main` always mirrors the latest release that unpinned consumers install ([ADR 0010](docs/adr/0010-branching-and-branch-protection.md)). The owner cuts and approves releases, and publishes the skills by hand in Figma afterwards ([ADR 0011](docs/adr/0011-release-governance-and-ownership.md)). The full checklist, including pre-releases, is in [docs/publishing.md](docs/publishing.md).
