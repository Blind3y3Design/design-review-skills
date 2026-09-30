# Review Profile: Smoke test, critical override

Profile version: 0.1

## Identity

What this profile is called and who maintains it.

- Name: Smoke test, critical override
- Owner: Design review skills maintainers
- Last updated: 2026-09-30

## Design System Layers

The design systems this work is checked against, most general first. A more specific layer overrides a more general one, unless the general layer locked the rule.

- Baseline: the skill's default

### 1. Foundation

- Libraries: DRS Test Foundation (https://www.figma.com/design/p4hWSJjXkqdLc7DJpY9u3b/DRS-Test-Foundation)
- Match hints: prefix `Test Foundation/`
- Rules document: none (Design system baseline only)

### 2. Product

- Libraries: DRS Test Product (https://www.figma.com/design/6AgQWwNtnykwWB79p7z6db/DRS-Test-Product)
- Match hints: prefix `Test Product/`
- Rules document: none (Design system baseline only)

## Accessibility

The accessibility standard designs are judged against.

- Standard: WCAG
- Version: 2.2
- Level: AA
- Criteria reference: the skill's default

## Severity Overrides

The starting Severity this team sets for a type of rule, in place of the review's default. No override lowers a Locked Rule breach below serious, and one that sets critical names the core task it's tied to.

- WCAG AA failures: critical
