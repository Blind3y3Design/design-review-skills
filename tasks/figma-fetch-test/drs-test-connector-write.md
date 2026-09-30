---
name: drs-test-connector-write
description: Test skill for checking whether Figma's agent can write through a connector. Use only when the user runs /drs-test-connector-write.
---

Try each write below using only the method it names. For each, reply with one line: the test id, then `WRITTEN` and a link to what you created, or `CANNOT WRITE` and the reason in one sentence (for example: the connector isn't connected, its write tools are disabled, the tool doesn't exist, or permission was refused). Report only what actually happened.

- **W1 GitHub issue.** Create an issue in `Blind3y3Design/design-review-skills` titled `drs-test: connector write check (close me)` with the body `Written by drs-test-connector-write.`
- **W2 GitHub file.** Create the file `tasks/figma-fetch-test/written-by-agent.md` on branch `task/figma-fetch-test` of `Blind3y3Design/design-review-skills`, containing the line `Written by drs-test-connector-write.`
- **W3 Page in this file.** Create a page named `drs-test write check` in the open Figma file, holding one text layer with the line `Written by drs-test-connector-write.`
- **W4 Custom skill.** Create a private custom skill named `drs-test-created-skill` whose description is `Test skill created by an agent. Use only when the user runs /drs-test-created-skill.` and whose body is the line `Reply with: Written by drs-test-connector-write.`

Then list every tool you have that can create or change content outside the open file's layers.
