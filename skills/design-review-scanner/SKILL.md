---
name: design-review-scanner
description: Reads Figma frames and returns their Design Facts, such as text contrast ratios, for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from the script under The script, where you change only the node id on its first line. A skill can also ask for a file's Review Profile page, which is read by a script of its own (see Reading a Review Profile page), and the Report Writer asks you to save its report frames (see Writing a report frame).

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This version reads one group, `colourPairs`.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id.** Copy the script below and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written. Run one call per id, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id and the error message in that result's `unread`.
3. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of scanning each of those ids.
4. **Record groups you can't read.** For each fact group the caller asked for other than `colourPairs`, add `{ "what": "<group>", "reason": "not read by this version of the scanner" }` to every result's `unread`.

The scan is done when every id in the scope has a result, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, each the script's output with `"runtime"` added. Pass the values on as the script returned them.

## Design Facts format

`factsVersion` 0.1. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame.
- `groups`: the fact groups read.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead.
- `colourPairs`: the colour pairs group, or null when it wasn't read.

### Colour pairs

Each visible, non-empty text layer in the scope, measured against the layers painted beneath it. Hidden layers and layers at zero opacity are skipped. A text layer with several colours, sizes or weights gives one pair per run of text.

- `textLayers`: how many text layers were measured.
- `groups[]`: pairs grouped by Root Cause. Pairs share a group when they have the same text colour source, background, font size, weight and flags. A raw text colour's source is its own layer, so each raw-coloured text layer is its own group, while text bound to one variable or style on one background shares a group. Each group has:
  - `text`: `{ hex, source }`. `source.kind` is `variable` or `style`, with its `key`, `name` and `remote`, when the text colour is bound to one. Otherwise it's `raw`, with the text layer's id as `node`.
  - `background`: `{ hex, source, node }`: the colour behind the text, its source, and the layer it comes from. Null when it couldn't be computed.
  - `fontSize` in px, and `fontWeight`.
  - `ratio`: the contrast ratio, rounded down to 2 decimal places. Null when it couldn't be computed.
  - `flags[]`: `opacity` when translucency is involved (on the text, its background or a parent layer), and `blend-mode` when a blend mode is. With a flag, the colours and ratio are an estimate.
  - `reason`: why the pair couldn't be computed, such as text over an image or a gradient, a background that covers only part of the text, or no opaque background. Null otherwise.
  - `count`: the text layers in the group. `nodes[]`: up to 10 of them, each `{ id, path }`, where `path` is the layer path from the top-level frame.

## The script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.1';
const LIMIT = 18000;
const SAMPLES = 10;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['colourPairs'], unread: [], colourPairs: null };
const childIds = (n) => ('children' in n ? n.children.map(c => c.id) : []);

const node = await figma.getNodeByIdAsync(NODE_ID);
if (!node) { out.unread.push({ what: NODE_ID, reason: 'no node with this id' }); return out; }
let page = node;
while (page.parent && page.type !== 'PAGE') page = page.parent;
if (page.type === 'PAGE') await page.loadAsync();
if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
  out.groups = [];
  out.unread.push({ what: NODE_ID, reason: 'a page, not a layer: scan each id in scanInstead', scanInstead: childIds(node) });
  return out;
}
let topFrame = node;
while (topFrame.parent && topFrame.parent.type !== 'PAGE') topFrame = topFrame.parent;
out.scope = { id: node.id, name: node.name, type: node.type, page: page.name, topLevelFrame: topFrame.id === node.id ? null : { id: topFrame.id, name: topFrame.name } };

const intersect = (a, b) => {
  if (!a || !b) return a || b;
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x, h = Math.min(a.y + a.height, b.y + b.height) - y;
  return { x, y, width: Math.max(0, w), height: Math.max(0, h) };
};
const isEmpty = (r) => !r || r.width <= 0 || r.height <= 0;
const covers = (outer, inner) => outer.x <= inner.x + 0.01 && outer.y <= inner.y + 0.01 && outer.x + outer.width >= inner.x + inner.width - 0.01 && outer.y + outer.height >= inner.y + inner.height - 0.01;
const alpha = (paint) => paint.opacity ?? 1;
const paintBlended = (paint) => Boolean(paint.blendMode) && paint.blendMode !== 'NORMAL';
const layerBlended = (n) => 'blendMode' in n && n.blendMode !== 'NORMAL' && n.blendMode !== 'PASS_THROUGH';
const shown = (fills) => (Array.isArray(fills) ? fills.filter(p => p.visible !== false && alpha(p) > 0) : []);

// Paint order: a pre-order walk of the top-level frame, children back to front.
// Everything earlier in the walk is painted below everything later.
const texts = [], painted = [];
let order = 0;
const walk = (n, inScope, parentTranslucent, parentBlended, clip, parentPath) => {
  if (n.visible === false || ('opacity' in n && n.opacity === 0)) return;
  const layer = {
    n,
    order: order++,
    translucent: parentTranslucent || ('opacity' in n && n.opacity < 1),
    blended: parentBlended || layerBlended(n),
    clip,
    path: parentPath ? `${parentPath} / ${n.name}` : n.name,
  };
  const scoped = inScope || n.id === node.id;
  const box = n.absoluteBoundingBox;
  if (n.type === 'TEXT') {
    if (scoped) texts.push(layer);
  } else if (!n.isMask && 'fills' in n && shown(n.fills).length && box) {
    painted.push({ ...layer, box: intersect(box, clip) });
  }
  if ('children' in n && n.type !== 'BOOLEAN_OPERATION') {
    let inner = 'clipsContent' in n && n.clipsContent && box ? intersect(box, clip) : clip;
    const kids = n.itemReverseZIndex ? [...n.children].reverse() : n.children;
    for (const c of kids) {
      walk(c, scoped, layer.translucent, layer.blended, inner, layer.path);
      if (c.isMask && c.visible !== false && c.absoluteBoundingBox) inner = intersect(inner, c.absoluteBoundingBox);
    }
  }
};
walk(topFrame, false, false, false, null, '');

const vars = new Map(), styles = new Map();
const sourceOf = async (paint, styleId) => {
  const alias = paint.boundVariables && paint.boundVariables.color;
  if (alias && alias.id) {
    if (!vars.has(alias.id)) vars.set(alias.id, await figma.variables.getVariableByIdAsync(alias.id));
    const v = vars.get(alias.id);
    return v ? { kind: 'variable', key: v.key, name: v.name, remote: v.remote } : { kind: 'variable', id: alias.id, name: null };
  }
  if (typeof styleId === 'string' && styleId) {
    if (!styles.has(styleId)) styles.set(styleId, await figma.getStyleByIdAsync(styleId));
    const s = styles.get(styleId);
    return s ? { kind: 'style', key: s.key, name: s.name, remote: s.remote } : { kind: 'style', id: styleId, name: null };
  }
  return { kind: 'raw' };
};
const sourceId = (src) => !src ? '-' : src.kind === 'raw' ? `node:${src.node}` : `${src.kind}:${src.key || src.id}`;
const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const over = (upper, lower) => ({ r: upper.r * upper.a + lower.r * (1 - upper.a), g: upper.g * upper.a + lower.g * (1 - upper.a), b: upper.b * upper.a + lower.b * (1 - upper.a), a: 1 });
const luminance = (c) => {
  const channel = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
};
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return Math.floor(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
const kindOf = (p) => (p.type === 'IMAGE' || p.type === 'VIDEO' ? 'an image' : p.type.startsWith('GRADIENT') ? 'a gradient' : p.type);

// The background: layers painted below the text, top down, until one is opaque.
const backgroundOf = async (text, box) => {
  const layers = [];
  const flags = new Set();
  for (let k = painted.length - 1; k >= 0; k--) {
    const below = painted[k];
    if (below.order >= text.order || isEmpty(intersect(below.box, box))) continue;
    if (!covers(below.box, box)) return { reason: `background varies: "${below.n.name}" covers only part of the text` };
    if (below.translucent) flags.add('opacity');
    if (below.blended) flags.add('blend-mode');
    const fills = shown(below.n.fills);
    for (let j = fills.length - 1; j >= 0; j--) {
      const paint = fills[j];
      if (paint.type !== 'SOLID') return { reason: `text over ${kindOf(paint)} in "${below.n.name}"` };
      if (alpha(paint) < 1) flags.add('opacity');
      if (paintBlended(paint)) flags.add('blend-mode');
      layers.push({ node: below.n, paint });
      if (alpha(paint) >= 1) {
        let c = { ...paint.color, a: 1 };
        for (let l = layers.length - 2; l >= 0; l--) c = over({ ...layers[l].paint.color, a: alpha(layers[l].paint) }, c);
        const topmost = layers[0];
        return { color: c, hex: hex(c), node: topmost.node.id, source: await sourceOf(topmost.paint, topmost.node.fillStyleId), flags };
      }
    }
  }
  return { reason: 'no opaque background behind the text' };
};

const pairs = new Map(), seen = new Map();
let textLayers = 0;
for (const t of texts) {
  const n = t.n;
  if (!n.characters.trim()) continue;
  const box = intersect(n.absoluteRenderBounds || n.absoluteBoundingBox, t.clip);
  if (isEmpty(box)) continue;
  textLayers++;
  const mixed = [n.fills, n.fillStyleId, n.fontSize, n.fontWeight].some(v => v === figma.mixed);
  const runs = mixed ? n.getStyledTextSegments(['fills', 'fillStyleId', 'fontSize', 'fontWeight']) : [{ fills: n.fills, fillStyleId: n.fillStyleId, fontSize: n.fontSize, fontWeight: n.fontWeight }];
  const bg = await backgroundOf(t, box);
  for (const run of runs) {
    const fills = shown(run.fills);
    if (!fills.length) continue;
    const flags = new Set(bg.flags || []);
    if (t.translucent) flags.add('opacity');
    if (t.blended) flags.add('blend-mode');
    let reason = bg.reason || null, fg = null, source = null;
    const nonSolid = fills.find(p => p.type !== 'SOLID');
    if (nonSolid) reason = `text fill is ${kindOf(nonSolid)}`;
    else {
      const topPaint = fills[fills.length - 1];
      source = await sourceOf(topPaint, run.fillStyleId);
      if (source.kind === 'raw') source.node = n.id;
      if (fills.length > 1 || fills.some(p => alpha(p) < 1)) flags.add('opacity');
      if (fills.some(paintBlended)) flags.add('blend-mode');
      if (bg.color) {
        fg = bg.color;
        for (const p of fills) fg = over({ ...p.color, a: alpha(p) }, fg);
      } else fg = { ...topPaint.color, a: 1 };
    }
    const text = { hex: fg ? hex(fg) : null, source };
    const background = bg.color ? { hex: bg.hex, source: bg.source, node: bg.node } : null;
    const flagList = [...flags].sort();
    const key = [sourceId(source), text.hex, background ? (background.source.kind === 'raw' ? background.hex : sourceId(background.source)) : '-', run.fontSize, run.fontWeight, flagList.join(','), reason].join('|');
    if (!pairs.has(key)) {
      pairs.set(key, { text, background, fontSize: run.fontSize, fontWeight: run.fontWeight, ratio: fg && bg.color ? ratio(fg, bg.color) : null, flags: flagList, reason, count: 0, nodes: [] });
      seen.set(key, new Set());
    }
    const group = pairs.get(key), ids = seen.get(key);
    if (!ids.has(n.id)) {
      ids.add(n.id);
      group.count++;
      if (group.nodes.length < SAMPLES) group.nodes.push({ id: n.id, path: t.path });
    }
  }
}

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.colourPairs = { textLayers, groups: [...pairs.values()] };
const size = () => JSON.stringify(out).length;
if (size() > LIMIT) for (const group of out.colourPairs.groups) for (const x of group.nodes) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const group of out.colourPairs.groups) group.nodes = group.nodes.slice(0, 3);
if (size() > LIMIT) {
  out.colourPairs = null;
  out.groups = [];
  out.unread.push({ what: 'colourPairs', reason: `output limit: ${textLayers} text layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) });
}
return out;
```

## Reading a Review Profile page

A calling skill may ask instead for a file's Review Profile page: the page named "Review Profile", which holds a team's Review Profile or a pointer to one. This is text, not Design Facts. Hand it back as the page holds it, and interpret none of it.

1. **Pick the tool** as in step 1 of Steps, with the file key the caller gives. It may be another file's key: both tools read another file by its key.
2. **Run the script below** exactly as written, in one call. If the call errors, run it once more unchanged. If it errors again, hand back `{ "fileKey": "<key>", "error": "<the error message>" }`.
3. **Hand back** the script's output as it returned it:
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

## Writing a report frame

The Report Writer may ask you to save a report on the reviewed file's report page, the page named "Design review", as a frame of its own. This is the only script that writes to a file. It lays out the text it's given and judges nothing.

1. **Pick the tool** as in step 1 of Steps, with the reviewed file's key.
2. **Set the script's first three lines** from the Report Writer's hand-over, and run everything else exactly as written, in one call:
   - `NAME`: the frame's name, as a string
   - `MARKDOWN`: the Markdown report without its JSON block, as an array of strings, one per line
   - `REPORT`: the report JSON, as an object
3. **If the call is refused because the script is too long,** run it again with `const REPORT = null;`. If that's refused too, also cut `MARKDOWN` to the report's title and header lines, and add the line "The whole report was too long to save here. It's in the chat the review ran in."
4. **If the call errors or returns an `error`,** run it once more unchanged. The script removes whatever it added before it returns an error. If it fails again, hand back the error.
5. **Hand back** the script's output: `page` (`id`, `name`, and `created` when this call added it), `frame` (`id`, `name`), and `json`, which is `saved`, or `too large` when the JSON isn't in the frame.

The frame goes above everything else on the page, so the newest is first, and older frames are left as they are. Its text is the Markdown, one text layer per heading and paragraph, and its last line says where the JSON is. The JSON goes in the frame's shared plugin data, namespace `designreview`, key `report`, when that entry fits Figma's limit of 100 kB.

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

const utf8 = (s) => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };

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
let frame = null, saved = false;
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
  const json = REPORT === null ? null : JSON.stringify(REPORT);
  if (json !== null && utf8(NAMESPACE + KEY + json) <= LIMIT) {
    try { frame.setSharedPluginData(NAMESPACE, KEY, json); saved = true; } catch (e) { saved = false; }
  }
  blocks.push({ level: 0, lines: [saved ? `Report JSON: in this frame's shared plugin data, namespace "${NAMESPACE}", key "${KEY}".` : 'Report JSON: too large for this frame, so it stayed in the chat the review ran in.'] });

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
return { page: { id: page.id, name: page.name, created }, frame: { id: frame.id, name: frame.name }, json: saved ? 'saved' : 'too large' };
```
