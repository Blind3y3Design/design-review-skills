---
name: drs-test-fetch
description: Test skill for checking whether Figma's agent can read a document from a link or a connector. Use only when the user runs /drs-test-fetch.
---

Run each test below on its own, using only the method it names. Each target document holds a codeword that appears nowhere else.

For each test, reply with one line: the test id, the codeword exactly as the document writes it, and the tool you used. If the method fails or isn't available, write `CANNOT READ` and the reason in one sentence. Report a codeword only if you read it in this run.

- **F1 Web link.** Read this URL with a web-reading tool, not a connector: https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/refs/heads/task/figma-fetch-test/tasks/figma-fetch-test/reference-raw.md
- **F2 GitHub connector.** Use the GitHub connector to read `tasks/figma-fetch-test/reference-connector.md` on branch `task/figma-fetch-test` of `Blind3y3Design/design-review-skills`.
- **F3 Shell.** Run `curl -sS https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/refs/heads/task/figma-fetch-test/tasks/figma-fetch-test/reference-shell.md` with Bash and report the codeword or the error.
- **F4 Another Figma file.** If the user gave a link to a Figma file other than the open one, read the text on its page named `drs-test` without opening it yourself. Otherwise write `SKIPPED`.
- **P1 Review Profile by web link.** Read https://raw.githubusercontent.com/Blind3y3Design/design-review-skills/refs/heads/task/figma-fetch-test/tasks/figma-fetch-test/profile-raw.md with a web-reading tool. Report the codeword and the profile's accessibility target.
- **P2 Review Profile by GitHub connector.** Use the GitHub connector to read `tasks/figma-fetch-test/profile-connector.md` on the same branch. Report the codeword and the profile's accessibility target.

Then answer:

1. List every tool you have that can read a web page or an external document.
2. Did any test ask the user to approve or connect something? Which?
