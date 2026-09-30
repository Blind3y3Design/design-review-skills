---
name: design-review-scanner
description: Reads Figma frames and returns their Design Facts, such as text contrast ratios, for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from one script per fact group, where you change only the node id on its first line. A Review Skill also asks you to find the team's Review Profile, which has a procedure and a script of its own (see Finding the Review Profile).

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This version reads two groups: `colourPairs`, with The colour pairs script, and `bindings`, with The bindings script.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id.** For each fact group asked for that has a script, copy the script and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written. Run one call per id and group, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id, the group and the error message in that result's `unread`.
3. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of running the same script on each of those ids.
4. **Record groups you can't read.** For each fact group the caller asked for that has no script here, add `{ "what": "<group>", "reason": "not read by this version of the scanner" }` to every result's `unread`.

The scan is done when every id in the scope has a result, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, with `"runtime"` added. When several scripts ran on a node, merge their outputs into one result: `factsVersion`, `fileKey` and `scope` from any of them, their `groups` and their `unread` joined, and each group's field from its script. Pass the values on as the scripts returned them.

## Design Facts format

`factsVersion` 0.2. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame.
- `groups`: the fact groups read.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead.
- `colourPairs` and `bindings`: each group's facts, or null when it wasn't read.

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

### Bindings

How each visible layer in the scope uses variables and styles, and the raw values set where it uses neither. Hidden layers and layers at zero opacity are skipped. It reads fills, strokes, effects, corner radius, auto-layout padding and gaps, and text. Bindings on other properties, such as size or opacity, aren't read.

- `layers`: how many layers were read.
- `raw[]`: each layer with a raw value, as `{ node: { id, path }, instance, values[] }`:
  - `values[]`: each `{ property, field, value }`. `property` is `fill`, `stroke`, `effect`, `radius`, `spacing` or `text`. `field` names the Figma field for a radius or spacing: `cornerRadius` or `padding` when all four are the same, otherwise one such as `topLeftRadius`, `paddingLeft` or `itemSpacing`. `value` is written as Values below.
  - A radius or spacing of 0 counts as not set, and isn't listed. An image fill can't be bound, so it isn't listed either. Gradient paints aren't read: `unread` counts them.
  - `instance`: `{ id, name }` of the outermost instance the layer sits in, when there is one. Inside an instance, only the values the instance overrides are listed. Raw values it takes unchanged from its component are counted in `inheritedRawValues`.
- `variables[]`: each variable bound in the scope, and each one reached from those through an alias, once: `{ key, name, type, collection: { key, name }, library, remote, value, alias, uses, properties }`.
  - `library` is the library's name, found by the collection's key through `figma.teamLibrary`. It's null for a local variable (`remote` is false), or for a library variable whose library can't be named, and `unread` then says so.
  - `value` is the resolved value in the mode of the first layer that uses the variable. `alias` is the key of the variable it points to, or null.
  - `uses` counts the bindings to it in the scope, 0 for one reached only through an alias. `properties` lists the properties bound to it.
- `styles[]`: each style used in the scope, once: `{ key, name, type, remote, value, uses, properties }`. A paint style with anything but one solid paint gives its paint count as `value`.
- `inheritedRawValues`: how many raw values sit unchanged inside instances.

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

## The bindings script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.2';
const LIMIT = 18000;
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
let unnamed = 0;
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
      const own = v.valuesByMode[mode];
      let value = null;
      try { value = valueOf(v.resolveForConsumer(consumer).value); } catch (e) { value = own && own.type === 'VARIABLE_ALIAS' ? null : valueOf(own); }
      const library = v.remote ? (collection && libraries.get(collection.key)) || null : null;
      if (v.remote && !library) unnamed++;
      const entry = { key: v.key, name: v.name, type: v.resolvedType, collection: collection ? { key: collection.key, name: collection.name } : null, library, remote: v.remote, value, aliasId: own && own.type === 'VARIABLE_ALIAS' ? own.id : null, uses: 0, properties: new Set() };
      variables.set(id, entry);
      if (entry.aliasId) await useVariable(entry.aliasId, consumer, property, false);
    }
  }
  if (direct) { const entry = variables.get(id); entry.uses++; entry.properties.add(property); }
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

// Raw values: set on a layer, bound to no variable or style. A radius or spacing of 0 counts as not set.
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
const CORNERS = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
const PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
const rawValuesOf = async (n) => {
  const values = [];
  const bv = n.boundVariables || {};
  if (n.type === 'TEXT') {
    for (const s of n.getStyledTextSegments(['fills', 'fillStyleId', 'textStyleId', 'fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'boundVariables'])) {
      await readPaints(s.fills, s.fillStyleId, 'fill', n, values);
      if (typeof s.textStyleId === 'string' && s.textStyleId) await useStyle(s.textStyleId, 'text');
      else {
        const aliases = Object.values(s.boundVariables || {}).filter(a => a && a.id);
        if (aliases.length) for (const a of aliases) await useVariable(a.id, n, 'text');
        else values.push({ property: 'text', value: textValue(s) });
      }
    }
  } else if ('fills' in n) await readPaints(n.fills, n.fillStyleId, 'fill', n, values);
  if ('strokes' in n && (n.strokeWeight === figma.mixed || n.strokeWeight > 0)) await readPaints(n.strokes, n.strokeStyleId, 'stroke', n, values);
  if ('effects' in n && Array.isArray(n.effects)) {
    const effects = n.effects.filter(e => e.visible !== false);
    if (effects.length && typeof n.effectStyleId === 'string' && n.effectStyleId) await useStyle(n.effectStyleId, 'effect');
    else for (const e of effects) {
      const aliases = Object.values(e.boundVariables || {}).filter(a => a && a.id);
      if (aliases.length) for (const a of aliases) await useVariable(a.id, n, 'effect');
      else values.push({ property: 'effect', value: effectValue(e) });
    }
  }
  if ('topLeftRadius' in n) {
    const raw = [];
    for (const c of CORNERS) {
      if (bv[c]) await useVariable(bv[c].id, n, 'radius');
      else if (n[c] > 0) raw.push(c);
    }
    if (raw.length === 4 && CORNERS.every(c => n[c] === n.topLeftRadius)) values.push({ property: 'radius', field: 'cornerRadius', value: round(n.topLeftRadius) });
    else for (const c of raw) values.push({ property: 'radius', field: c, value: round(n[c]) });
  }
  if ('layoutMode' in n && (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL')) {
    const fields = [...PADDING];
    if (n.primaryAxisAlignItems !== 'SPACE_BETWEEN') fields.push('itemSpacing');
    if (n.layoutWrap === 'WRAP' && typeof n.counterAxisSpacing === 'number') fields.push('counterAxisSpacing');
    const raw = [];
    for (const f of fields) {
      if (bv[f]) await useVariable(bv[f].id, n, 'spacing');
      else if (n[f] > 0) raw.push(f);
    }
    const samePadding = PADDING.every(f => raw.includes(f) && n[f] === n.paddingTop);
    if (samePadding) values.push({ property: 'spacing', field: 'padding', value: round(n.paddingTop) });
    for (const f of raw) if (!(samePadding && PADDING.includes(f))) values.push({ property: 'spacing', field: f, value: round(n[f]) });
  }
  return values;
};

// Inside an instance, a raw value belongs to the layer only where the outermost instance overrides it.
// Every other raw value there comes unchanged from the component, and is only counted.
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
const raw = [];
let layers = 0, inherited = 0;
const walk = async (n, instance, parentPath) => {
  if (n.visible === false || ('opacity' in n && n.opacity === 0)) return;
  layers++;
  const path = parentPath ? `${parentPath} / ${n.name}` : n.name;
  if (!instance && n.type === 'INSTANCE') { instance = n; noteOverrides(n); }
  let values = await rawValuesOf(n);
  if (instance) {
    const fields = overridden.get(n.id) || new Set();
    const kept = values.filter(v => fields.has('boundVariables') || OVERRIDE_FIELDS[v.property].some(f => fields.has(f)));
    inherited += values.length - kept.length;
    values = kept;
  }
  if (values.length) raw.push({ node: { id: n.id, path }, ...(instance ? { instance: { id: instance.id, name: instance.name } } : {}), values });
  if ('children' in n) for (const c of n.children) await walk(c, instance, path);
};
let outer = null, parentPath = '';
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) {
  if (x.type === 'INSTANCE') outer = x;
  parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
}
if (outer) noteOverrides(outer);
await walk(node, outer, parentPath);

const keyOf = (id) => (variables.get(id) || {}).key || id;
out.bindings = {
  layers,
  raw,
  variables: [...variables.values()].map(({ aliasId, properties, ...v }) => ({ ...v, alias: aliasId ? keyOf(aliasId) : null, properties: [...properties] })),
  styles: [...styles.values()].map(({ properties, ...s }) => ({ ...s, properties: [...properties] })),
  inheritedRawValues: inherited,
};
if (unnamed) out.unread.push({ what: 'library names', reason: `no library name for ${unnamed} library variables: their collections aren't among figma.teamLibrary's` });
if (gradients) out.unread.push({ what: 'gradient paints', reason: `${gradients} gradient paints weren't read: this version reads solid paints only` });

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
const size = () => JSON.stringify(out).length;
if (size() > LIMIT) for (const r of raw) r.node.path = r.node.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const r of raw) delete r.node.path;
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
