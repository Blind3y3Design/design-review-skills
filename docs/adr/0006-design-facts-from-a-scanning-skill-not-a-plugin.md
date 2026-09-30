# Design Facts come from a scanning skill; a plugin is never the delivery path

Design review is delivered by the Orchestrator and Review Skills, not by a custom Figma plugin. Two independent reviews ([issue #20](https://github.com/Blind3y3Design/design-review-skills/issues/20)) reached this for the same reasons. The review's value is judgement, and a plugin can only reach an LLM through an org-run proxy, because plugin source is readable and can't hold a key, so design data would leave Figma. A plugin also runs only inside Figma, can't use Figma's connectors or read other Figma files, and would drop research alignment. What a plugin does better is read the design the same way every time. We keep that by putting all Plugin API code in one Design Scanner skill. It reads the scope, measures what code measures well (such as contrast against the computed background), and returns Design Facts, which the Review Skills judge against their Reference Documents.

## Consequences

- The Design Scanner is a required skill (ADR 0004): if it won't load, the run stops and names it. An Orchestrator run scans once and passes the Design Facts to every Review Skill. A Review Skill run on its own invokes the scanner itself.
- Callers ask for groups of facts, and results come back one top-level frame at a time, to stay under tool output limits. Every result states a `factsVersion`, the scope, the runtime, which groups were read, and anything that couldn't be read. The scanner records a library name only where `figma.teamLibrary` works.
- The scanner holds no thresholds or criteria. When a measurement can't be made, such as text over an image, the fact says why, and the Review Skill reports it as `needs-review` or as `not-readable` in Coverage.
- A read-only plugin may be added later as another source of Design Facts or as a way to view Findings, never as the reviewer. Either must make no network calls and hold no secrets:
  - **A facts plugin**, with the `teamlibrary` permission, if real-file testing shows the scan is too slow or `likely` variable attribution too noisy. It is also the fallback if `evaluate_script` goes away (ADR 0005).
  - **A Findings panel** that reads the report JSON saved on the report frame, if designers find long chat reports hard to work through.
- Generative plugins can't do the review. Figma documents that they can't call third-party APIs, and their manifest can't be changed.
