---
name: design-review-scanner-colour-pairs
description: Reads a Figma frame and returns one group of Design Facts, `colourPairs`, measured text contrast ratios and non-text colour pairs, grouped by root cause, for design-review-scanner, which invokes it and joins its result with the other groups. To read a design, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-alpha.4" # x-release-please-version
---

# Design Scanner: Colour pairs

Version 0.1.0-alpha.4 of the design review skills. <!-- x-release-please-version -->

Returns the `colourPairs` Design Facts group, measured text contrast ratios and non-text colour pairs, grouped by root cause: what was read or measured, never a judgement. This is one of six scanning skills, each of which reads one fact group. `design-review-scanner` invokes the ones for the groups a caller asks for and joins their results. This skill holds no thresholds and no criteria, and only reads.

Reading goes through a fixed script, tested as written, so every review reads a file the same way. You change only the input line at the top.

## Inputs

The calling skill gives you:

- **Node id:** the one node id to scan. Scripts can't see the user's selection, so the caller passes the id of the selected or named frame.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Run the script.** Copy The colour pairs script section below and replace `NODE_ID` on its first line with the node id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written, with `evaluate_script` inside Figma Design's agent and the Figma MCP server's `use_figma` in an external agent, with the file key from the file's link. If the call errors, run it once more unchanged. If it errors again, tell the calling skill that the `colourPairs` group couldn't be read for this node, with the error message.
2. **Hand it back.** Return the result as the script returned it, with `"runtime"` added, and nothing else changed. The calling skill joins this group with the others for the node.

The scan is done when you have handed back the result.

## This group's facts


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
const sectionsAbove = [];
for (let a = topFrame.parent; a && a.type !== 'PAGE'; a = a.parent) sectionsAbove.unshift(a);
for (const s of sectionsAbove) if (s.visible !== false && s.absoluteBoundingBox && shown(s.fills).length) painted.push({ n: s, order: order++, translucent: false, blended: false, clip: null, path: s.name, box: s.absoluteBoundingBox });
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
