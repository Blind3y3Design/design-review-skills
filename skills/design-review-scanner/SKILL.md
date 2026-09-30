---
name: design-review-scanner
description: Reads Figma frames and returns their Design Facts, such as text contrast ratios, for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from two scripts, The colour pairs script and The structure and annotations script, where you change only the input lines at the top. A skill can also ask for a file's Review Profile page, which is read by a script of its own (see Reading a Review Profile page).

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This version reads three: `colourPairs`, `structure` and `annotations`.
- **Annotation kits,** optionally: the kits whose instances count as annotations, each named by what its components' names start with, such as `A11y annotations/`.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id** with each script the fact groups need: The colour pairs script for `colourPairs`, and The structure and annotations script for `structure` or `annotations`, which it reads together. Copy the script and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. In the structure and annotations script, also put the annotation kits on its second line as quoted strings, such as `const KITS = ['A11y annotations/'];`, or leave the list empty. Run everything else exactly as written, one call per script per id, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id, the script and the error message in that result's `unread`.
3. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of scanning each of those ids with the same script.
4. **Record groups you can't read.** For each fact group the caller asked for other than `colourPairs`, `structure` and `annotations`, add `{ "what": "<group>", "reason": "not read by this version of the scanner" }` to every result's `unread`.

The scan is done when every id in the scope has a result from each script it needed, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node. A node's result joins the outputs of the scripts run on it: `factsVersion`, `fileKey` and `scope` once, their `groups` and `unread` lists combined, and each group's field as its script returned it. Add `"runtime"`. Pass the values on as the scripts returned them.

## Design Facts format

`factsVersion` 0.2. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame.
- `groups`: the fact groups read.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead. A `what` such as `structure: target sizes` names a part of a group that wasn't read.
- `colourPairs`, `structure` and `annotations`: each group, or null when it wasn't read.

### Colour pairs

Each visible, non-empty text layer in the scope, measured against the layers painted beneath it, and each stroke and vector fill. Hidden layers and layers at zero opacity are skipped. A text layer with several colours, sizes or weights gives one pair per run of text.

- `textLayers`: how many text layers were measured.
- `groups[]`: text pairs grouped by Root Cause. Pairs share a group when they have the same text colour source, background, font size, weight and flags. A raw text colour's source is its own layer, so each raw-coloured text layer is its own group, while text bound to one variable or style on one background shares a group. Each group has:
  - `text`: `{ hex, source }`. `source.kind` is `variable` or `style`, with its `key`, `name` and `remote`, when the text colour is bound to one. Otherwise it's `raw`, with the text layer's id as `node`.
  - `background`: `{ hex, source, node }`: the colour behind the text, its source, and the layer it comes from. Null when it couldn't be computed.
  - `fontSize` in px, and `fontWeight`.
  - `ratio`: the contrast ratio, rounded down to 2 decimal places. Null when it couldn't be computed.
  - `flags[]`: `opacity` when translucency is involved (on the text, its background or a parent layer), and `blend-mode` when a blend mode is. With a flag, the colours and ratio are an estimate.
  - `reason`: why the pair couldn't be computed, such as text over an image or a gradient, a background that covers only part of the text, or no opaque background. Null otherwise.
  - `count`: the text layers in the group. `nodes[]`: up to 10 of them, each `{ id, path }`, where `path` is the layer path from the top-level frame.
- `elementLayers`: how many other layers were measured: those with a visible stroke, and vector layers with a fill.
- `nonText[]`: their pairs, grouped the same way. Each has `kind` (`stroke` or `fill`), `element` (`{ hex, source }`, the stroke or fill colour), `beneath` (`{ hex, source, node }`, the colour beneath the layer), `ratio` (element against beneath), `fill` (for a stroke on a layer with a solid fill: `{ hex, ratio }`, the layer's own fill and the stroke's ratio against it; otherwise null), `weight` (a stroke's weight, otherwise null), `flags`, `reason`, `count` and `nodes`, as for text.

### Structure

The layers inside the scanned node, and where it sits. Hidden layers are skipped. Layers inside an instance are summed up by the instance, except for images and annotations.

- `size`: the scanned node's `width` and `height`. `parent`: its parent's type, such as `PAGE` or `SECTION`. `layout`: its auto-layout direction, when it has one.
- `sections[]`: the Figma sections holding the scanned node, innermost first, each `{ id, name }`.
- `frames`: `{ count, nodes[] }`, the frames, groups, components and component sets inside it. Each node has `id`, `path`, `type`, `depth`, its box (`x` and `y` from the scanned node's top left, `width`, `height`), `variant` for a variant component (such as `{ "State": "Focused" }`), `layout`, and `look`: its visible `fills`, `strokes` (colour, weight and alignment) and `effects`. Over the output limit, `look` and then the deepest frames are left out.
- `instances[]`: instances grouped by main component: `component`, `set` (its component set), `variant`, `look`, `count`, and up to 10 `nodes` with their boxes.
- `media`: `{ count, nodes[] }`, layers filled with an image or a video, each with its `kind`.
- `vectors`: `{ count, nodes[] }`, vector shapes outside instances, such as loose icons.
- `reactions`: `{ count, nodes[] }`, layers with prototype interactions, each with its `triggers` and `actions`.
- `textLayers`: how many visible text layers it holds. Their content belongs to the `text` group.

This version doesn't read target sizes, what an image shows, or the libraries used, and says so in `unread`.

### Annotations

What might annotate the scanned node, read as it is, without deciding what any of it means.

- `native[]`: Figma's own annotations on the scanned node, the layers inside it and the frames holding it. Each has `node` (`{ id, path, type }`), `category` (its label, or null), `text` and, when it pins properties, `properties`.
- `kits[]`: instances of the annotation kits the caller named, inside the scope or on the canvas beside it. Each has `kit`, `component`, `node`, `text` (the text inside it) and `where`.
- `notes[]`: free-text notes on the canvas: text layers outside every frame, nearest to this frame and within 200 px of it. Each has `node`, `text` and `gap` in px.
- `excluded`: how many annotations in the review's own categories were left out. The review's categories are named `Design review: <axis>`, such as `Design review: Accessibility`.

Comments aren't read. When the runtime can't read annotations, `unread` lists `annotations` with the reason, and `annotations` is null.

## The colour pairs script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.2';
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
const VECTORS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'ELLIPSE', 'LINE']);
const stroked = (n) => 'strokes' in n && shown(n.strokes).length > 0 && (typeof n.strokeWeight !== 'number' || n.strokeWeight > 0);

// Paint order: a pre-order walk of the top-level frame, children back to front.
// Everything earlier in the walk is painted below everything later.
const texts = [], painted = [], elements = [];
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
  } else if (!n.isMask) {
    if ('fills' in n && shown(n.fills).length && box) painted.push({ ...layer, box: intersect(box, clip) });
    if (scoped && (stroked(n) || (VECTORS.has(n.type) && shown(n.fills).length))) elements.push(layer);
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

// The background: layers painted below the text (or another layer), top down, until one is opaque.
const backgroundOf = async (text, box, what = 'text') => {
  const layers = [];
  const flags = new Set();
  for (let k = painted.length - 1; k >= 0; k--) {
    const below = painted[k];
    if (below.order >= text.order || isEmpty(intersect(below.box, box))) continue;
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
        return { color: c, hex: hex(c), node: topmost.node.id, source: await sourceOf(topmost.paint, topmost.node.fillStyleId), flags };
      }
    }
  }
  return { reason: `no opaque background behind the ${what}` };
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

// Non-text pairs: each stroke, and each vector layer's fill, against the colour beneath the layer.
// A stroke is also measured against the layer's own fill, the colour on its inner edge.
const others = new Map(), othersSeen = new Map();
let elementLayers = 0;
for (const e of elements) {
  const n = e.n;
  const box = intersect(n.absoluteRenderBounds || n.absoluteBoundingBox, e.clip);
  if (isEmpty(box)) continue;
  elementLayers++;
  const ownFills = 'fills' in n ? shown(n.fills) : [];
  const parts = [];
  if (stroked(n)) parts.push({ kind: 'stroke', paints: shown(n.strokes), styleId: n.strokeStyleId });
  if (VECTORS.has(n.type) && ownFills.length) parts.push({ kind: 'fill', paints: ownFills, styleId: n.fillStyleId });
  for (const { kind, paints, styleId } of parts) {
    const bg = await backgroundOf(e, box, kind);
    const flags = new Set(bg.flags || []);
    if (e.translucent) flags.add('opacity');
    if (e.blended) flags.add('blend-mode');
    let reason = bg.reason || null, colour = null, source = null, fill = null;
    const nonSolid = paints.find(p => p.type !== 'SOLID');
    if (nonSolid) reason = `${kind} is ${kindOf(nonSolid)}`;
    else {
      const topPaint = paints[paints.length - 1];
      source = await sourceOf(topPaint, styleId);
      if (source.kind === 'raw') source.node = n.id;
      if (paints.length > 1 || paints.some(p => alpha(p) < 1)) flags.add('opacity');
      if (paints.some(paintBlended)) flags.add('blend-mode');
      const onto = (base) => { let c = base; for (const p of paints) c = over({ ...p.color, a: alpha(p) }, c); return c; };
      colour = bg.color ? onto(bg.color) : { ...topPaint.color, a: 1 };
      if (kind === 'stroke' && ownFills.length && ownFills.every(p => p.type === 'SOLID') && alpha(ownFills[0]) >= 1) {
        let inner = { ...ownFills[0].color, a: 1 };
        for (const p of ownFills.slice(1)) inner = over({ ...p.color, a: alpha(p) }, inner);
        fill = { hex: hex(inner), ratio: ratio(onto(inner), inner) };
      }
    }
    const element = { hex: colour ? hex(colour) : null, source };
    const beneath = bg.color ? { hex: bg.hex, source: bg.source, node: bg.node } : null;
    const weight = kind === 'stroke' ? (typeof n.strokeWeight === 'number' ? n.strokeWeight : 'mixed') : null;
    const flagList = [...flags].sort();
    const key = [kind, sourceId(source), element.hex, beneath ? (beneath.source.kind === 'raw' ? beneath.hex : sourceId(beneath.source)) : '-', fill ? fill.hex : '-', weight, flagList.join(','), reason].join('|');
    if (!others.has(key)) {
      others.set(key, { kind, element, beneath, ratio: colour && bg.color ? ratio(colour, bg.color) : null, fill, weight, flags: flagList, reason, count: 0, nodes: [] });
      othersSeen.set(key, new Set());
    }
    const group = others.get(key), ids = othersSeen.get(key);
    if (!ids.has(n.id)) {
      ids.add(n.id);
      group.count++;
      if (group.nodes.length < SAMPLES) group.nodes.push({ id: n.id, path: e.path });
    }
  }
}

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.colourPairs = { textLayers, groups: [...pairs.values()], elementLayers, nonText: [...others.values()] };
const size = () => JSON.stringify(out).length;
const all = () => [...out.colourPairs.groups, ...out.colourPairs.nonText];
if (size() > LIMIT) for (const group of all()) for (const x of group.nodes) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const group of all()) group.nodes = group.nodes.slice(0, 3);
if (size() > LIMIT) {
  out.colourPairs = null;
  out.groups = [];
  out.unread.push({ what: 'colourPairs', reason: `output limit: ${textLayers} text layers and ${elementLayers} other layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) });
}
return out;
```

## The structure and annotations script

It reads the `structure` and `annotations` groups in one walk. `KITS` holds the annotation kits the caller named.

```js
const NODE_ID = 'NODE_ID';
const KITS = [];

const FACTS_VERSION = '0.2';
const LIMIT = 18000;
const SAMPLES = 10;
const NEAR = 200;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['structure', 'annotations'], unread: [], structure: null, annotations: null };
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
let topFrame = node;
while (topFrame.parent && topFrame.parent.type !== 'PAGE') topFrame = topFrame.parent;
out.scope = { id: node.id, name: node.name, type: node.type, page: page.name, topLevelFrame: topFrame.id === node.id ? null : { id: topFrame.id, name: topFrame.name } };

const CONTAINERS = new Set(['FRAME', 'GROUP', 'SECTION', 'COMPONENT', 'COMPONENT_SET']);
const VECTORS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'ELLIPSE', 'LINE']);
const hidden = (n) => n.visible === false || ('opacity' in n && n.opacity === 0);
const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const shown = (paints) => (Array.isArray(paints) ? paints.filter(p => p.visible !== false && (p.opacity ?? 1) > 0) : []);
const paintOf = (p) => (p.type === 'SOLID' ? hex(p.color) : p.type === 'IMAGE' ? 'image' : p.type === 'VIDEO' ? 'video' : p.type.startsWith('GRADIENT') ? 'gradient' : p.type);
const lookOf = (n) => {
  const look = {};
  const fills = 'fills' in n ? shown(n.fills).map(paintOf) : [];
  const strokes = 'strokes' in n ? shown(n.strokes).map(p => `${paintOf(p)} ${typeof n.strokeWeight === 'number' ? n.strokeWeight : 'mixed'} ${n.strokeAlign}`) : [];
  const effects = 'effects' in n && Array.isArray(n.effects) ? n.effects.filter(e => e.visible !== false).map(e => [e.type, e.color ? hex(e.color) : null, e.spread ? `spread ${e.spread}` : null].filter(Boolean).join(' ')) : [];
  if (fills.length) look.fills = fills;
  if (strokes.length) look.strokes = strokes;
  if (effects.length) look.effects = effects;
  return Object.keys(look).length ? look : undefined;
};
const origin = node.absoluteBoundingBox || { x: 0, y: 0 };
const boxOf = (n) => {
  const b = n.absoluteBoundingBox;
  return b ? { x: Math.round(b.x - origin.x), y: Math.round(b.y - origin.y), width: Math.round(b.width), height: Math.round(b.height) } : {};
};
const pathOf = (n) => {
  const names = [];
  for (let a = n; a && a.type !== 'PAGE'; a = a.parent) names.unshift(a.name);
  return names.join(' / ');
};
const sections = [];
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) if (a.type === 'SECTION') sections.push({ id: a.id, name: a.name });

// Annotation categories. The review's own categories ("Design review: <axis>") are left out.
let categories = null;
try {
  categories = new Map((await figma.annotations.getAnnotationCategoriesAsync()).map(c => [c.id, c.label]));
} catch (e) {
  out.unread.push({ what: 'annotations', reason: `annotations can't be read here: ${String((e && e.message) || e)}` });
}
const ownCategory = (label) => /^design review/i.test(label || '');
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
const native = [];
let excluded = 0;
const readAnnotations = (n, path) => {
  if (!categories || !('annotations' in n) || !n.annotations.length) return;
  for (const a of n.annotations) {
    const category = a.categoryId ? categories.get(a.categoryId) || null : null;
    if (ownCategory(category)) { excluded++; continue; }
    const entry = { node: { id: n.id, path, type: n.type }, category, text: cut(a.labelMarkdown || a.label || '', 500) };
    if (a.properties && a.properties.length) entry.properties = a.properties.map(p => p.type);
    native.push(entry);
  }
};
const kitOf = (component, set) => KITS.find(k => [component, set].some(s => s && s.toLowerCase().startsWith(String(k).toLowerCase()))) || null;
const textIn = (n) => cut(n.findAllWithCriteria({ types: ['TEXT'] }).filter(t => !hidden(t)).map(t => t.characters.trim()).filter(Boolean).join(' / '), 500);

const frames = [], media = [], vectors = [], reactions = [], kits = [];
const instances = new Map(), mains = new Map();
let textLayers = 0;
const sample = (list, entry) => { if (list.length < SAMPLES) list.push(entry); };
const counts = { frames: 0, media: 0, vectors: 0, reactions: 0 };
const mainOf = async (n) => {
  if (!mains.has(n.id)) mains.set(n.id, await n.getMainComponentAsync());
  return mains.get(n.id);
};

const walk = async (n, path, depth, inInstance) => {
  if (hidden(n)) return;
  const top = n.id === node.id;
  readAnnotations(n, path);
  if (n.type === 'TEXT') textLayers++;
  if ('fills' in n) for (const p of shown(n.fills)) if (p.type === 'IMAGE' || p.type === 'VIDEO') {
    counts.media++;
    if (media.length < SAMPLES * 2) media.push({ id: n.id, path, kind: p.type.toLowerCase(), ...boxOf(n) });
    break;
  }
  if (!inInstance && 'reactions' in n && n.reactions && n.reactions.length) {
    counts.reactions++;
    const triggers = [...new Set(n.reactions.map(r => r.trigger && r.trigger.type).filter(Boolean))];
    const actions = [...new Set(n.reactions.flatMap(r => r.actions || (r.action ? [r.action] : [])).map(a => (a.type === 'NODE' ? `NODE ${a.navigation}` : a.type)))];
    if (reactions.length < SAMPLES * 2) reactions.push({ id: n.id, path, triggers, actions });
  }
  if (n.type === 'INSTANCE' && !inInstance && !top) {
    const main = await mainOf(n);
    const component = main ? main.name : null;
    const set = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : null;
    const kit = kitOf(component, set);
    if (kit) { kits.push({ kit, component: set ? `${set} (${component})` : component, node: { id: n.id, path }, text: textIn(n), where: 'in scope' }); return; }
    const key = main ? main.id : 'unknown';
    if (!instances.has(key)) instances.set(key, { component, set, variant: n.variantProperties || undefined, look: lookOf(n), count: 0, nodes: [] });
    const group = instances.get(key);
    group.count++;
    sample(group.nodes, { id: n.id, path, ...boxOf(n) });
  } else if (!inInstance && !top && CONTAINERS.has(n.type)) {
    counts.frames++;
    const entry = { id: n.id, path, type: n.type, depth, ...boxOf(n) };
    if (n.type === 'COMPONENT' && n.variantProperties) entry.variant = n.variantProperties;
    if ('layoutMode' in n && n.layoutMode && n.layoutMode !== 'NONE') entry.layout = n.layoutMode;
    const look = lookOf(n);
    if (look) entry.look = look;
    frames.push(entry);
  } else if (!inInstance && !top && VECTORS.has(n.type)) {
    counts.vectors++;
    sample(vectors, { id: n.id, path, type: n.type, ...boxOf(n) });
  }
  if ('children' in n && n.type !== 'BOOLEAN_OPERATION') {
    for (const c of n.children) await walk(c, `${path} / ${c.name}`, depth + 1, inInstance || n.type === 'INSTANCE');
  }
};
try {
  // Annotations on the frames holding the scanned node apply to it too.
  for (let a = node.parent; a && a.type !== 'PAGE'; a = a.parent) readAnnotations(a, pathOf(a));
  await walk(node, pathOf(node), 0, false);
} catch (e) {
  out.unread.push({ what: 'structure', reason: `the walk failed: ${String((e && e.message) || e)}` });
}

// Free-text notes and kit instances on the canvas next to the frame: outside every frame, nearest to this frame, and within NEAR px of it.
const notes = [];
const canvasFrames = [], loose = [];
const gather = (n) => {
  for (const c of n.children) {
    if (hidden(c)) continue;
    if (c.type === 'TEXT') loose.push(c);
    else if (c.type === 'INSTANCE') { loose.push(c); canvasFrames.push(c); }
    else if (c.type === 'SECTION' || c.type === 'GROUP') gather(c);
    else if (c.absoluteBoundingBox) canvasFrames.push(c);
  }
};
gather(page);
const onCanvas = new Set(canvasFrames.map(f => f.id));
let own = node;
for (let a = node; a && a.type !== 'PAGE'; a = a.parent) if (onCanvas.has(a.id)) own = a;
const gap = (a, b) => {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.hypot(dx, dy);
};
const inside = (n) => { for (let a = n.parent; a; a = a.parent) if (a.id === node.id) return true; return false; };
for (const c of loose) {
  const b = c.absoluteBoundingBox;
  if (!b || c.id === own.id) continue;
  let isKit = null, component = null;
  if (c.type === 'INSTANCE') {
    const main = await mainOf(c);
    const set = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : null;
    isKit = main ? kitOf(main.name, set) : null;
    component = main ? (set ? `${set} (${main.name})` : main.name) : null;
    if (!isKit) continue;
  }
  let nearest = null, best = Infinity;
  if (inside(c)) { nearest = own; best = 0; }
  else for (const f of canvasFrames) {
    if (f.id === c.id) continue;
    const d = gap(b, f.absoluteBoundingBox);
    if (d < best) { best = d; nearest = f; }
  }
  if (!nearest || nearest.id !== own.id || best > NEAR) continue;
  if (isKit) kits.push({ kit: isKit, component, node: { id: c.id, path: c.name }, text: textIn(c), where: `on the canvas, ${Math.round(best)} px away` });
  else if (c.characters.trim()) notes.push({ node: { id: c.id }, text: cut(c.characters.trim(), 500), gap: Math.round(best) });
}

out.structure = {
  size: { width: Math.round(node.width), height: Math.round(node.height) },
  parent: node.parent ? node.parent.type : null,
  layout: 'layoutMode' in node && node.layoutMode !== 'NONE' ? node.layoutMode : undefined,
  sections,
  frames: { count: counts.frames, nodes: frames },
  instances: [...instances.values()],
  media: { count: counts.media, nodes: media },
  vectors: { count: counts.vectors, nodes: vectors },
  reactions: { count: counts.reactions, nodes: reactions },
  textLayers,
};
out.unread.push(
  { what: 'structure: target sizes', reason: 'not read by this version of the scanner' },
  { what: 'structure: what images show', reason: 'not read by this version of the scanner' },
  { what: 'structure: libraries', reason: 'not read by this version of the scanner' },
);
if (categories) out.annotations = { native, kits, notes, excluded };
else out.groups = ['structure'];

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
const size = () => JSON.stringify(out).length;
const paths = () => [...frames, ...media, ...vectors, ...reactions, ...[...instances.values()].flatMap(g => g.nodes), ...native.map(a => a.node), ...kits.map(k => k.node)];
if (size() > LIMIT) for (const x of paths()) if (x.path) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const f of frames) delete f.look;
for (let d = 6; d >= 1 && size() > LIMIT; d--) out.structure.frames.nodes = frames.filter(f => f.depth <= d);
if (size() > LIMIT) for (const g of out.structure.instances) g.nodes = g.nodes.slice(0, 3);
if (size() > LIMIT) for (const a of [...native, ...kits, ...notes]) a.text = cut(a.text, 150);
if (size() > LIMIT) {
  out.structure = null;
  out.annotations = null;
  out.groups = [];
  out.unread.push({ what: 'structure and annotations', reason: 'output limit: too many layers for one call; scan each id in scanInstead', scanInstead: childIds(node) });
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
