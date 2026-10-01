---
name: design-review-scanner
description: Reads Figma frames and returns their Design Facts, such as text contrast ratios, for the other design review skills, which invoke it. To start a review, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from one script per fact group, where you change only the node id on its first line. A Review Skill also asks you to find the team's Review Profile, which has a procedure and a script of its own (see Finding the Review Profile), and the Report Writer asks you to save its report frames (see Writing a report frame).

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This version reads five groups: `colourPairs`, with The colour pairs script, `bindings`, with The bindings script, `components`, with The components script, `text`, with The text script, and `structure`, with The structure script.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id.** For each fact group asked for that has a script, copy the script and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written. Run one call per id and group, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id, the group and the error message in that result's `unread`.
3. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of running the same script on each of those ids.
4. **Record groups you can't read.** For each fact group the caller asked for that has no script here, add `{ "what": "<group>", "reason": "not read by this version of the scanner" }` to every result's `unread`.
5. **Name the libraries of components and styles,** when the caller asked for `components` or `bindings`. The bindings script names each library variable's library, but the Plugin API has no lookup for components or styles, so the scripts leave their `library` null. Look them up with the Figma MCP server's `get_libraries` and `search_design_system` tools, if you have them:
   1. Call `get_libraries` once, with the file key. Keep the `libraryKey` of each library in `libraries_added_to_file`.
   2. List the remote assets across all the results, each once: each component set or component in `components.components` with `remote: true`, counting a set once however many of its variants appear, and each style in `bindings.styles` with `remote: true`. Keep the first 20, in the order they first appear.
   3. For each of them, call `search_design_system` with the file key, `includeLibraryKeys` set to the kept library keys, and one query: `entity` `component` (for a set too) or `style`, and `query` the asset's name, or its set's name for a variant. Find the result whose key is the asset's: `componentKey` against the set's key for a variant, or else the component's key, and `key` for a style. Set the asset's `library` to that result's `libraryName`, in every result that holds the asset. Never take a library from a name that matches without its key.
   4. In each result that still holds a remote component or style with no `library`, add `{ "what": "component and style libraries", "reason": "no library name for <n> components and styles: <why>" }` to its `unread`. The why is "`search_design_system` didn't find their keys among the libraries added to this file", "the lookup stops at 20 assets per scan", or, without the tools, as inside Figma Design's agent, "this runtime has no library lookup for components and styles". Give each reason that applies.

The scan is done when every id in the scope has a result for every fact group asked for, the libraries in step 5 are looked up, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, with `"runtime"` added. When several scripts ran on a node, merge their outputs into one result: `factsVersion`, `fileKey` and `scope` from any of them, their `groups` and their `unread` joined, and each group's field from its script. Pass the values on as the scripts returned them, with the libraries step 5 named.

## Design Facts format

`factsVersion` 0.3. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame.
- `groups`: the fact groups read.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead.
- `colourPairs`, `bindings`, `components`, `text` and `structure`: each group's facts, or null when it wasn't read.

Positions and sizes are in Figma px. `x` and `y` are measured from the top-level frame's top-left corner.

### Colour pairs

Each visible, non-empty text layer in the scope, and each other layer with a fill or a stroke, measured against the layers painted beneath it. Hidden layers and layers at zero opacity are skipped. A text layer with several colours, sizes or weights gives one pair per run of text.

- `textLayers`: how many text layers were measured.
- `groups[]`: pairs grouped by Root Cause. Pairs share a group when they have the same text colour source, background, font size, weight and flags. A raw text colour's source is its own layer, so each raw-coloured text layer is its own group, while text bound to one variable or style on one background shares a group. Each group has:
  - `text`: `{ hex, source }`. `source.kind` is `variable` or `style`, with its `key`, `name` and `remote`, when the text colour is bound to one. Otherwise it's `raw`, with the text layer's id as `node`.
  - `background`: `{ hex, source, node }`: the colour behind the text, its source, and the layer it comes from. Null when it couldn't be computed.
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

### Bindings

How each visible layer in the scope uses variables and styles, and the raw values set where it uses neither. Hidden layers and layers at zero opacity are skipped. It reads fills, strokes, effects, corner radius, auto-layout padding and gaps, and text. Bindings on other properties, such as size or opacity, aren't read.

- `layers`: how many layers were read.
- `raw[]`: each layer with a raw value, as `{ node: { id, path }, instance, values[] }`:
  - `values[]`: each `{ property, field, value }`. `property` is `fill`, `stroke`, `effect`, `radius`, `spacing` or `text`. `field` names the Figma field for a radius or spacing: `cornerRadius` or `padding` when all four are the same, otherwise one such as `topLeftRadius`, `paddingLeft` or `itemSpacing`. `value` is written as Values below.
  - A radius or spacing of 0 is Figma's default for a layer with none set, so it isn't listed. An image fill can't be bound, so it isn't listed either. Gradient paints aren't read: `unread` counts them.
  - `instance`: `{ id, name }` of the outermost instance the layer sits in, when there is one. Inside an instance, `raw` lists only the values the instance overrides.
- `inherited[]`: the raw values that instances take unchanged from their components, grouped by the component of the nearest instance each layer sits in: `{ component: { key, name, remote }, count, values[], instances, nodes[] }`. `count` is how many raw values, `values` up to 10 distinct ones, `instances` how many instances hold them, and `nodes` up to 10 of the layers, each `{ id, path }`.
- `variables[]`: each variable bound in the scope, and each one reached from those through an alias, once: `{ key, name, type, collection: { key, name }, library, remote, value, alias, uses, inComponents, properties, nodes }`.
  - `library` is the library's name, found by the collection's key through `figma.teamLibrary`, never by the collection's name. It's null for a local variable (`remote` is false), or for a library variable whose library can't be named, and `unread` then says so.
  - `value` is the resolved value in the mode of the first layer that uses the variable. `alias` is the key of the variable it points to, or null.
  - `uses` counts the bindings to it in the scope, 0 for one reached only through an alias. `inComponents` counts those that instances take unchanged from their components. `properties` lists the properties bound to it.
  - `nodes[]`: up to 10 of the layers that bind it themselves, outside an instance or as an instance's override, each `{ id, path }`.
- `styles[]`: each style used in the scope, once: `{ key, name, type, remote, library, value, uses, inComponents, properties, nodes }`. `library` is the library's name, found by key in step 5 of Steps, or null: for a local style (`remote` is false), or when it couldn't be named, and `unread` then says why. A paint style with anything but one solid paint gives its paint count as `value`. The other fields are as for variables.

**Values.** A colour is `#RRGGBB`, or `#RRGGBBAA` below full opacity. A radius or spacing is a number in px. Text is `<family> <style> <size>/<line height>`, such as `Inter Regular 16/24`, with any letter spacing after it. An effect is `<type> <colour> <x> <y> <blur> <spread>` for a shadow, or `<type> <blur>` for a blur.

### Components

Each visible instance in the scope, grouped by its main component. Hidden instances and instances at zero opacity are skipped.

- `instances`: how many instances were read.
- `components[]`: one per main component, in the order first found: `{ key, name, set, remote, library, instances, nested, nodes }`.
  - `set`: `{ key, name }` of the component set a variant belongs to, or null. A set's variants are separate entries with the same `set`.
  - `remote`: true for a component from another file, such as a library's. False for one defined in the reviewed file.
  - `library`: the library's name, found by key in step 5 of Steps, or null: for a local component, or one whose library couldn't be named, and `unread` then says why.
  - `instances`: how many of its instances are placed in the scope, outside any other instance. `nested`: how many sit inside another instance, and so come with that instance's component.
  - `nodes[]`: up to 10 of its instances, each `{ id, path }`, plus `inside`, the id of the outermost instance a nested one sits in.
- An instance whose main component can't be read counts in `instances`, and `unread` says so.

### Text

Each visible, non-empty text layer in the scope, in layer order.

- `textLayers`: how many there are.
- `layers[]`: each `{ id, path, x, y, width, height, content, runs[] }`, where `content` is the layer's text.
  - `runs[]`: one per run of text with its own style, each `{ fontSize, fontWeight, font, textStyle, colour }`, plus `text` when the layer has more than one run, `decoration` (`UNDERLINE` or `STRIKETHROUGH`) when it has one, and `link` (a URL, or `node:<id>` for a link to a layer) when it's a link.
  - `font` is the family and style, such as `Inter Semi Bold`. `textStyle` is `{ key, name, remote }` when a text style is applied, otherwise null. `colour` is the top visible paint's `#RRGGBB`, or null when it isn't solid. Contrast is in the colour pairs.
  - `truncated`: true when `content` was cut to fit the output limit, which `unread` then says.

### Structure

The top-level frame and every other visible layer in the scope, other than text.

- `frame`: `{ id, name, width, height }` of the top-level frame.
- `layers[]`: each `{ id, path, type, x, y, width, height }`, in layer order, plus:
  - `reactions`: the prototype triggers set on the layer, such as `ON_CLICK`.
  - `image`: true when it shows an image or video fill.

  Inside an instance, only nested instances and layers with reactions or images are listed. An instance's main component is in the components facts. Paths are shortened, then left out, when the output limit needs it.
- Sections aren't read, and `unread` says so.

## The colour pairs script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.3';
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
const strokesOf = (n) => ('strokes' in n && (n.strokeWeight === figma.mixed || n.strokeWeight > 0) ? shown(n.strokes) : []);

// Paint order: a pre-order walk of the top-level frame, children back to front.
// Everything earlier in the walk is painted below everything later.
// `candidates` are the non-text layers in the scope with a fill or a stroke, measured by their rendered bounds.
const texts = [], painted = [], candidates = [];
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

## The bindings script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.3';
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
// The layer being read, and whether a property's value on it is taken unchanged from an instance's component.
let reading = { node: null, fromComponent: () => false };
const noteUse = (entry, property) => {
  entry.uses++;
  entry.properties.add(property);
  if (reading.fromComponent(property)) entry.inComponents++;
  else if (entry.nodes.length < SAMPLES && !entry.nodes.some(x => x.id === reading.node.id)) entry.nodes.push({ ...reading.node });
};
const unused = () => ({ uses: 0, inComponents: 0, properties: new Set(), nodes: [] });
const useVariable = async (id, consumer, property, direct = true) => {
  if (!variables.has(id)) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) variables.set(id, { id, name: null, reason: 'variable not found', ...unused() });
    else {
      const collection = await collectionOf(v.variableCollectionId);
      const mode = (consumer.resolvedVariableModes || {})[v.variableCollectionId] || (collection && collection.defaultModeId) || Object.keys(v.valuesByMode)[0];
      const modeValue = v.valuesByMode[mode];
      const aliasId = modeValue && modeValue.type === 'VARIABLE_ALIAS' ? modeValue.id : null;
      let value = null;
      try { value = valueOf(v.resolveForConsumer(consumer).value); } catch (e) { value = aliasId ? null : valueOf(modeValue); }
      const library = v.remote ? (collection && libraries.get(collection.key)) || null : null;
      if (v.remote && !library) unnamedLibraryVariables++;
      const entry = { key: v.key, name: v.name, type: v.resolvedType, collection: collection ? { key: collection.key, name: collection.name } : null, library, remote: v.remote, value, aliasId, ...unused() };
      variables.set(id, entry);
      if (aliasId) await useVariable(aliasId, consumer, property, false);
    }
  }
  if (direct) noteUse(variables.get(id), property);
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
// A style's library has no lookup in the Plugin API, so `library` stays null here (see Steps).
const useStyle = async (id, property) => {
  if (!styles.has(id)) {
    const s = await figma.getStyleByIdAsync(id);
    styles.set(id, s ? { key: s.key, name: s.name, type: s.type, remote: s.remote, library: null, value: styleValue(s), ...unused() } : { id, name: null, reason: 'style not found', ...unused() });
  }
  noteUse(styles.get(id), property);
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
  const fields = (outerInstance && overridden.get(n.id)) || new Set();
  const fromComponent = (property) => Boolean(outerInstance) && !fields.has('boundVariables') && !OVERRIDE_FIELDS[property].some(f => fields.has(f));
  reading = { node: { id: n.id, path }, fromComponent };
  let values = await rawValuesOf(n);
  if (outerInstance) {
    const unchanged = values.filter(v => fromComponent(v.property));
    if (unchanged.length) await noteInherited(nearestInstance, n, path, unchanged);
    values = values.filter(v => !fromComponent(v.property));
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
const sampled = () => [...out.bindings.inherited, ...out.bindings.variables, ...out.bindings.styles];
const located = () => [...raw.map(r => r.node), ...sampled().flatMap(i => i.nodes)];
if (size() > LIMIT) for (const x of located()) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const i of sampled()) i.nodes = i.nodes.slice(0, 3);
if (size() > LIMIT) for (const x of located()) delete x.path;
if (size() > LIMIT) {
  out.bindings = null;
  out.groups = [];
  out.unread.push({ what: 'bindings', reason: `output limit: ${raw.length} layers with raw values are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) });
}
return out;
```

## The text script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.3';
const LIMIT = 18000;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['text'], unread: [], text: null };
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
let parentPath = '';
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
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

const FACTS_VERSION = '0.3';
const LIMIT = 18000;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['structure'], unread: [], structure: null };
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

const round = (v) => Math.round(v * 100) / 100;
const origin = topFrame.absoluteBoundingBox || { x: 0, y: 0 };

const showsImage = (n) => 'fills' in n && Array.isArray(n.fills) && n.fills.some(p => p.visible !== false && (p.opacity ?? 1) > 0 && (p.type === 'IMAGE' || p.type === 'VIDEO'));

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
    layers.push(row);
  }
  if ('children' in n && n.type !== 'BOOLEAN_OPERATION') for (const c of n.children) await walk(c, inInstance || n.type === 'INSTANCE', path);
};
let parentPath = '', aboveInstance = false;
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) {
  parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
  if (x.type === 'INSTANCE') aboveInstance = true;
}
await walk(node, aboveInstance, parentPath);
out.unread.push({ what: 'sections', reason: 'not read by this version of the scanner' });

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.structure = { frame: { id: topFrame.id, name: topFrame.name, width: round(topFrame.width), height: round(topFrame.height) }, layers };
const size = () => JSON.stringify(out).length;
if (size() > LIMIT) for (const l of layers) l.path = l.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const l of layers) delete l.path;
if (size() > LIMIT) {
  out.structure = null;
  out.groups = [];
  out.unread = [{ what: 'structure', reason: `output limit: ${layers.length} layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
}
return out;
```

## The components script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.3';
const LIMIT = 18000;
const SAMPLES = 10;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['components'], unread: [], components: null };
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

// Each visible instance's main component, grouped by component. An instance inside another instance is nested: it comes with the outer one's component.
const components = new Map(), missing = [];
let instances = 0;
const walk = async (n, outermost, parentPath) => {
  if (n.visible === false || ('opacity' in n && n.opacity === 0)) return;
  const path = parentPath ? `${parentPath} / ${n.name}` : n.name;
  if (n.type === 'INSTANCE') {
    instances++;
    const main = await n.getMainComponentAsync();
    if (!main) missing.push(n.id);
    else {
      if (!components.has(main.key)) {
        const set = main.parent && main.parent.type === 'COMPONENT_SET' ? { key: main.parent.key, name: main.parent.name } : null;
        components.set(main.key, { key: main.key, name: main.name, set, remote: main.remote, library: null, instances: 0, nested: 0, nodes: [] });
      }
      const entry = components.get(main.key);
      if (outermost) entry.nested++; else entry.instances++;
      if (entry.nodes.length < SAMPLES) entry.nodes.push(outermost ? { id: n.id, path, inside: outermost.id } : { id: n.id, path });
    }
    if (!outermost) outermost = n;
  }
  if ('children' in n) for (const c of n.children) await walk(c, outermost, path);
};
// A scanned node inside an instance starts with the outermost instance above it.
let outerAbove = null, parentPath = '';
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) {
  if (x.type === 'INSTANCE') outerAbove = x;
  parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
}
await walk(node, outerAbove, parentPath);
if (missing.length) out.unread.push({ what: 'main components', reason: `${missing.length} instances' main components couldn't be read, such as ${missing[0]}` });

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.components = { instances, components: [...components.values()] };
const size = () => JSON.stringify(out).length;
const located = () => out.components.components.flatMap(c => c.nodes);
if (size() > LIMIT) for (const x of located()) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) for (const c of out.components.components) c.nodes = c.nodes.slice(0, 3);
if (size() > LIMIT) for (const x of located()) delete x.path;
if (size() > LIMIT) {
  out.components = null;
  out.groups = [];
  out.unread = [{ what: 'components', reason: `output limit: ${components.size} components are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
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
