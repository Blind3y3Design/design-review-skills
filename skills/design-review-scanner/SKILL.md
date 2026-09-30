---
name: design-review-scanner
description: Reads Figma frames and returns their Design Facts, such as text contrast ratios, for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from a script per fact group, or per pair of groups, where you change only the input lines at the top. A Review Skill also asks you to find the team's Review Profile, which has a procedure and a script of its own (see Finding the Review Profile), and the Report Writer asks you to save its report frames (see Writing a report frame).

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This version reads four: `colourPairs`, with The colour pairs script, `structure` and `annotations`, both with The structure and annotations script, and `bindings`, with The bindings script.
- **Annotation kits,** optionally: the kits whose instances count as annotations, each named by what its components' names start with, such as `A11y annotations/`.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id.** For each fact group asked for that has a script, copy the script and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. The structure and annotations script reads both its groups in one call, and its second line takes the annotation kits as quoted strings, such as `const KITS = ['A11y annotations/'];`, or stays empty. Run everything else exactly as written. Run one call per id and script, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id, the script and the error message in that result's `unread`.
3. **Follow `scanInstead`.** When a result's `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output), run the same script on each of those ids, and hand their results back as well.
4. **Record groups you can't read.** For each fact group the caller asked for that has no script here, add `{ "what": "<group>", "reason": "not read by this version of the scanner" }` to every result's `unread`.

The scan is done when every id in the scope has a result for every fact group asked for, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, with `"runtime"` added. When several scripts ran on a node, merge their outputs into one result: `factsVersion`, `fileKey` and `scope` from any of them, their `groups` and their `unread` joined, and each group's field from its script. Pass the values on as the scripts returned them.

## Design Facts format

`factsVersion` 0.2. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame.
- `groups`: the fact groups read.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead. A `what` such as `structure (target sizes)` names a part of a group that wasn't read.
- `colourPairs`, `structure`, `annotations` and `bindings`: each group's facts, or null when it wasn't read.

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
- `elementLayers`: how many other layers were measured: those with a visible stroke, and vector layers with a colour fill. A shape filled with an image is a picture, under `structure.media`.
- `nonText[]`: their pairs, grouped the same way. Each has `kind` (`stroke` or `fill`), `element` (`{ hex, source }`, the stroke or fill colour), `beneath` (`{ hex, source, node }`, the colour beneath the layer), `ratio` (element against beneath), `fill` (for a stroke on a layer with a solid fill: `{ hex, ratio }`, the layer's own fill and the stroke's ratio against it; otherwise null), `weight` and `align` (a stroke's weight and alignment, `INSIDE`, `CENTER` or `OUTSIDE`, otherwise null), `flags`, `reason`, `count` and `nodes`, as for text.

### Structure

The layers inside the scanned node, and where it sits. Hidden layers are skipped. Layers inside an instance are summed up by the instance, except for images, annotations and kit instances.

- `size`: the scanned node's `width` and `height`. `parent`: its parent's type, such as `PAGE` or `SECTION`. `layout`: its auto-layout direction, when it has one.
- `sections[]`: the Figma sections holding the scanned node, innermost first, each `{ id, name }`.
- `frames`: `{ count, nodes[] }`, the frames, groups, components and component sets inside it. Each node has `id`, `path`, `type`, `depth`, its box (`x` and `y` from the scanned node's top left, `width`, `height`), `variant` for a variant component (such as `{ "State": "Focused" }`), `layout`, and `look`: its visible `fills`, `strokes` (colour, weight and alignment) and `effects`. Over the output limit, `look` and then the deepest frames are left out.
- `instances[]`: instances grouped by main component: `component`, `set` (its component set), `variant`, `look`, `count`, and up to 10 `nodes` with their boxes.
- `media`: `{ count, nodes[] }`, layers filled with an image or a video, each with its `kind`.
- `vectors`: `{ count, nodes[] }`, vector shapes outside instances, such as loose icons.
- `reactions`: `{ count, nodes[] }`, layers with prototype interactions, each with its `triggers` and `actions`.
- `textLayers`: how many visible text layers it holds. Their content belongs to the `text` group.

This version doesn't read target sizes, what an image shows, or the libraries used, and says so in `unread`. When a node's layers are too many for one call's output, its result keeps only `size`, `parent`, `layout` and `sections`, and `unread` lists its children to scan instead.

### Annotations

What might annotate the scanned node, read as it is, without deciding what any of it means.

- `native[]`: Figma's own annotations on the scanned node, the layers inside it and the frames holding it. Each has `node` (`{ id, path, type }`), `category` (its label, or null), `text` and, when it pins properties, `properties`.
- `kits[]`: instances of the annotation kits the caller named, inside the scope or on the canvas beside it. Each has `kit`, `component`, `node`, `text` (the text inside it) and `where`.
- `notes[]`: free-text notes on the canvas: text layers outside every frame, nearest to this frame and within 200 px of it. Each has `node`, `text` and `gap` in px.
- `excluded`: how many annotations in the review's own categories were left out. The review's categories are named `Design review: <axis>`, such as `Design review: Accessibility`, and no others start that way.

Comments aren't read. When the runtime can't read annotations, `unread` lists `annotations` with the reason, and `annotations` is null.

### Bindings

How each visible layer in the scope uses variables and styles, and the raw values set where it uses neither. Hidden layers and layers at zero opacity are skipped. It reads fills, strokes, effects, corner radius, auto-layout padding and gaps, and text. Bindings on other properties, such as size or opacity, aren't read.

- `layers`: how many layers were read.
- `raw[]`: each layer with a raw value, as `{ node: { id, path }, instance, values[] }`:
  - `values[]`: each `{ property, field, value }`. `property` is `fill`, `stroke`, `effect`, `radius`, `spacing` or `text`. `field` names the Figma field for a radius or spacing: `cornerRadius` or `padding` when all four are the same, otherwise one such as `topLeftRadius`, `paddingLeft` or `itemSpacing`. `value` is written as Values below.
  - A radius or spacing of 0 is Figma's default for a layer with none set, so it isn't listed. An image fill can't be bound, so it isn't listed either. Gradient paints aren't read: `unread` counts them.
  - `instance`: `{ id, name }` of the outermost instance the layer sits in, when there is one. Inside an instance, `raw` lists only the values the instance overrides.
- `inherited[]`: the raw values that instances take unchanged from their components, grouped by the component of the nearest instance each layer sits in: `{ component: { key, name, remote }, count, values[], instances, nodes[] }`. `count` is how many raw values, `values` up to 10 distinct ones, `instances` how many instances hold them, and `nodes` up to 10 of the layers, each `{ id, path }`.
- `variables[]`: each variable bound in the scope, and each one reached from those through an alias, once: `{ key, name, type, collection: { key, name }, library, remote, value, alias, uses, properties }`.
  - `library` is the library's name, found by the collection's key through `figma.teamLibrary`. It's null for a local variable (`remote` is false), or for a library variable whose library can't be named, and `unread` then says so.
  - `value` is the resolved value in the mode of the first layer that uses the variable. `alias` is the key of the variable it points to, or null.
  - `uses` counts the bindings to it in the scope, 0 for one reached only through an alias. `properties` lists the properties bound to it.
- `styles[]`: each style used in the scope, once: `{ key, name, type, remote, value, uses, properties }`. A paint style with anything but one solid paint gives its paint count as `value`.

**Values.** A colour is `#RRGGBB`, or `#RRGGBBAA` below full opacity. A radius or spacing is a number in px. Text is `<family> <style> <size>/<line height>`, such as `Inter Regular 16/24`, with any letter spacing after it. An effect is `<type> <colour> <x> <y> <blur> <spread>` for a shadow, or `<type> <blur>` for a blur.

## The colour pairs script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.2';
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
// A vector layer's own colour fill, such as an icon's. An image-filled shape, such as a round avatar, is a picture instead.
const vectorFilled = (n) => VECTORS.has(n.type) && 'fills' in n && shown(n.fills).length > 0 && !shown(n.fills).some(p => p.type === 'IMAGE' || p.type === 'VIDEO');

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
    if (scoped && (stroked(n) || vectorFilled(n))) elements.push(layer);
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

// The background: layers painted below the layer, top down, until one is opaque.
const backgroundOf = async (layer, box, what = 'text') => {
  const layers = [];
  const flags = new Set();
  for (let k = painted.length - 1; k >= 0; k--) {
    const below = painted[k];
    if (below.order >= layer.order || isEmpty(intersect(below.box, box))) continue;
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
const nonTextPairs = new Map(), nonTextSeen = new Map();
let elementLayers = 0;
for (const e of elements) {
  const n = e.n;
  const box = intersect(n.absoluteRenderBounds || n.absoluteBoundingBox, e.clip);
  if (isEmpty(box)) continue;
  elementLayers++;
  const ownFills = 'fills' in n ? shown(n.fills) : [];
  const parts = [];
  if (stroked(n)) parts.push({ kind: 'stroke', paints: shown(n.strokes), styleId: n.strokeStyleId });
  if (vectorFilled(n)) parts.push({ kind: 'fill', paints: ownFills, styleId: n.fillStyleId });
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
    const align = kind === 'stroke' ? n.strokeAlign : null;
    const flagList = [...flags].sort();
    const key = [kind, sourceId(source), element.hex, beneath ? (beneath.source.kind === 'raw' ? beneath.hex : sourceId(beneath.source)) : '-', fill ? fill.hex : '-', weight, align, flagList.join(','), reason].join('|');
    if (!nonTextPairs.has(key)) {
      nonTextPairs.set(key, { kind, element, beneath, ratio: colour && bg.color ? ratio(colour, bg.color) : null, fill, weight, align, flags: flagList, reason, count: 0, nodes: [] });
      nonTextSeen.set(key, new Set());
    }
    const group = nonTextPairs.get(key), ids = nonTextSeen.get(key);
    if (!ids.has(n.id)) {
      ids.add(n.id);
      group.count++;
      if (group.nodes.length < SAMPLES) group.nodes.push({ id: n.id, path: e.path });
    }
  }
}

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.colourPairs = { textLayers, groups: [...pairs.values()], elementLayers, nonText: [...nonTextPairs.values()] };
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

// Annotation categories. The review's own categories, "Design review: <axis>", are left out.
let categories = null;
try {
  categories = new Map((await figma.annotations.getAnnotationCategoriesAsync()).map(c => [c.id, c.label]));
} catch (e) {
  out.unread.push({ what: 'annotations', reason: `annotations can't be read here: ${String((e && e.message) || e)}` });
}
const reviewCategory = (label) => /^design review: /i.test(label || '');
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
const native = [];
let excluded = 0;
const readAnnotations = (n, path) => {
  if (!categories || !('annotations' in n) || !n.annotations.length) return;
  for (const a of n.annotations) {
    const category = a.categoryId ? categories.get(a.categoryId) || null : null;
    if (reviewCategory(category)) { excluded++; continue; }
    const entry = { node: { id: n.id, path, type: n.type }, category, text: cut(a.labelMarkdown || a.label || '', 500) };
    if (a.properties && a.properties.length) entry.properties = a.properties.map(p => p.type);
    native.push(entry);
  }
};
// An instance's main component, its set and the kit it belongs to, if any.
const componentOf = async (n) => {
  const main = await n.getMainComponentAsync();
  const set = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : null;
  const name = main ? main.name : null;
  const kit = KITS.find(k => [name, set].some(s => s && s.toLowerCase().startsWith(String(k).toLowerCase()))) || null;
  return { main, name, set, label: set ? `${set} (${name})` : name, kit };
};
const textIn = (n) => cut(n.findAllWithCriteria({ types: ['TEXT'] }).filter(t => !hidden(t)).map(t => t.characters.trim()).filter(Boolean).join(' / '), 500);

const frames = [], media = [], vectors = [], reactions = [], kits = [];
const instances = new Map();
let textLayers = 0;
const sample = (list, entry) => { if (list.length < SAMPLES) list.push(entry); };
const counts = { frames: 0, media: 0, vectors: 0, reactions: 0 };

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
  // Instances nested in another instance are looked up only to find kit instances, since lookups are slow.
  if (n.type === 'INSTANCE' && !top && (!inInstance || KITS.length)) {
    const c = await componentOf(n);
    if (c.kit) { kits.push({ kit: c.kit, component: c.label, node: { id: n.id, path }, text: textIn(n), where: 'in scope' }); return; }
    if (!inInstance) {
      const key = c.main ? c.main.id : 'unknown';
      if (!instances.has(key)) instances.set(key, { component: c.name, set: c.set, variant: n.variantProperties || undefined, look: lookOf(n), count: 0, nodes: [] });
      const group = instances.get(key);
      group.count++;
      sample(group.nodes, { id: n.id, path, ...boxOf(n) });
    }
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
let walked = true;
try {
  // Annotations on the frames holding the scanned node apply to it too.
  for (let a = node.parent; a && a.type !== 'PAGE'; a = a.parent) readAnnotations(a, pathOf(a));
  await walk(node, pathOf(node), 0, false);
} catch (e) {
  walked = false;
  out.unread.push({ what: 'structure', reason: `the walk failed: ${String((e && e.message) || e)}` }, { what: 'annotations', reason: 'the walk failed' });
}

// Free-text notes and kit instances on the canvas beside the frame: outside every frame, nearest to this frame, and within NEAR px of it.
const notes = [];
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
for (const c of walked && categories ? canvasItems : []) {
  const b = c.absoluteBoundingBox;
  if (!b || c.id === frameOnCanvas.id) continue;
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
  if (component) kits.push({ kit: component.kit, component: component.label, node: { id: c.id, path: c.name }, text: textIn(c), where: `on the canvas, ${Math.round(best)} px away` });
  else if (c.characters.trim()) notes.push({ node: { id: c.id }, text: cut(c.characters.trim(), 500), gap: Math.round(best) });
}

// The scanned node's own place: whether it's a screen depends on these.
const own = {
  size: { width: Math.round(node.width), height: Math.round(node.height) },
  parent: node.parent ? node.parent.type : null,
  layout: 'layoutMode' in node && node.layoutMode !== 'NONE' ? node.layoutMode : undefined,
  sections,
};
out.structure = walked ? {
  ...own,
  frames: { count: counts.frames, nodes: frames },
  instances: [...instances.values()],
  media: { count: counts.media, nodes: media },
  vectors: { count: counts.vectors, nodes: vectors },
  reactions: { count: counts.reactions, nodes: reactions },
  textLayers,
} : own;
out.unread.push(
  { what: 'structure (target sizes)', reason: 'not read by this version of the scanner' },
  { what: 'structure (what images show)', reason: 'not read by this version of the scanner' },
  { what: 'structure (libraries)', reason: 'not read by this version of the scanner' },
);
if (walked && categories) out.annotations = { native, kits, notes, excluded };
if (!out.annotations) out.groups = ['structure'];

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
// Past it, keep the node's own place, and scan its children for the rest.
const size = () => JSON.stringify(out).length;
const paths = () => [...frames, ...media, ...vectors, ...reactions, ...[...instances.values()].flatMap(g => g.nodes), ...native.map(a => a.node), ...kits.map(k => k.node)];
if (walked) {
  if (size() > LIMIT) for (const x of paths()) if (x.path) x.path = x.path.split(' / ').slice(-3).join(' / ');
  if (size() > LIMIT) for (const f of frames) delete f.look;
  for (let d = 6; d >= 1 && size() > LIMIT; d--) out.structure.frames.nodes = frames.filter(f => f.depth <= d);
  if (size() > LIMIT) for (const g of out.structure.instances) g.nodes = g.nodes.slice(0, 3);
  if (size() > LIMIT) for (const a of [...native, ...kits, ...notes]) a.text = cut(a.text, 150);
}
if (size() > LIMIT) {
  out.structure = own;
  out.annotations = null;
  out.groups = ['structure'];
  out.unread.push({ what: 'structure (layers) and annotations', reason: 'output limit: too many layers for one call; scan each id in scanInstead', scanInstead: childIds(node) });
}
return out;
```

## The bindings script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.2';
const LIMIT = 18000;
const SAMPLES = 10;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['bindings'], unread: [], bindings: null };
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

// Library names by variable collection key, never by collection name.
const libraries = new Map();
try {
  for (const c of await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()) libraries.set(c.key, c.libraryName);
} catch (e) {
  out.unread.push({ what: 'library names', reason: `figma.teamLibrary failed: ${e && e.message ? e.message : e}` });
}

const round = (v) => Math.round(v * 100) / 100;
const hex = (c, a = 1) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase() : '');
const valueOf = (v) => (v && typeof v === 'object' && 'r' in v ? hex(v, 'a' in v ? v.a : 1) : typeof v === 'number' ? round(v) : v);
const textValue = (t) => {
  const lh = !t.lineHeight || t.lineHeight.unit === 'AUTO' ? 'auto' : t.lineHeight.unit === 'PERCENT' ? `${round(t.lineHeight.value)}%` : round(t.lineHeight.value);
  const ls = t.letterSpacing && t.letterSpacing.value ? ` ${round(t.letterSpacing.value)}${t.letterSpacing.unit === 'PERCENT' ? '%' : 'px'}` : '';
  return `${t.fontName.family} ${t.fontName.style} ${round(t.fontSize)}/${lh}${ls}`;
};
const effectValue = (e) => (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'
  ? `${e.type} ${hex(e.color, e.color.a)} ${round(e.offset.x)} ${round(e.offset.y)} ${round(e.radius)} ${round(e.spread || 0)}`
  : 'radius' in e ? `${e.type} ${round(e.radius)}` : e.type);

// Variables and styles used in the scope, each read once. Aliases are followed to the end of the chain.
const variables = new Map(), collections = new Map(), styles = new Map();
let unnamedLibraryVariables = 0;
const collectionOf = async (id) => {
  if (!collections.has(id)) collections.set(id, await figma.variables.getVariableCollectionByIdAsync(id));
  return collections.get(id);
};
const useVariable = async (id, consumer, property, direct = true) => {
  if (!variables.has(id)) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) variables.set(id, { id, name: null, reason: 'variable not found', uses: 0, properties: new Set() });
    else {
      const collection = await collectionOf(v.variableCollectionId);
      const mode = (consumer.resolvedVariableModes || {})[v.variableCollectionId] || (collection && collection.defaultModeId) || Object.keys(v.valuesByMode)[0];
      const modeValue = v.valuesByMode[mode];
      const aliasId = modeValue && modeValue.type === 'VARIABLE_ALIAS' ? modeValue.id : null;
      let value = null;
      try { value = valueOf(v.resolveForConsumer(consumer).value); } catch (e) { value = aliasId ? null : valueOf(modeValue); }
      const library = v.remote ? (collection && libraries.get(collection.key)) || null : null;
      if (v.remote && !library) unnamedLibraryVariables++;
      const entry = { key: v.key, name: v.name, type: v.resolvedType, collection: collection ? { key: collection.key, name: collection.name } : null, library, remote: v.remote, value, aliasId, uses: 0, properties: new Set() };
      variables.set(id, entry);
      if (aliasId) await useVariable(aliasId, consumer, property, false);
    }
  }
  if (direct) { const entry = variables.get(id); entry.uses++; entry.properties.add(property); }
};
// Variables bound on a text run or an effect. True when any is bound.
const useAliases = async (boundVariables, consumer, property) => {
  const aliases = Object.values(boundVariables || {}).filter(a => a && a.id);
  for (const a of aliases) await useVariable(a.id, consumer, property);
  return aliases.length > 0;
};
const styleValue = (s) => {
  if (s.type === 'PAINT') {
    const paints = s.paints.filter(p => p.visible !== false);
    return paints.length === 1 && paints[0].type === 'SOLID' ? hex(paints[0].color, paints[0].opacity ?? 1) : `${paints.length} paints`;
  }
  if (s.type === 'TEXT') return textValue(s);
  if (s.type === 'EFFECT') return s.effects.filter(e => e.visible !== false).map(effectValue).join(', ');
  return s.type;
};
const useStyle = async (id, property) => {
  if (!styles.has(id)) {
    const s = await figma.getStyleByIdAsync(id);
    styles.set(id, s ? { key: s.key, name: s.name, type: s.type, remote: s.remote, value: styleValue(s), uses: 0, properties: new Set() } : { id, name: null, reason: 'style not found', uses: 0, properties: new Set() });
  }
  const entry = styles.get(id);
  entry.uses++;
  entry.properties.add(property);
};

// Raw values: set on a layer, bound to no variable or style. A radius or spacing of 0 is Figma's unset default, so it isn't listed.
let gradients = 0;
const readPaints = async (list, styleId, property, consumer, values) => {
  if (!Array.isArray(list)) return;
  const paints = list.filter(p => p.visible !== false && (p.opacity ?? 1) > 0);
  if (!paints.length) return;
  if (typeof styleId === 'string' && styleId) { await useStyle(styleId, property); return; }
  for (const p of paints) {
    if (p.type === 'SOLID') {
      const alias = p.boundVariables && p.boundVariables.color;
      if (alias) await useVariable(alias.id, consumer, property);
      else values.push({ property, value: hex(p.color, p.opacity ?? 1) });
    } else if (p.type.startsWith('GRADIENT')) gradients++;
  }
};
// Number fields: a bound one is a use, and the unbound ones above 0 are returned.
const unboundNumbers = async (n, fields, property) => {
  const bound = n.boundVariables || {};
  const unbound = [];
  for (const f of fields) {
    if (bound[f]) await useVariable(bound[f].id, n, property);
    else if (n[f] > 0) unbound.push(f);
  }
  return unbound;
};
const CORNERS = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
const PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
const rawValuesOf = async (n) => {
  const values = [];
  if (n.type === 'TEXT') {
    for (const s of n.getStyledTextSegments(['fills', 'fillStyleId', 'textStyleId', 'fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'boundVariables'])) {
      await readPaints(s.fills, s.fillStyleId, 'fill', n, values);
      if (typeof s.textStyleId === 'string' && s.textStyleId) await useStyle(s.textStyleId, 'text');
      else if (!(await useAliases(s.boundVariables, n, 'text'))) values.push({ property: 'text', value: textValue(s) });
    }
  } else if ('fills' in n) await readPaints(n.fills, n.fillStyleId, 'fill', n, values);
  if ('strokes' in n && (n.strokeWeight === figma.mixed || n.strokeWeight > 0)) await readPaints(n.strokes, n.strokeStyleId, 'stroke', n, values);
  if ('effects' in n && Array.isArray(n.effects)) {
    const effects = n.effects.filter(e => e.visible !== false);
    if (effects.length && typeof n.effectStyleId === 'string' && n.effectStyleId) await useStyle(n.effectStyleId, 'effect');
    else for (const e of effects) if (!(await useAliases(e.boundVariables, n, 'effect'))) values.push({ property: 'effect', value: effectValue(e) });
  }
  if ('topLeftRadius' in n) {
    const unbound = await unboundNumbers(n, CORNERS, 'radius');
    if (unbound.length === 4 && CORNERS.every(c => n[c] === n.topLeftRadius)) values.push({ property: 'radius', field: 'cornerRadius', value: round(n.topLeftRadius) });
    else for (const c of unbound) values.push({ property: 'radius', field: c, value: round(n[c]) });
  }
  if ('layoutMode' in n && (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL')) {
    const fields = [...PADDING];
    if (n.primaryAxisAlignItems !== 'SPACE_BETWEEN') fields.push('itemSpacing');
    if (n.layoutWrap === 'WRAP' && typeof n.counterAxisSpacing === 'number') fields.push('counterAxisSpacing');
    const unbound = await unboundNumbers(n, fields, 'spacing');
    const samePadding = PADDING.every(f => unbound.includes(f) && n[f] === n.paddingTop);
    if (samePadding) values.push({ property: 'spacing', field: 'padding', value: round(n.paddingTop) });
    for (const f of unbound) if (!(samePadding && PADDING.includes(f))) values.push({ property: 'spacing', field: f, value: round(n[f]) });
  }
  return values;
};

// Inside an instance, a raw value is the layer's where the outermost instance overrides it.
// Every other raw value there comes unchanged from the component of the nearest instance, and is listed under that component.
const OVERRIDE_FIELDS = {
  fill: ['fills', 'fillStyleId'],
  stroke: ['strokes', 'strokeStyleId', 'strokeWeight'],
  effect: ['effects', 'effectStyleId'],
  radius: ['cornerRadius', ...CORNERS],
  spacing: [...PADDING, 'itemSpacing', 'counterAxisSpacing'],
  text: ['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'textStyleId'],
};
const overridden = new Map();
const noteOverrides = (instance) => {
  for (const o of instance.overrides || []) {
    if (!overridden.has(o.id)) overridden.set(o.id, new Set());
    for (const f of o.overriddenFields) overridden.get(o.id).add(f);
  }
};
const mainComponents = new Map(), inherited = new Map();
const noteInherited = async (instance, n, path, values) => {
  if (!mainComponents.has(instance.id)) mainComponents.set(instance.id, await instance.getMainComponentAsync());
  const main = mainComponents.get(instance.id);
  const id = main ? main.key : `instance:${instance.id}`;
  if (!inherited.has(id)) {
    const set = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : null;
    inherited.set(id, { component: main ? { key: main.key, name: set ? `${set.name}, ${main.name}` : main.name, remote: main.remote } : null, count: 0, values: [], instances: new Set(), nodes: [] });
  }
  const entry = inherited.get(id);
  entry.count += values.length;
  entry.instances.add(instance.id);
  for (const v of values) if (entry.values.length < SAMPLES && !entry.values.some(w => w.property === v.property && w.field === v.field && w.value === v.value)) entry.values.push(v);
  if (entry.nodes.length < SAMPLES) entry.nodes.push({ id: n.id, path });
};
const raw = [];
let layers = 0;
const walk = async (n, outerInstance, nearestInstance, parentPath) => {
  if (n.visible === false || ('opacity' in n && n.opacity === 0)) return;
  layers++;
  const path = parentPath ? `${parentPath} / ${n.name}` : n.name;
  if (n.type === 'INSTANCE') {
    if (!outerInstance) { outerInstance = n; noteOverrides(n); }
    nearestInstance = n;
  }
  let values = await rawValuesOf(n);
  if (outerInstance) {
    const fields = overridden.get(n.id) || new Set();
    const isOverridden = (v) => fields.has('boundVariables') || OVERRIDE_FIELDS[v.property].some(f => fields.has(f));
    const fromComponent = values.filter(v => !isOverridden(v));
    if (fromComponent.length) await noteInherited(nearestInstance, n, path, fromComponent);
    values = values.filter(isOverridden);
  }
  if (values.length) raw.push({ node: { id: n.id, path }, ...(outerInstance ? { instance: { id: outerInstance.id, name: outerInstance.name } } : {}), values });
  if ('children' in n) for (const c of n.children) await walk(c, outerInstance, nearestInstance, path);
};
// A scanned node inside an instance starts with the instances above it.
let outerAbove = null, nearestAbove = null, parentPath = '';
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) {
  if (x.type === 'INSTANCE') { outerAbove = x; if (!nearestAbove) nearestAbove = x; }
  parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
}
if (outerAbove) noteOverrides(outerAbove);
await walk(node, outerAbove, nearestAbove, parentPath);

const keyOf = (id) => (variables.get(id) || {}).key || id;
out.bindings = {
  layers,
  raw,
  inherited: [...inherited.values()].map(({ instances, ...i }) => ({ ...i, instances: instances.size })),
  variables: [...variables.values()].map(({ aliasId, properties, ...v }) => ({ ...v, alias: aliasId ? keyOf(aliasId) : null, properties: [...properties] })),
  styles: [...styles.values()].map(({ properties, ...s }) => ({ ...s, properties: [...properties] })),
};
if (unnamedLibraryVariables) out.unread.push({ what: 'library names', reason: `no library name for ${unnamedLibraryVariables} library variables: their collections aren't among figma.teamLibrary's` });
if (gradients) out.unread.push({ what: 'gradient paints', reason: `${gradients} gradient paints weren't read: this version reads solid paints only` });

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
const size = () => JSON.stringify(out).length;
const located = () => [...raw.map(r => r.node), ...out.bindings.inherited.flatMap(i => i.nodes)];
if (size() > LIMIT) for (const x of located()) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const i of out.bindings.inherited) i.nodes = i.nodes.slice(0, 3);
if (size() > LIMIT) for (const x of located()) delete x.path;
if (size() > LIMIT) {
  out.bindings = null;
  out.groups = [];
  out.unread.push({ what: 'bindings', reason: `output limit: ${raw.length} layers with raw values are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) });
}
return out;
```

## Finding the Review Profile

A Review Skill asks for this before it reviews: find the team's Review Profile and hand back its text, or say there's none, or that it can't be read. The Review Skill decides what to use from the profile and does its own asking. Interpret only what it takes to follow a pointer and to name the profile.

The caller gives you the reviewed file's key, the runtime, and the profile the user gave at run time, if any: its text, a local file, or a link to a Figma file or a GitHub file.

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

### Reading a location

- **A URL:** fetch it. Inside Figma's agent, use `curl -sSfL <url>` from `Bash`.
- **A local file,** in an external agent: read it.
- **A Figma file link:** run the page script with the link's file key. It reads the file's page named "Review Profile", wherever the link points in the file.

### The page script

It reads the page named "Review Profile" in a file. Pick the tool as in step 1 of Steps, with the file key. It may be another file's key: both tools read another file by its key. Run the script exactly as written, in one call. If the call errors, run it once more unchanged. If it errors again, the location is unreadable, with the error message as the reason.

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

## Writing a report frame

The Report Writer may ask you to save a report on the reviewed file's report page, the page named "Design review", as a frame of its own. This is the scanner's one script that writes to a file. It lays out the text it's given and judges nothing.

1. **Pick the tool** as in step 1 of Steps, with the reviewed file's key.
2. **Set the script's first three lines** from the Report Writer's hand-over, and run everything else exactly as written, in one call:
   - `NAME`: the frame's name, as a string
   - `MARKDOWN`: the Markdown report without its JSON block, as an array of strings, one per line
   - `REPORT`: the report JSON, as an object
3. **If the call is refused because the script is too long,** run it again with `const REPORT = null;`, so the frame goes without its JSON. If that's refused too, hand back `{ "error": "the report is too long to save as a frame" }`.
4. **If the call errors or returns an `error`,** retry it as in step 2 of Steps. The script removes whatever it added before it returns an error, so a retry adds no second frame. If it fails again, hand back the error.
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
