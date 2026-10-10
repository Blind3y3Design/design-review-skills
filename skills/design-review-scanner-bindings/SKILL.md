---
name: design-review-scanner-bindings
description: Reads a Figma frame and returns one group of Design Facts, `bindings`, how each visible layer uses variables and styles, and the raw values set where it uses neither, for design-review-scanner, which invokes it and joins its result with the other groups. To read a design, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0" # x-release-please-version
---

# Design Scanner: Bindings

Version 0.1.0 of the design review skills. <!-- x-release-please-version -->

Returns the `bindings` Design Facts group, how each visible layer uses variables and styles, and the raw values set where it uses neither: what was read or measured, never a judgement. This is one of six scanning skills, each of which reads one fact group. `design-review-scanner` invokes the ones for the groups a caller asks for and joins their results. This skill holds no thresholds and no criteria, and only reads.

Reading goes through a fixed script, tested as written, so every review reads a file the same way. You change only the input line at the top.

## Inputs

The calling skill gives you:

- **Node id:** the one node id to scan. Scripts can't see the user's selection, so the caller passes the id of the selected or named frame.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Run the script.** Copy The bindings script section below and replace `NODE_ID` on its first line with the node id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written, with `evaluate_script` inside Figma Design's agent and the Figma MCP server's `use_figma` in an external agent, with the file key from the file's link. If the call errors, run it once more unchanged. If it errors again, tell the calling skill that the `bindings` group couldn't be read for this node, with the error message.
2. **Hand it back.** Return the result as the script returned it, with `"runtime"` added, and nothing else changed. The calling skill joins this group with the others for the node.

The scan is done when you have handed back the result.

## This group's facts


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
- `styles[]`: each style used in the scope, once: `{ key, name, type, remote, library, value, uses, inComponents, properties, nodes }`. `library` is the library's name, found by key by the Design Scanner's library-naming step, or null: for a local style (`remote` is false), or when it couldn't be named, and `unread` then says why. A paint style with anything but one solid paint gives its paint count as `value`. The other fields are as for variables.

**Values.** A colour is `#RRGGBB`, or `#RRGGBBAA` below full opacity. A radius or spacing is a number in px. Text is `<family> <style> <size>/<line height>`, such as `Inter Regular 16/24`, with any letter spacing after it. An effect is `<type> <colour> <x> <y> <blur> <spread>` for a shadow, or `<type> <blur>` for a blur.

## The bindings script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const SAMPLES = 10;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['bindings'], unread: [], bindings: null };
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
let currentLayer = { node: null, fromComponent: () => false };
const noteUse = (entry, property) => {
  entry.uses++;
  entry.properties.add(property);
  if (currentLayer.fromComponent(property)) entry.inComponents++;
  else if (entry.nodes.length < SAMPLES && !entry.nodes.some(x => x.id === currentLayer.node.id)) entry.nodes.push({ ...currentLayer.node });
};
const noUses = () => ({ uses: 0, inComponents: 0, properties: new Set(), nodes: [] });
const useVariable = async (id, consumer, property, direct = true) => {
  if (!variables.has(id)) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) variables.set(id, { id, name: null, reason: 'variable not found', ...noUses() });
    else {
      const collection = await collectionOf(v.variableCollectionId);
      const mode = (consumer.resolvedVariableModes || {})[v.variableCollectionId] || (collection && collection.defaultModeId) || Object.keys(v.valuesByMode)[0];
      const modeValue = v.valuesByMode[mode];
      const aliasId = modeValue && modeValue.type === 'VARIABLE_ALIAS' ? modeValue.id : null;
      let value = null;
      try { value = valueOf(v.resolveForConsumer(consumer).value); } catch (e) { value = aliasId ? null : valueOf(modeValue); }
      const library = v.remote ? (collection && libraries.get(collection.key)) || null : null;
      if (v.remote && !library) unnamedLibraryVariables++;
      const entry = { key: v.key, name: v.name, type: v.resolvedType, collection: collection ? { key: collection.key, name: collection.name } : null, library, remote: v.remote, value, aliasId, ...noUses() };
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
    styles.set(id, s ? { key: s.key, name: s.name, type: s.type, remote: s.remote, library: null, value: styleValue(s), ...noUses() } : { id, name: null, reason: 'style not found', ...noUses() });
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
  currentLayer = { node: { id: n.id, path }, fromComponent };
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
// Paths run from the top-level frame.
let outerAbove = null, nearestAbove = null, parentPath = '';
for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) if (x.type === 'INSTANCE') { outerAbove = x; if (!nearestAbove) nearestAbove = x; }
for (let x = node !== topFrame ? node.parent : null; x; x = x === topFrame ? null : x.parent) parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
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
