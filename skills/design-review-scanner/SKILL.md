---
name: design-review-scanner
description: Reads Figma frames and returns their Design Facts, such as text contrast ratios, for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

All reading goes through one **fixed script**, tested as written, so every review reads a file the same way. You change only the node id on its first line.

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
