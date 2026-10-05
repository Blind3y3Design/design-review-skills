---
name: design-review-scanner
description: Reads Figma frames and returns four groups of Design Facts, colour pairs (text contrast ratios), text, structure and annotations, for the other design review skills, which invoke it. Bindings and components come from design-review-scanner-assets. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

This skill returns four fact groups: `colourPairs`, `text`, `structure` and `annotations`. Its sibling `design-review-scanner-assets` returns the other two, `bindings` and `components`. Callers ask each skill only for its own groups.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from one script per fact group, where you change only the input lines at the top. The scanner only reads: finding the Review Profile is the job of `design-review-profile`, and writing to the file is the job of `design-review-figma-writer`.

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This skill reads four groups: `colourPairs`, with The colour pairs script, `text`, with The text script, `structure`, with The structure script, and `annotations`, with The annotations script.
- **Annotation kits,** optionally: the kits whose instances count as annotations, each named by what its components' names start with, such as `A11y annotations/`.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id.** For each fact group asked for that has a script, copy the script and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. In The annotations script, also put the annotation kits on its second line as quoted strings, such as `const KITS = ['A11y annotations/'];`, or leave the list empty. Run everything else exactly as written. Run one call per id and group, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id, the group and the error message in that result's `unread`.
3. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of running the same script on each of those ids.
4. **Record groups you can't read.** For each fact group the caller asked for that has no script here, add `{ "what": "<group>", "reason": "<why>" }` to every result's `unread`: for `bindings` and `components`, "read by `design-review-scanner-assets`, not by this skill", and for any other group, "not read by this skill".

The scan is done when every id in the scope has a result for every fact group asked for, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, with `"runtime"` added. When several scripts ran on a node, merge their outputs into one result: `factsVersion`, `fileKey` and `scope` from any of them, their `groups` and their `unread` joined, and each group's field from its script. Pass the values on as the scripts returned them.

## Design Facts format

`factsVersion` 0.5. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame, which is a frame on the page or directly in a Figma section. A frame in a section is its own top-level frame, and the section is not one. Null for an id with no node.
- `groups`: the fact groups read. It is empty when the node couldn't be read at all.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead. A node that isn't there, or is hidden or at zero opacity, or sits under a layer that is, gives no facts: `groups` is empty and `unread` holds one entry whose `what` is its id.
- `colourPairs`, `text`, `structure` and `annotations`: each group's facts, or null when it wasn't read. The `bindings` and `components` fields are the other scanner's: the caller joins the two results.

Positions and sizes are in Figma px. `x` and `y` are measured from the top-level frame's top-left corner, and every `path` starts at the top-level frame.

### Colour pairs

Each visible, non-empty text layer in the scope, and each other layer with a fill or a stroke, measured against the layers painted beneath it. Hidden layers and layers at zero opacity are skipped. A text layer with several colours, sizes or weights gives one pair per run of text.

- `textLayers`: how many text layers were measured.
- `groups[]`: pairs grouped by Root Cause. Pairs share a group when they have the same text colour source, background, font size, weight and flags. A raw text colour's source is its own layer, so each raw-coloured text layer is its own group, while text bound to one variable or style on one background shares a group. Each group has:
  - `text`: `{ hex, source }`. `source.kind` is `variable` or `style`, with its `key`, `name` and `remote`, when the text colour is bound to one. Otherwise it's `raw`, with the text layer's id as `node`.
  - `background`: `{ hex, source, node }`: the colour behind the text, its source, and the layer it comes from. Null when it couldn't be computed. A Figma section holding the top-level frame is painted beneath it, so its fill is the background when nothing nearer is opaque.
  - `fontSize` in px, and `fontWeight`.
  - `ratio`: the contrast ratio, rounded down to 2 decimal places. Null when it couldn't be computed.
  - `flags[]`: `opacity` when translucency is involved (on the text, its background or a parent layer), and `blend-mode` when a blend mode is. With a flag, the colours and ratio are an estimate.
  - `reason`: why the pair couldn't be computed, such as text over an image or a gradient, a background that covers only part of the text, or no opaque background. Null otherwise.
  - `count`: the text layers in the group. `nodes[]`: up to 10 of them, each `{ id, path }`, where `path` is the layer path from the top-level frame.
- `nonTextLayers`: how many other layers were measured, each by its rendered bounds, so a line counts by its stroke. The top-level frame isn't one, since nothing in the design is painted beneath it.
- `nonText[]`: their pairs, grouped by Root Cause as the text pairs are, one pair for a layer's solid fills and one for its solid strokes. Each group has:
  - `part`: `fill` or `stroke`.
  - `colour`: `{ hex, source }`, as `text` above. A raw colour's source is its own layer.
  - `against`: `{ hex, source, node }`: the colour behind the layer. Null when it couldn't be computed.
  - `inside`: for a stroke on a layer with a solid fill, `{ hex, ratio }`: the layer's own fill, and the stroke's ratio against it as the stroke shows there.
  - `ratio`, `flags[]`, `reason`, `count` and `nodes[]`, as for text pairs.
- Gradient fills and strokes on these layers aren't measured, and `unread` counts them. Image fills aren't colour pairs.

### Text

Each visible, non-empty text layer in the scope, in layer order.

- `textLayers`: how many there are.
- `layers[]`: each `{ id, path, x, y, width, height, content, runs[] }`, where `content` is the layer's text.
  - `runs[]`: one per run of text with its own style, each `{ fontSize, fontWeight, font, textStyle, colour }`, plus `text` when the layer has more than one run, `decoration` (`UNDERLINE` or `STRIKETHROUGH`) when it has one, and `link` (a URL, or `node:<id>` for a link to a layer) when it's a link.
  - `font` is the family and style, such as `Inter Semi Bold`. `textStyle` is `{ key, name, remote }` when a text style is applied, otherwise null. `colour` is the top visible paint's `#RRGGBB`, or null when it isn't solid. Contrast is in the colour pairs.
  - `truncated`: true when `content` was cut to fit the output limit, which `unread` then says.

### Structure

The top-level frame and every other visible layer in the scope, other than text.

- `frame`: `{ id, name, width, height }` of the top-level frame: the frame itself for a frame in a Figma section.
- `sections[]`: the Figma sections holding the scanned node, innermost first, each `{ id, name }`.
- `layers[]`: each `{ id, path, type, x, y, width, height }`, in layer order, plus:
  - `reactions`: the prototype triggers set on the layer, such as `ON_CLICK`.
  - `image`: true when it shows an image or video fill.
  - `variant`: a variant component's or instance's variant values, such as `{ "State": "Focused" }`.
  - `look`: the layer's visible `fills`, `strokes` (colour, weight and alignment, such as `#C7C7C7 2 OUTSIDE`) and `effects`, for comparing two states of one component. Components and instances give it, and other layers when they have a stroke or an effect. Over the output limit, it's the first thing left out.

  Inside an instance, only nested instances and layers with reactions or images are listed. An instance's main component is in the components facts. Paths are shortened, then left out, when the output limit needs it.

### Annotations

What might annotate the scanned node, read as it is, without deciding what any of it means.

- `native[]`: Figma's own annotations on the scanned node, the layers inside it and the frames holding it. Each has `node` (`{ id, path, type }`), `category` (its label, or null), `text` and, when it pins properties, `properties`.
- `kits[]`: instances of the annotation kits the caller named, in the scope (nested in other instances too) or on the canvas beside it. Each has `kit`, `component`, `node`, `text` (the text inside it) and `where`. With no kits named, none are looked for.
- `notes[]`: free-text notes on the canvas: text layers outside every frame, nearest to this node's frame and within 200 px of it. Each has `node`, `text` and `gap` in px.
- `excluded`: how many annotations in the review's own categories were left out. The review's categories are named `Design review: <axis>`, such as `Design review: Accessibility`.

A `text` is cut to 500 characters, or to 150 over the output limit, and its entry then has `truncated: true` and `unread` says so.

Comments aren't read. When the runtime can't read annotations, `unread` says why, and `annotations` is null.

## The colour pairs script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const SAMPLES = 10;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['colourPairs'], unread: [], colourPairs: null };
const childIds = (n) => ('children' in n ? n.children.map(c => c.id) : []);

const node = await figma.getNodeByIdAsync(NODE_ID);
if (!node) { out.groups = []; out.unread.push({ what: NODE_ID, reason: 'no node with this id' }); return out; }
let page = node;
while (page.parent && page.type !== 'PAGE') page = page.parent;
if (page.type === 'PAGE') await page.loadAsync();
if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
  out.groups = [];
  out.unread.push({ what: NODE_ID, reason: 'a page, not a layer: scan each id in scanInstead', scanInstead: childIds(node) });
  return out;
}
// The top-level frame: the frame on the page or directly in a Figma section that holds the node.
let topFrame = node;
while (topFrame.parent && topFrame.parent.type !== 'PAGE' && topFrame.parent.type !== 'SECTION') topFrame = topFrame.parent;
out.scope = { id: node.id, name: node.name, type: node.type, page: page.name, topLevelFrame: topFrame.id === node.id ? null : { id: topFrame.id, name: topFrame.name } };
// A hidden layer, or one under a hidden layer, has nothing to read: say so.
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) {
  if (a.visible === false || ('opacity' in a && a.opacity === 0)) {
    out.groups = [];
    out.unread.push({ what: NODE_ID, reason: a === node ? 'this layer is hidden or at zero opacity' : `it sits inside "${a.name}", which is hidden or at zero opacity` });
    return out;
  }
}

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
const strokesOf = (n) => ('strokes' in n && (n.strokeWeight === figma.mixed || n.strokeWeight > 0) ? shown(n.strokes) : []);

// Paint order: a pre-order walk of the top-level frame, children back to front.
// Everything earlier in the walk is painted below everything later.
// `candidates` are the non-text layers in the scope with a fill or a stroke, measured by their rendered bounds.
const texts = [], painted = [], candidates = [];
let order = 0;
// The Figma sections holding the top-level frame are painted beneath it: their fills count as background, but they aren't scanned.
const held = [];
for (let a = topFrame.parent; a && a.type !== 'PAGE'; a = a.parent) held.unshift(a);
for (const s of held) if (s.visible !== false && s.absoluteBoundingBox && shown(s.fills).length) painted.push({ n: s, order: order++, translucent: false, blended: false, clip: null, path: s.name, box: s.absoluteBoundingBox });
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
  } else if (!n.isMask && box) {
    const filled = 'fills' in n && shown(n.fills).length > 0;
    if (filled) painted.push({ ...layer, box: intersect(box, clip) });
    if (scoped && n !== topFrame && (filled || strokesOf(n).length)) candidates.push({ ...layer, box: intersect(n.absoluteRenderBounds || box, clip) });
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

// The background: layers painted below the text or layer, top down, until one is opaque.
const backgroundOf = async (above, box, what = 'text') => {
  const layers = [];
  const flags = new Set();
  for (let k = painted.length - 1; k >= 0; k--) {
    const below = painted[k];
    if (below.order >= above.order || isEmpty(intersect(below.box, box))) continue;
    if (!covers(below.box, box)) return { reason: `background varies: "${below.n.name}" covers only part of the ${what}` };
    if (below.translucent) flags.add('opacity');
    if (below.blended) flags.add('blend-mode');
    const fills = shown(below.n.fills);
    for (let j = fills.length - 1; j >= 0; j--) {
      const paint = fills[j];
      if (paint.type !== 'SOLID') return { reason: `${what} over ${kindOf(paint)} in "${below.n.name}"` };
      if (alpha(paint) < 1) flags.add('opacity');
      if (paintBlended(paint)) flags.add('blend-mode');
      layers.push({ node: below.n, paint });
      if (alpha(paint) >= 1) {
        let c = { ...paint.color, a: 1 };
        for (let l = layers.length - 2; l >= 0; l--) c = over({ ...layers[l].paint.color, a: alpha(layers[l].paint) }, c);
        const topmost = layers[0];
        return { color: c, fact: { hex: hex(c), source: await sourceOf(topmost.paint, topmost.node.fillStyleId), node: topmost.node.id }, flags };
      }
    }
  }
  return { reason: `no opaque background behind the ${what}` };
};

// Pairs are grouped by Root Cause. A group counts each layer once, and lists up to SAMPLES of them.
const grouped = () => {
  const groups = new Map(), seen = new Map();
  return {
    add(key, make, n, path) {
      if (!groups.has(key)) { groups.set(key, { ...make(), count: 0, nodes: [] }); seen.set(key, new Set()); }
      const group = groups.get(key), ids = seen.get(key);
      if (ids.has(n.id)) return;
      ids.add(n.id);
      group.count++;
      if (group.nodes.length < SAMPLES) group.nodes.push({ id: n.id, path });
    },
    list: () => [...groups.values()],
  };
};
// What a stack of solid paints shows over a colour, or the top paint's own colour with nothing beneath.
const composite = (paints, beneath) => {
  if (!beneath) return { ...paints[paints.length - 1].color, a: 1 };
  let c = beneath;
  for (const p of paints) c = over({ ...p.color, a: alpha(p) }, c);
  return c;
};
// Translucency or a blend mode on the layer, its background or its own paints makes the measurement an estimate.
const flagsOf = (bg, layer, paints) => {
  const flags = new Set(bg.flags || []);
  if (layer.translucent || paints.length > 1 || paints.some(p => alpha(p) < 1)) flags.add('opacity');
  if (layer.blended || paints.some(paintBlended)) flags.add('blend-mode');
  return [...flags].sort();
};
const backgroundKey = (fact) => (!fact ? '-' : fact.source.kind === 'raw' ? fact.hex : sourceId(fact.source));
const solid = (paints) => paints.length > 0 && paints.every(p => p.type === 'SOLID');

const textPairs = grouped();
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
  const background = bg.fact || null;
  for (const run of runs) {
    const fills = shown(run.fills);
    if (!fills.length) continue;
    let reason = bg.reason || null, fg = null, source = null;
    const nonSolid = fills.find(p => p.type !== 'SOLID');
    if (nonSolid) reason = `text fill is ${kindOf(nonSolid)}`;
    else {
      source = await sourceOf(fills[fills.length - 1], run.fillStyleId);
      if (source.kind === 'raw') source.node = n.id;
      fg = composite(fills, bg.color);
    }
    const flags = flagsOf(bg, t, nonSolid ? [] : fills);
    const text = { hex: fg ? hex(fg) : null, source };
    const key = [sourceId(source), text.hex, backgroundKey(background), run.fontSize, run.fontWeight, flags.join(','), reason].join('|');
    textPairs.add(key, () => ({ text, background, fontSize: run.fontSize, fontWeight: run.fontWeight, ratio: fg && bg.color ? ratio(fg, bg.color) : null, flags, reason }), n, t.path);
  }
}

// Non-text layers: each solid fill and stroke against the colour behind the layer. A stroke is also measured inside the layer, over its own fill.
const nonTextPairs = grouped();
let nonTextLayers = 0, gradients = 0;
for (const c of candidates) {
  const n = c.n;
  if (isEmpty(c.box)) continue;
  const fills = shown(n.fills), strokes = strokesOf(n);
  gradients += [...fills, ...strokes].filter(p => p.type.startsWith('GRADIENT')).length;
  const parts = [{ part: 'fill', paints: fills, styleId: n.fillStyleId }, { part: 'stroke', paints: strokes, styleId: n.strokeStyleId }].filter(p => solid(p.paints));
  if (!parts.length) continue;
  nonTextLayers++;
  const bg = await backgroundOf(c, c.box, 'layer');
  const against = bg.fact || null;
  const ownFill = solid(fills) ? composite(fills, bg.color) : null;
  for (const { part, paints, styleId } of parts) {
    const source = await sourceOf(paints[paints.length - 1], styleId);
    if (source.kind === 'raw') source.node = n.id;
    const shows = composite(paints, bg.color);
    const flags = flagsOf(bg, c, paints);
    const pair = { part, colour: { hex: hex(shows), source }, against, ratio: bg.color ? ratio(shows, bg.color) : null, flags, reason: bg.reason || null };
    if (part === 'stroke' && ownFill) pair.inside = { hex: hex(ownFill), ratio: ratio(composite(paints, ownFill), ownFill) };
    const key = [part, sourceId(source), pair.colour.hex, backgroundKey(against), pair.inside ? pair.inside.hex : '-', flags.join(','), pair.reason].join('|');
    nonTextPairs.add(key, () => pair, n, c.path);
  }
}
if (gradients) out.unread.push({ what: 'gradient paints', reason: `${gradients} gradient paints on non-text layers weren't measured` });

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.colourPairs = { textLayers, groups: textPairs.list(), nonTextLayers, nonText: nonTextPairs.list() };
const size = () => JSON.stringify(out).length;
const allGroups = () => [...out.colourPairs.groups, ...out.colourPairs.nonText];
if (size() > LIMIT) for (const group of allGroups()) for (const x of group.nodes) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const group of allGroups()) group.nodes = group.nodes.slice(0, 3);
if (size() > LIMIT) {
  out.colourPairs = null;
  out.groups = [];
  out.unread = [{ what: 'colourPairs', reason: `output limit: ${textLayers} text layers and ${nonTextLayers} other layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
}
return out;
```

## The text script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['text'], unread: [], text: null };
const childIds = (n) => ('children' in n ? n.children.map(c => c.id) : []);

const node = await figma.getNodeByIdAsync(NODE_ID);
if (!node) { out.groups = []; out.unread.push({ what: NODE_ID, reason: 'no node with this id' }); return out; }
let page = node;
while (page.parent && page.type !== 'PAGE') page = page.parent;
if (page.type === 'PAGE') await page.loadAsync();
if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
  out.groups = [];
  out.unread.push({ what: NODE_ID, reason: 'a page, not a layer: scan each id in scanInstead', scanInstead: childIds(node) });
  return out;
}
// The top-level frame: the frame on the page or directly in a Figma section that holds the node.
let topFrame = node;
while (topFrame.parent && topFrame.parent.type !== 'PAGE' && topFrame.parent.type !== 'SECTION') topFrame = topFrame.parent;
out.scope = { id: node.id, name: node.name, type: node.type, page: page.name, topLevelFrame: topFrame.id === node.id ? null : { id: topFrame.id, name: topFrame.name } };
// A hidden layer, or one under a hidden layer, has nothing to read: say so.
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) {
  if (a.visible === false || ('opacity' in a && a.opacity === 0)) {
    out.groups = [];
    out.unread.push({ what: NODE_ID, reason: a === node ? 'this layer is hidden or at zero opacity' : `it sits inside "${a.name}", which is hidden or at zero opacity` });
    return out;
  }
}

const round = (v) => Math.round(v * 100) / 100;
const origin = topFrame.absoluteBoundingBox || { x: 0, y: 0 };
const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const shown = (paints) => (Array.isArray(paints) ? paints.filter(p => p.visible !== false && (p.opacity ?? 1) > 0) : []);
const styles = new Map();
const styleOf = async (id) => {
  if (typeof id !== 'string' || !id) return null;
  if (!styles.has(id)) {
    const s = await figma.getStyleByIdAsync(id);
    styles.set(id, s ? { key: s.key, name: s.name, remote: s.remote } : { id, name: null });
  }
  return styles.get(id);
};

// Text layers in the scope, in layer order. Hidden layers and layers at zero opacity are skipped.
const layers = [];
const walk = async (n, parentPath) => {
  if (n.visible === false || ('opacity' in n && n.opacity === 0)) return;
  const path = parentPath ? `${parentPath} / ${n.name}` : n.name;
  if (n.type === 'TEXT') {
    if (!n.characters.trim()) return;
    const b = n.absoluteBoundingBox || { x: origin.x, y: origin.y, width: 0, height: 0 };
    const segments = n.getStyledTextSegments(['fontSize', 'fontWeight', 'fontName', 'textStyleId', 'fills', 'textDecoration', 'hyperlink']);
    const runs = [];
    for (const s of segments) {
      const top = shown(s.fills).pop();
      const run = segments.length > 1 ? { text: s.characters } : {};
      Object.assign(run, { fontSize: round(s.fontSize), fontWeight: s.fontWeight, font: `${s.fontName.family} ${s.fontName.style}`, textStyle: await styleOf(s.textStyleId), colour: top && top.type === 'SOLID' ? hex(top.color) : null });
      if (s.textDecoration && s.textDecoration !== 'NONE') run.decoration = s.textDecoration;
      if (s.hyperlink) run.link = s.hyperlink.type === 'URL' ? s.hyperlink.value : `node:${s.hyperlink.value}`;
      runs.push(run);
    }
    layers.push({ id: n.id, path, x: round(b.x - origin.x), y: round(b.y - origin.y), width: round(b.width), height: round(b.height), content: n.characters, runs });
    return;
  }
  if ('children' in n) for (const c of n.children) await walk(c, path);
};
// Paths run from the top-level frame.
let parentPath = '';
for (let x = node !== topFrame ? node.parent : null; x; x = x === topFrame ? null : x.parent) parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
await walk(node, parentPath);

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.text = { textLayers: layers.length, layers };
const size = () => JSON.stringify(out).length;
const CUT = 200;
const cut = (s) => (s.length > CUT ? `${s.slice(0, CUT)}…` : s);
if (size() > LIMIT) for (const l of layers) l.path = l.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT && layers.some(l => l.content.length > CUT)) {
  for (const l of layers) {
    if (l.content.length <= CUT) continue;
    l.content = cut(l.content);
    l.truncated = true;
    for (const r of l.runs) if (r.text) r.text = cut(r.text);
  }
  out.unread.push({ what: 'text content', reason: `output limit: text longer than ${CUT} characters was cut` });
}
if (size() > LIMIT) {
  out.text = null;
  out.groups = [];
  out.unread = [{ what: 'text', reason: `output limit: ${layers.length} text layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
}
return out;
```

## The structure script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['structure'], unread: [], structure: null };
const childIds = (n) => ('children' in n ? n.children.map(c => c.id) : []);

const node = await figma.getNodeByIdAsync(NODE_ID);
if (!node) { out.groups = []; out.unread.push({ what: NODE_ID, reason: 'no node with this id' }); return out; }
let page = node;
while (page.parent && page.type !== 'PAGE') page = page.parent;
if (page.type === 'PAGE') await page.loadAsync();
if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
  out.groups = [];
  out.unread.push({ what: NODE_ID, reason: 'a page, not a layer: scan each id in scanInstead', scanInstead: childIds(node) });
  return out;
}
// The top-level frame: the frame on the page or directly in a Figma section that holds the node.
let topFrame = node;
while (topFrame.parent && topFrame.parent.type !== 'PAGE' && topFrame.parent.type !== 'SECTION') topFrame = topFrame.parent;
out.scope = { id: node.id, name: node.name, type: node.type, page: page.name, topLevelFrame: topFrame.id === node.id ? null : { id: topFrame.id, name: topFrame.name } };
// A hidden layer, or one under a hidden layer, has nothing to read: say so.
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) {
  if (a.visible === false || ('opacity' in a && a.opacity === 0)) {
    out.groups = [];
    out.unread.push({ what: NODE_ID, reason: a === node ? 'this layer is hidden or at zero opacity' : `it sits inside "${a.name}", which is hidden or at zero opacity` });
    return out;
  }
}

const round = (v) => Math.round(v * 100) / 100;
const origin = topFrame.absoluteBoundingBox || { x: 0, y: 0 };

const showsImage = (n) => 'fills' in n && Array.isArray(n.fills) && n.fills.some(p => p.visible !== false && (p.opacity ?? 1) > 0 && (p.type === 'IMAGE' || p.type === 'VIDEO'));
const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const shown = (paints) => (Array.isArray(paints) ? paints.filter(p => p.visible !== false && (p.opacity ?? 1) > 0) : []);
const paintOf = (p) => (p.type === 'SOLID' ? hex(p.color) : p.type === 'IMAGE' || p.type === 'VIDEO' ? p.type.toLowerCase() : p.type.startsWith('GRADIENT') ? 'gradient' : p.type);
// A layer's look, for comparing two states of one component: its visible fills, strokes and effects.
// Components and instances give it whenever they have any, other layers only when they have a stroke or an effect.
const lookOf = (n) => {
  const weight = typeof n.strokeWeight === 'number' ? n.strokeWeight : 'mixed';
  const strokes = 'strokes' in n && weight !== 0 ? shown(n.strokes).map(p => `${paintOf(p)} ${weight} ${n.strokeAlign}`) : [];
  const effects = Array.isArray(n.effects) ? n.effects.filter(e => e.visible !== false).map(e => [e.type, e.color ? hex(e.color) : null, e.spread ? `spread ${e.spread}` : null].filter(Boolean).join(' ')) : [];
  if (n.type !== 'COMPONENT' && n.type !== 'INSTANCE' && !strokes.length && !effects.length) return null;
  const fills = 'fills' in n ? shown(n.fills).map(paintOf) : [];
  const look = {};
  if (fills.length) look.fills = fills;
  if (strokes.length) look.strokes = strokes;
  if (effects.length) look.effects = effects;
  return Object.keys(look).length ? look : null;
};
// A variant component's or instance's variant values, such as { State: 'Focused' }.
const variantOf = (n) => {
  if (n.type !== 'COMPONENT' && n.type !== 'INSTANCE') return null;
  try { return n.variantProperties || null; } catch (e) { return null; }
};

// Layers in the scope other than text and the top-level frame, in layer order. Hidden layers and layers at zero opacity are skipped.
// Inside an instance, only nested instances and layers with prototype triggers or images are listed.
const layers = [];
const walk = async (n, inInstance, parentPath) => {
  if (n.visible === false || ('opacity' in n && n.opacity === 0)) return;
  const path = parentPath ? `${parentPath} / ${n.name}` : n.name;
  if (n.type === 'TEXT') return;
  const triggers = [...new Set((n.reactions || []).map(r => r.trigger && r.trigger.type).filter(Boolean))];
  const image = showsImage(n);
  if (n !== topFrame && (!inInstance || n.type === 'INSTANCE' || triggers.length || image)) {
    const b = n.absoluteBoundingBox || { x: origin.x, y: origin.y, width: 0, height: 0 };
    const row = { id: n.id, path, type: n.type, x: round(b.x - origin.x), y: round(b.y - origin.y), width: round(b.width), height: round(b.height) };
    if (triggers.length) row.reactions = triggers;
    if (image) row.image = true;
    const variant = variantOf(n), look = lookOf(n);
    if (variant) row.variant = variant;
    if (look) row.look = look;
    layers.push(row);
  }
  if ('children' in n && n.type !== 'BOOLEAN_OPERATION') for (const c of n.children) await walk(c, inInstance || n.type === 'INSTANCE', path);
};
// Paths run from the top-level frame.
let parentPath = '', aboveInstance = false;
for (let x = node !== topFrame ? node.parent : null; x; x = x === topFrame ? null : x.parent) parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) if (x.type === 'INSTANCE') aboveInstance = true;
await walk(node, aboveInstance, parentPath);
// The Figma sections holding the scanned node, innermost first. A section's name can mark it for a criterion.
const sections = [];
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) if (x.type === 'SECTION') sections.push({ id: x.id, name: x.name });

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.structure = { frame: { id: topFrame.id, name: topFrame.name, width: round(topFrame.width), height: round(topFrame.height) }, sections, layers };
const size = () => JSON.stringify(out).length;
if (size() > LIMIT) for (const l of layers) delete l.look;
if (size() > LIMIT) for (const l of layers) l.path = l.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const l of layers) delete l.path;
if (size() > LIMIT) {
  out.structure = null;
  out.groups = [];
  out.unread = [{ what: 'structure', reason: `output limit: ${layers.length} layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
}
return out;
```

## The annotations script

```js
const NODE_ID = 'NODE_ID';
const KITS = [];

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const NEAR = 200;
const LONG = 500;
const SHORT = 150;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['annotations'], unread: [], annotations: null };
const childIds = (n) => ('children' in n ? n.children.map(c => c.id) : []);

const node = await figma.getNodeByIdAsync(NODE_ID);
if (!node) { out.groups = []; out.unread.push({ what: NODE_ID, reason: 'no node with this id' }); return out; }
let page = node;
while (page.parent && page.type !== 'PAGE') page = page.parent;
if (page.type === 'PAGE') await page.loadAsync();
if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
  out.groups = [];
  out.unread.push({ what: NODE_ID, reason: 'a page, not a layer: scan each id in scanInstead', scanInstead: childIds(node) });
  return out;
}
// The top-level frame: the frame on the page or directly in a Figma section that holds the node.
let topFrame = node;
while (topFrame.parent && topFrame.parent.type !== 'PAGE' && topFrame.parent.type !== 'SECTION') topFrame = topFrame.parent;
out.scope = { id: node.id, name: node.name, type: node.type, page: page.name, topLevelFrame: topFrame.id === node.id ? null : { id: topFrame.id, name: topFrame.name } };
// A hidden layer, or one under a hidden layer, has nothing to read: say so.
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) {
  if (a.visible === false || ('opacity' in a && a.opacity === 0)) {
    out.groups = [];
    out.unread.push({ what: NODE_ID, reason: a === node ? 'this layer is hidden or at zero opacity' : `it sits inside "${a.name}", which is hidden or at zero opacity` });
    return out;
  }
}

const hidden = (n) => n.visible === false || ('opacity' in n && n.opacity === 0);
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
// An entry's text, cut to n characters, with `truncated: true` when it was.
const clipped = (s, n) => (s.length > n ? { text: cut(s, n), truncated: true } : { text: s });
// Layer names from the top-level frame down to a layer, or from the page's child for a layer above the frame.
const pathOf = (n) => {
  const names = [];
  for (let a = n; a && a.type !== 'PAGE'; a = a === topFrame ? null : a.parent) names.unshift(a.name);
  return names.join(' / ');
};
// The visible text inside a layer, such as a kit instance's note.
const textIn = (n) => {
  const parts = [];
  const visit = (x) => {
    if (hidden(x)) return;
    if (x.type === 'TEXT') { if (x.characters.trim()) parts.push(x.characters.trim()); }
    else if ('children' in x) x.children.forEach(visit);
  };
  visit(n);
  return parts.join(' / ');
};

let categories;
try {
  categories = new Map((await figma.annotations.getAnnotationCategoriesAsync()).map(c => [c.id, c.label]));
} catch (e) {
  out.groups = [];
  out.unread.push({ what: 'annotations', reason: `annotations can't be read here: ${String((e && e.message) || e)}` });
  return out;
}
// The review's own categories are named "Design review: <axis>", and are left out.
const reviewCategory = (label) => /^design review: /i.test(label || '');

// An instance's component, and the kit it belongs to. Only looked up when the caller names kits, since lookups are slow.
const componentOf = async (n) => {
  const main = await n.getMainComponentAsync();
  const name = main ? main.name : null;
  const set = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : null;
  const kit = KITS.find(k => [name, set].some(s => s && s.toLowerCase().startsWith(String(k).toLowerCase()))) || null;
  return { kit, label: set ? `${set} (${name})` : name };
};

const native = [], kits = [], notes = [];
let excluded = 0;
const readAnnotations = (n, path) => {
  if (!Array.isArray(n.annotations)) return;
  for (const a of n.annotations) {
    const category = a.categoryId ? categories.get(a.categoryId) || null : null;
    if (reviewCategory(category)) { excluded++; continue; }
    const entry = { node: { id: n.id, path, type: n.type }, category, ...clipped(a.labelMarkdown || a.label || '', LONG) };
    if (a.properties && a.properties.length) entry.properties = a.properties.map(p => p.type);
    native.push(entry);
  }
};
const walk = async (n, path) => {
  if (hidden(n)) return;
  readAnnotations(n, path);
  if (n.type === 'INSTANCE' && n.id !== node.id && KITS.length) {
    const c = await componentOf(n);
    if (c.kit) { kits.push({ kit: c.kit, component: c.label, node: { id: n.id, path }, ...clipped(textIn(n), LONG), where: 'in scope' }); return; }
  }
  if ('children' in n) for (const c of n.children) await walk(c, `${path} / ${c.name}`);
};
try {
  // Annotations on the frames holding the scanned node apply to it too.
  const holders = [];
  for (let a = node.parent; a && a.type !== 'PAGE'; a = a.parent) holders.unshift(a);
  for (const a of holders) readAnnotations(a, pathOf(a));
  await walk(node, pathOf(node));
} catch (e) {
  out.groups = [];
  out.unread.push({ what: 'annotations', reason: `the read failed: ${String((e && e.message) || e)}` });
  return out;
}

// Free-text notes and kit instances on the canvas: outside every frame, nearest to this node's frame, and within NEAR px of it.
const canvasFrames = [], canvasItems = [];
const gather = (n) => {
  for (const c of n.children) {
    if (hidden(c)) continue;
    if (c.type === 'TEXT') canvasItems.push(c);
    else if (c.type === 'INSTANCE') { canvasItems.push(c); canvasFrames.push(c); }
    else if (c.type === 'SECTION' || c.type === 'GROUP') gather(c);
    else if (c.absoluteBoundingBox) canvasFrames.push(c);
  }
};
gather(page);
const onCanvas = new Set(canvasFrames.map(f => f.id));
let frameOnCanvas = node;
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) if (onCanvas.has(a.id)) frameOnCanvas = a;
const gap = (a, b) => {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.hypot(dx, dy);
};
const inside = (n) => { for (let a = n.parent; a; a = a.parent) if (a.id === node.id) return true; return false; };
for (const c of canvasItems) {
  const b = c.absoluteBoundingBox;
  if (!b || c.id === frameOnCanvas.id) continue;
  if (c.type === 'INSTANCE' && !KITS.length) continue;
  const component = c.type === 'INSTANCE' ? await componentOf(c) : null;
  if (component && !component.kit) continue;
  let nearest = null, best = Infinity;
  if (inside(c)) { nearest = frameOnCanvas; best = 0; }
  else for (const f of canvasFrames) {
    if (f.id === c.id) continue;
    const d = gap(b, f.absoluteBoundingBox);
    if (d < best) { best = d; nearest = f; }
  }
  if (!nearest || nearest.id !== frameOnCanvas.id || best > NEAR) continue;
  if (component) kits.push({ kit: component.kit, component: component.label, node: { id: c.id, path: c.name }, ...clipped(textIn(c), LONG), where: `on the canvas, ${Math.round(best)} px away` });
  else if (c.characters.trim()) notes.push({ node: { id: c.id }, ...clipped(c.characters.trim(), LONG), gap: Math.round(best) });
}

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.annotations = { native, kits, notes, excluded };
const size = () => JSON.stringify(out).length;
const located = () => [...native, ...kits].map(a => a.node);
const texts = () => [...native, ...kits, ...notes];
// `unread` says how far text was cut. Its entry is in the output before the limit is checked.
let cutNote = null;
const noteCut = (limit, why) => {
  if (!texts().some(a => a.truncated)) return;
  if (!cutNote) out.unread.push(cutNote = { what: 'annotation text', reason: '' });
  cutNote.reason = `${why}text longer than ${limit} characters was cut`;
};
noteCut(LONG, '');
if (size() > LIMIT) for (const x of located()) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) { for (const a of texts()) Object.assign(a, clipped(a.text, SHORT)); noteCut(SHORT, 'output limit: '); }
if (size() > LIMIT) {
  out.annotations = null;
  out.groups = [];
  out.unread = [{ what: 'annotations', reason: `output limit: ${native.length + kits.length + notes.length} annotations are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
}
return out;
```
