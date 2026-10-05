---
name: design-review-figma-writer
description: Writes into the reviewed Figma file: report frames, layer annotations and the Review Profile page, for the Report Writer and the Orchestrator, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-alpha.2"
---

# Figma Writer

Version 0.1.0-alpha.2 of the design review skills.

Writes into the reviewed Figma file: report frames, layer annotations and the Review Profile page, exactly as the Report Writer or the Orchestrator hands them over. It decides nothing about the content: the caller chooses what to write and where. Every write goes through a **fixed script**, tested as written, where you change only the input lines at the top. When a write fails, each script puts the file back as it was, except that an annotation category the layer annotations script added stays, since scripts can't delete one. A retry never writes twice.

The Report Writer asks for a report frame (Writing a report frame) or layer annotations (Writing annotations). The Orchestrator asks for a Review Profile page (Writing a Review Profile page).

## Writing a report frame

The Report Writer may ask you to save a report on the reviewed file's report page, the page named "Design review", as a frame of its own. The script lays out the text it's given.

1. **Pick the tool.** Inside Figma Design's agent, run the script with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the reviewed file's key. If neither tool is available, hand back `{ "error": "no tool to write to Figma files: connect the Figma MCP server, or run the review in Figma Design's agent" }`.
2. **Set the script's first three lines** from the Report Writer's hand-over, and run everything else exactly as written, in one call:
   - `NAME`: the frame's name, as a string
   - `MARKDOWN`: the Markdown report without its JSON block, as an array of strings, one per line
   - `REPORT`: the report JSON, as an object
3. **If the call is refused because the script is too long,** run it again with `const REPORT = null;`, so the frame goes without its JSON. If that's refused too, hand back `{ "error": "the report is too long to save as a frame" }`.
4. **If the call errors or returns an `error`,** run it once more unchanged. The script removes whatever it added before it returns an error, so a retry adds no second frame. If it fails again, hand back the error.
5. **Hand back** the script's output: `page` (`id`, `name`, and `created` when this call added it), `frame` (`id`, `name`), and `json`: `stored`, `too large`, or `not stored` with Figma's `jsonError`.

The frame is written when the script hands back a `frame`, or the error is handed back. The frame's last line says where its JSON is: in its shared plugin data, namespace `designreview`, key `report`, when that entry fits Figma's limit of 100 kB, or in the chat.

```js
const NAME = 'NAME';
const MARKDOWN = ['MARKDOWN'];
const REPORT = 'REPORT';
if (NAME === 'NAME' || MARKDOWN[0] === 'MARKDOWN' || REPORT === 'REPORT') return { error: 'set NAME, MARKDOWN and REPORT on the first three lines' };

const PAGE = 'Design review';
const NAMESPACE = 'designreview';
const KEY = 'report';
const LIMIT = 100000;
const GAP = 80;
const WIDTH = 720, PAD = 40;
const FONT = { regular: { family: 'Inter', style: 'Regular' }, semi: { family: 'Inter', style: 'Semi Bold' }, bold: { family: 'Inter', style: 'Bold' } };
const STYLE = [[FONT.regular, 13], [FONT.bold, 24], [FONT.bold, 18], [FONT.semi, 15]]; // body, then #, ## and ###

const utf8Bytes = (s) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };

// Inline Markdown: **bold**, [text](url) and `code` become plain text, with bold and link ranges.
const inline = (src) => {
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]*)`/g;
  let text = '', last = 0, m;
  const bold = [], links = [];
  while ((m = re.exec(src))) {
    text += src.slice(last, m.index);
    last = re.lastIndex;
    if (m[4] !== undefined) { text += m[4]; continue; }
    const start = text.length, inner = inline(m[1] ?? m[2]);
    for (const [s, e] of inner.bold) bold.push([start + s, start + e]);
    for (const [s, e, url] of inner.links) links.push([start + s, start + e, url]);
    text += inner.text;
    if (m[1] !== undefined) bold.push([start, text.length]);
    else links.push([start, text.length, m[3]]);
  }
  return { text: text + src.slice(last), bold, links };
};

// Blocks: a heading, or a paragraph of consecutive lines. Fenced blocks, such as the JSON, are left out.
const blocks = [];
let paragraph = null, fenced = false;
for (const raw of MARKDOWN) {
  const line = String(raw).trimEnd();
  const heading = /^(#{1,3})\s+(.*)$/.exec(line);
  if (/^\s*`{3}/.test(line)) { fenced = !fenced; paragraph = null; }
  else if (fenced) continue;
  else if (heading) { blocks.push({ level: heading[1].length, lines: [heading[2]] }); paragraph = null; }
  else if (!line.trim()) paragraph = null;
  else {
    if (!paragraph) blocks.push(paragraph = { level: 0, lines: [] });
    paragraph.lines.push(line.replace(/^(\s*)[-*]\s+/, '$1• '));
  }
}

// Anything this call adds is removed again if a write fails, such as without edit access.
let page = figma.root.children.find((p) => p.name.trim().toLowerCase() === PAGE.toLowerCase());
const created = !page;
let frame = null, json = 'too large', jsonError = null;
try {
  if (created) { page = figma.createPage(); page.name = PAGE; }
  await page.loadAsync();
  await Promise.all(Object.values(FONT).map((f) => figma.loadFontAsync(f)));
  frame = figma.createFrame();
  page.appendChild(frame);
  frame.name = NAME;
  frame.layoutMode = 'VERTICAL';
  frame.resize(WIDTH, 100);
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = PAD;
  frame.itemSpacing = 12;
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // The JSON goes in shared plugin data when the entry fits Figma's limit of 100 kB.
  const serialized = REPORT === null ? null : JSON.stringify(REPORT);
  if (serialized !== null && utf8Bytes(NAMESPACE + KEY + serialized) <= LIMIT) {
    try { frame.setSharedPluginData(NAMESPACE, KEY, serialized); json = 'stored'; } catch (e) { json = 'not stored'; jsonError = String((e && e.message) || e); }
  }
  const where = {
    'stored': `Report JSON: in this frame's shared plugin data, namespace "${NAMESPACE}", key "${KEY}".`,
    'too large': 'Report JSON: too large for this frame, so it stayed in the chat the review ran in.',
    'not stored': `Report JSON: not stored in this frame (${jsonError}), so it stayed in the chat the review ran in.`,
  };
  blocks.push({ level: 0, lines: [where[json]] });

  for (const block of blocks) {
    const { text, bold, links } = inline(block.lines.join('\n'));
    if (!text.trim()) continue;
    const [font, size] = STYLE[block.level];
    const t = figma.createText();
    frame.appendChild(t);
    t.fontName = font;
    t.fontSize = size;
    t.textAutoResize = 'HEIGHT';
    t.resize(WIDTH - 2 * PAD, t.height);
    t.characters = text;
    for (const [s, e] of bold) t.setRangeFontName(s, e, FONT.bold);
    for (const [s, e, url] of links) { t.setRangeHyperlink(s, e, { type: 'URL', value: url }); t.setRangeTextDecoration(s, e, 'UNDERLINE'); }
  }

  // Newest first: above everything already on the page, lined up with its left edge.
  const others = page.children.filter((n) => n !== frame);
  if (others.length) {
    frame.x = Math.min(...others.map((n) => n.x));
    frame.y = Math.min(...others.map((n) => n.y)) - frame.height - GAP;
  }
} catch (e) {
  if (frame && !frame.removed) frame.remove();
  if (created && page && !page.removed) page.remove();
  return { error: String((e && e.message) || e) };
}
return { page: { id: page.id, name: page.name, created }, frame: { id: frame.id, name: frame.name }, json, ...(jsonError ? { jsonError } : {}) };
```

## Writing a Review Profile page

The Orchestrator may ask you to save a Review Profile as the page named "Review Profile" in the reviewed file, where the Profile Finder looks for it, or to replace the text it read from that page. The script writes the text it's given into one text layer.

1. **Pick the tool.** As for a report frame.
2. **Set the script's first two lines** from the Orchestrator's hand-over, and run everything else exactly as written, in one call:
   - `TEXT`: the profile's Markdown, as an array of strings, one per line
   - `BEFORE`: `null` to add the page, or, to replace the page's text, the text the Profile Finder read from it, as an array of strings, one per line
3. **If the call is refused because the script is too long,** hand back `{ "error": "the profile is too long to save as a page" }`.
4. **If the call errors or returns an `error`,** run it once more unchanged, unless the error says the page is already there, the text changed or the page isn't one text layer: hand those back at once. The script removes the page it added, and puts the old text back, before it returns an error, so a retry starts from the file as it was. If it fails again, hand back the error.
5. **Hand back** the script's output: `page` (`id`, `name`, `url`, and `created`) and `layer` (`id`).

The page is written when the script hands back a `page`, or the error is handed back.

What the script refuses, with an `error` and no change to the file:

- **To add a page that is already there,** whatever it holds.
- **To replace text** unless the page holds exactly one visible text layer, whose text is `BEFORE`. A page with more text layers, a designer's notes among them, or text that changed since the Profile Finder read it, is theirs to edit.

```js
const TEXT = ['TEXT'];
const BEFORE = 'BEFORE';
if (TEXT[0] === 'TEXT' || BEFORE === 'BEFORE') return { error: 'set TEXT and BEFORE on the first two lines' };

const PAGE = 'Review Profile';
const WIDTH = 720;
const FONT = { family: 'Inter', style: 'Regular' };
const same = (a, b) => a.trim() === b.trim();
// The page, found as the Profile Finder finds it, and the text layers it reads there.
const visible = (n) => { for (let x = n; x && x.type !== 'PAGE'; x = x.parent) if (x.visible === false) return false; return true; };
const profileTexts = (p) => p.findAllWithCriteria({ types: ['TEXT'] }).filter(visible).filter((t) => t.characters.trim());

let page = figma.root.children.find((p) => p.name.trim().toLowerCase() === PAGE.toLowerCase());
const created = BEFORE === null;
if (created && page) return { error: `a "${PAGE}" page is already in this file` };
if (!created && !page) return { error: `no "${PAGE}" page in this file` };

let layer = null, previous = null;
try {
  if (created) { page = figma.createPage(); page.name = PAGE; }
  await page.loadAsync();
  if (created) {
    await figma.loadFontAsync(FONT);
    layer = figma.createText();
    page.appendChild(layer);
    layer.name = PAGE;
    layer.fontName = FONT;
    layer.fontSize = 14;
    layer.textAutoResize = 'HEIGHT';
    layer.resize(WIDTH, layer.height);
    layer.characters = TEXT.join('\n');
  } else {
    const found = profileTexts(page);
    if (!found.length) return { error: `the "${PAGE}" page has no text layer to replace` };
    if (found.length > 1) return { error: `the "${PAGE}" page holds ${found.length} text layers, so it isn't safe to replace its text` };
    layer = found[0];
    if (!same(layer.characters, BEFORE.join('\n'))) return { error: `the "${PAGE}" page's text changed since it was read` };
    previous = layer.characters;
    await Promise.all(layer.getRangeAllFontNames(0, layer.characters.length).map((f) => figma.loadFontAsync(f)));
    layer.characters = TEXT.join('\n');
  }
} catch (e) {
  if (created && page && !page.removed) page.remove();
  else if (layer && previous !== null) { try { layer.characters = previous; } catch (_) { /* nothing more to undo */ } }
  return { error: String((e && e.message) || e) };
}
const url = figma.fileKey ? `https://www.figma.com/design/${figma.fileKey}/?node-id=${page.id.replace(/:/g, '-')}` : null;
return { page: { id: page.id, name: page.name, url, created }, layer: { id: layer.id } };
```

## Writing annotations

The Report Writer may ask you to mark a review's Findings on their layers, as Figma annotations in the review's own annotation categories. The script writes the text it's given.

1. **Pick the tool.** Inside Figma Design's agent, run the script with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the reviewed file's key. If neither tool is available, hand back `{ "error": "no tool to write to Figma files: connect the Figma MCP server, or run the review in Figma Design's agent" }`.
2. **Set the script's first three lines** from the Report Writer's hand-over, and run everything else exactly as written, in one call:
   - `SCOPE`: the run's scope, as an array of node ids
   - `AXES`: the axes the run covered, such as `['accessibility']`
   - `MARKS`: an array of marks, one per Finding, each `{ axis, finding, nodes, text }`: the axis, the Finding's short id, the node ids to mark, and the annotation's Markdown
3. **If the call is refused because the script is too long,** split `MARKS` into parts that fit, and run one call per part, in order: the first with `AXES` as given, and each later one with `const AXES = [];`, so that only the first clears.
4. **If the call errors or returns an `error`,** run it once more unchanged. The script puts back every layer it changed before it returns an error, so a retry starts from the file as it was. If it fails again, hand back the error, with its `categoriesAdded`. When a later part of a split run fails, the parts before it stay written: hand back their output with the error.
5. **Hand back** the script's output. For a split run, add up `cleared`, `written` and `marked`, and join the lists.
   - `categories`: each axis's category, `{ axis, label, id, created }`, where `created` says this call added it
   - `cleared`: how many of the review's annotations were removed, and `written`: how many were added
   - `marked`: how many marks were placed on at least one layer
   - `moved`: each of a mark's nodes that can't hold annotations, such as a group, whose mark went on the nearest layer holding it, as `{ finding, node, to }`
   - `unmarked`: each of a mark's nodes that wasn't marked, as `{ finding, node, reason }`
   - `movedTotal` and `unmarkedTotal`, when their lists were cut at 20

The annotations are written when the script hands back its counts, or the error is handed back.

What the script does, in order:

- **Clears** every annotation in the categories of `AXES`, on the scanned nodes and every layer inside them, hidden layers and layers inside instances included.
- **Marks** each of a mark's `nodes` with one annotation, in its axis's category, adding the category when the file has none. A layer never gets the same mark twice. A node outside `SCOPE` isn't marked, so the next run on that scope clears everything this one writes.
- **Leaves** every other annotation as it was, including the designer's own and other axes' review annotations.

```js
const SCOPE = ['SCOPE'];
const AXES = ['AXES'];
const MARKS = ['MARKS'];
if (SCOPE[0] === 'SCOPE' || AXES[0] === 'AXES' || MARKS[0] === 'MARKS') return { error: 'set SCOPE, AXES and MARKS on the first three lines' };

// The review's own annotation categories, one per axis. The Design Scanner's annotations script leaves out every category named "Design review: <axis>".
const CATEGORIES = {
  'design-system': { label: 'Design review: Design system adherence', color: 'teal' },
  'accessibility': { label: 'Design review: Accessibility', color: 'violet' },
  'research': { label: 'Design review: Research alignment', color: 'yellow' },
};
const unknown = [...AXES, ...MARKS.map((m) => m.axis)].filter((axis) => !Object.prototype.hasOwnProperty.call(CATEGORIES, axis));
if (unknown.length) return { error: `unknown axis: ${[...new Set(unknown)].join(', ')}` };
const badMark = MARKS.findIndex((m) => typeof m.finding !== 'string' || !Array.isArray(m.nodes) || typeof m.text !== 'string' || !m.text.trim());
if (badMark >= 0) return { error: `mark ${badMark} needs a finding, nodes and a text` };

const existing = await figma.annotations.getAnnotationCategoriesAsync();
// A category is an axis's review category by its label, ignoring case and trailing spaces, as the annotations script reads it.
const isReviewCategory = (c, axis) => c.label.trimEnd().toLowerCase() === CATEGORIES[axis].label.toLowerCase();
const categoryOf = (axis) => existing.find((c) => isReviewCategory(c, axis)) || null;
// This run clears the review's categories for the axes it covered.
const clearing = new Set(existing.filter((c) => AXES.some((axis) => isReviewCategory(c, axis))).map((c) => c.id));

// An annotation as Figma takes it back: its label or its Markdown (never both), its pinned properties and its category.
const writable = (a) => {
  const o = a.labelMarkdown ? { labelMarkdown: a.labelMarkdown } : a.label ? { label: a.label } : {};
  if (a.properties && a.properties.length) o.properties = a.properties.map((p) => ({ ...p }));
  if (a.categoryId) o.categoryId = a.categoryId;
  return o;
};

// The scope: each scanned node and every layer inside it, hidden ones and those inside instances included.
const inScope = new Map();
for (const id of SCOPE) {
  const n = await figma.getNodeByIdAsync(id);
  if (!n) return { error: `no node with id ${id}` };
  let page = n;
  while (page.parent && page.type !== 'PAGE') page = page.parent;
  if (page.type === 'PAGE') await page.loadAsync();
  for (const x of [n, ...('findAll' in n ? n.findAll() : [])]) inScope.set(x.id, x);
}

// Each layer's annotations after this run, worked out before anything is written. A new mark waits for its category.
const plan = new Map();
const planFor = (n) => {
  if (!plan.has(n.id)) { const before = n.annotations.map(writable); plan.set(n.id, { node: n, before, after: [...before] }); }
  return plan.get(n.id);
};
let cleared = 0;
for (const x of inScope.values()) {
  if (!('annotations' in x)) continue;
  const count = x.annotations.filter((a) => clearing.has(a.categoryId)).length;
  if (!count) continue;
  const entry = planFor(x);
  entry.after = entry.after.filter((a) => !clearing.has(a.categoryId));
  cleared += count;
}
// Each mark goes on its layers. A layer that can't hold annotations, such as a group, passes its mark to the nearest
// layer holding it that can. A layer never gets the same mark twice. Only layers in the scope are marked, so the next
// run on this scope clears every mark this one writes.
let written = 0, marked = 0;
const moved = [], unmarked = [];
for (const mark of MARKS) {
  let placed = false;
  for (const id of mark.nodes) {
    if (!inScope.has(id)) { unmarked.push({ finding: mark.finding, node: id, reason: 'not a layer in the scope' }); continue; }
    let holder = inScope.get(id);
    while (holder && !('annotations' in holder)) holder = holder.parent ? inScope.get(holder.parent.id) : undefined;
    if (!holder) { unmarked.push({ finding: mark.finding, node: id, reason: 'no layer in the scope can hold an annotation here' }); continue; }
    if (holder.id !== id) moved.push({ finding: mark.finding, node: id, to: holder.id });
    placed = true;
    const entry = planFor(holder), category = categoryOf(mark.axis);
    const same = (a) => a.labelMarkdown === mark.text && (a.axis === mark.axis || (category && a.categoryId === category.id));
    if (entry.after.some(same)) continue;
    entry.after.push({ labelMarkdown: mark.text, axis: mark.axis });
    written++;
  }
  if (placed) marked++;
}

// The writes: each category a new mark needs, then each layer whose annotations change. If Figma refuses one, such as
// without edit access, every layer written goes back as it was. A category added stays: scripts can't delete one.
const categories = new Map(), added = [], applied = [];
try {
  for (const axis of [...new Set([...AXES, ...MARKS.map((m) => m.axis)])]) {
    const { label, color } = CATEGORIES[axis];
    let category = categoryOf(axis);
    const created = !category && [...plan.values()].some((e) => e.after.some((a) => a.axis === axis));
    if (created) { category = await figma.annotations.addAnnotationCategoryAsync({ label, color }); added.push({ axis, label, id: category.id }); }
    if (category) categories.set(axis, { axis, label, id: category.id, created });
  }
  for (const entry of plan.values()) {
    const after = entry.after.map(({ axis, ...a }) => (axis ? { ...a, categoryId: categories.get(axis).id } : a));
    if (JSON.stringify(after) === JSON.stringify(entry.before)) continue;
    entry.node.annotations = after;
    applied.push(entry);
  }
} catch (e) {
  for (const entry of applied.reverse()) { try { entry.node.annotations = entry.before; } catch (_) { /* nothing more to undo */ } }
  return { error: String((e && e.message) || e), ...(added.length ? { categoriesAdded: added } : {}) };
}
// The moved and unmarked lists stop at SAMPLES each, with their totals, to keep the output small.
const SAMPLES = 20;
const out = { categories: [...categories.values()], cleared, written, marked, moved: moved.slice(0, SAMPLES), unmarked: unmarked.slice(0, SAMPLES) };
if (moved.length > SAMPLES) out.movedTotal = moved.length;
if (unmarked.length > SAMPLES) out.unmarkedTotal = unmarked.length;
return out;
```
