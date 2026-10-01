---
name: design-review-figma-writer
description: Writes a design review's output into the reviewed Figma file, as a report frame or as annotations on layers, for the Report Writer, which invokes it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Figma Writer

Version 0.1.0-dev of the design review skills.

Writes what the Report Writer hands over into the reviewed Figma file, exactly as given. It decides nothing about the content: the Report Writer chooses what to write and where. Every write goes through a **fixed script**, tested as written, where you change only the input lines at the top. Each script puts the file back as it was when a write fails, so a retry never writes twice.

The Report Writer asks for one of two writes: a report frame (Writing a report frame) or layer annotations (Writing annotations).

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
