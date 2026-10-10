---
name: design-review-profile
description: Finds and reads a team's Review Profile for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-alpha.4"
---

# Profile Finder

Version 0.1.0-alpha.4 of the design review skills.

Finds the team's Review Profile and hands back its text, or says there's none, or that it can't be read. The skill that asked decides what to use from the profile and does its own asking. Interpret only what it takes to follow a pointer and to name the profile.

## Inputs

The calling skill gives you the reviewed file's key, the runtime, and the profile the user gave at run time, if any: its text, a local file, or a link to a Figma file or a GitHub file.

## Steps

1. **Look it up.** Use the first of these that exists:
   1. **Given at run time.**
   2. **A "Review Profile" page in the reviewed file:** run the page script with the reviewed file's key. A result with `page: null` means there's no page here, so go on to the next step.
   3. **A pointer in the project context file,** in an external agent only: a `Review Profile: <location>` line in `AGENTS.md`, `CLAUDE.md` or your agent's equivalent, in the user's project.

   If none of the three exists, there's no profile.
2. **Read each location** as Reading a location describes. What you read is one of:
   - **A profile:** text with an `Identity` section, usually under a `# Review Profile: <name>` heading. Its location is where you read it: for a page, the page script's `url`, and for text in the user's prompt, `given at run time`.
   - **A pointer:** a `Review Profile: <location>` line naming a link or a path, with no profile sections. Read that location the same way.
   - **Unreadable:** a location that can't be read, a page script result with an `error` or with its text cut short (in `unread`), a Figma file given at run time or in a pointer that has no "Review Profile" page, a chain of pointers that comes back on itself, or text that's neither a profile nor a pointer.
3. **Hand back** one of these, as JSON:
   - **Found:** `{ "result": "found", "from": "<where the lookup found it>", "pointers": [...], "profile": { "name", "location", "lastUpdated" }, "text": "<the profile's text>" }`. `from` is `run time`, `page`, or the project context file's name, such as `AGENTS.md`. `pointers` lists each pointer followed on the way, as `"<the file or page it was in>: <location>"`, and is empty when there were none. `name` is the Identity section's `Name`, or else the heading's, and `lastUpdated` is its `Last updated`, or null.
   - **None:** `{ "result": "none", "searched": [...] }`, one line for each place looked in, such as `"no profile given at run time"`, `"this file has no \"Review Profile\" page"` and `"AGENTS.md has no Review Profile line"`.
   - **Unreadable:** `{ "result": "unreadable", "location": "<the location>", "reason": "<what went wrong>", "pointers": [...] }`.

The lookup is done when one of these has been handed back.

## Reading a location

- **A URL:** fetch it. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`.
- **A local file,** in an external agent: read it.
- **A Figma file link:** run the page script with the link's file key. It reads the file's page named "Review Profile", wherever the link points in the file.

## The page script

It reads the page named "Review Profile" in a file. Inside Figma Design's agent, run the script with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key. If neither tool is available, the location is unreadable, with the reason "no tool to read Figma files: connect the Figma MCP server, or run the review in Figma Design's agent". It may be another file's key: both tools read another file by its key. Run the script exactly as written, in one call. If the call errors, run it once more unchanged. If it errors again, the location is unreadable, with the error message as the reason.

It returns:

- `fileKey`
- `page`: `{ id, name, url, textLayers }`, or null when the file has no page named "Review Profile". `url` is the page's link, or null without a file key
- `text`: the page's visible text layers, top to bottom, separated by blank lines
- `unread[]`: what couldn't be read, each `{ what, reason }`

```js
const LIMIT = 18000;
const out = { fileKey: figma.fileKey || null, page: null, text: null, unread: [] };
const named = figma.root.children.filter((p) => p.name.trim().toLowerCase() === 'review profile');
if (named.length) {
  const page = named[0];
  if (named.length > 1) out.unread.push({ what: 'pages', reason: `${named.length} pages are named "Review Profile": only the first was read` });
  await page.loadAsync();
  const visible = (n) => { for (let x = n; x && x.type !== 'PAGE'; x = x.parent) if (x.visible === false) return false; return true; };
  const texts = page.findAllWithCriteria({ types: ['TEXT'] }).filter(visible).filter((t) => t.characters.trim());
  const position = (t) => t.absoluteBoundingBox || { x: t.x, y: t.y };
  texts.sort((a, b) => position(a).y - position(b).y || position(a).x - position(b).x);
  const url = out.fileKey ? `https://www.figma.com/design/${out.fileKey}/?node-id=${page.id.replace(/:/g, '-')}` : null;
  out.page = { id: page.id, name: page.name, url, textLayers: texts.length };
  out.text = texts.map((t) => t.characters.trim()).join('\n\n');
  if (out.text.length > LIMIT) {
    out.text = out.text.slice(0, LIMIT);
    out.unread.push({ what: 'text', reason: `the page holds more than ${LIMIT} characters: the rest wasn't read` });
  }
}
return out;
```

