---
name: drs-test-plugin-api
description: Test skill C for checking what design data Figma's agent can read about the current selection. Use only when the user runs /drs-test-plugin-api.
---

Inspect the layers the user has selected. For each selected layer, report only what you can actually read from the file. Write `UNAVAILABLE` for anything you can't read, and never infer or guess.

For each layer, report:

1. Layer name, type and node id.
2. If it's a component instance: the main component's name and key, whether the main component is remote (comes from a library), and the name of that library.
3. If it looks like a detached instance (a frame that used to be an instance): what evidence you have for that.
4. For each fill, stroke and text style: whether it's bound to a variable or a style, and if so the variable or style name and the library that defines it. Otherwise give the raw value.

Then answer:

5. Which tools or capabilities did you use to read this? Did you run any Plugin API code (for example `figma.currentPage.selection` or `node.getMainComponentAsync()`)? If yes, show the code.
6. List every tool you have access to in this session.
