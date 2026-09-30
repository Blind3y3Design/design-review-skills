---
name: drs-test-connector-write
description: Test skill for checking whether Figma's agent can write through a connector. Use only when the user runs /drs-test-connector-write.
---

Try each write below using only the connector it names. For each, reply with one line: the test id, then `WRITTEN` and a link to what you created, or `CANNOT WRITE` and the reason in one sentence (for example: the connector isn't connected, its write tools are disabled, or permission was refused). Report only what actually happened.

- **W1 GitHub issue.** Create an issue in `Blind3y3Design/design-review-skills` titled `drs-test: connector write check (close me)` with the body `Written by drs-test-connector-write.`
- **W2 GitHub file.** Create the file `tasks/figma-fetch-test/written-by-agent.md` on branch `task/figma-fetch-test` of `Blind3y3Design/design-review-skills`, containing the line `Written by drs-test-connector-write.`
- **W3 Google Drive.** Create a Google Doc titled `drs-test write check` containing the line `Written by drs-test-connector-write.`

Then list every connector tool you have that can create or change content.
