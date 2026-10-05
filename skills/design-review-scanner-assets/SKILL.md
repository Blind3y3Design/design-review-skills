---
name: design-review-scanner-assets
description: Reads Figma frames and returns two groups of Design Facts, bindings (the variables, styles and raw values layers use) and components (instances, detached frames and overrides), with each asset's library, for the other design review skills, which invoke it. Colour pairs, text, structure and annotations come from design-review-scanner. To start a review, use /design-review or a single review such as /design-review-library.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner: assets

Version 0.1.0-dev of the design review skills.

Reads a design and returns its Design Facts about the assets it uses, variables, styles and components: what was read or measured, never a judgement. The scanner holds no thresholds and no criteria. The Review Skill that asked for the facts judges them.

This skill returns two fact groups: `bindings` and `components`. Its sibling `design-review-scanner` returns the other four, `colourPairs`, `text`, `structure` and `annotations`. Callers ask each skill only for its own groups.

All reading goes through **fixed scripts**, tested as written, so every review reads a file the same way. Design Facts come from one script per fact group, where you change only the input line at the top. The scanner only reads: finding the Review Profile is the job of `design-review-profile`, and writing to the file is the job of `design-review-figma-writer`.

## Inputs

The calling skill gives you:

- **Scope:** the node ids to scan, one or more. Scripts can't see the user's selection, so the caller passes the ids of the selected or named frames.
- **Fact groups:** the groups of facts it needs. This skill reads two groups: `bindings`, with The bindings script, and `components`, with The components script.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Pick the tool.** Inside Figma Design's agent, run scripts with `evaluate_script`. In an external agent, use the Figma MCP server's `use_figma`, with the file key from the file's link. If neither tool is available, stop and tell the caller: "The Design Scanner can't read the design: connect the Figma MCP server, or run the review in Figma Design's agent."
2. **Scan each node id.** For each fact group asked for that has a script, copy the script and replace `NODE_ID` on its first line with one id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written. Run one call per id and group, in parallel where the runtime allows. If a call errors, run it once more unchanged. If it errors again, record the id, the group and the error message in that result's `unread`.
3. **Follow `scanInstead`.** A result whose `unread` lists `scanInstead` ids (for a page, or a frame too large for one call's output) is replaced by the results of running the same script on each of those ids.
4. **Record groups you can't read.** For each fact group the caller asked for that has no script here, add `{ "what": "<group>", "reason": "not read by this skill" }` to every result's `unread`. For `colourPairs`, `text`, `structure` and `annotations` the reason is "read by `design-review-scanner`, not by this skill".
5. **Name the libraries of components and styles.** The bindings script names each library variable's library, but the Plugin API has no lookup for components or styles, so the scripts leave their `library` null. Name them by key with the Figma MCP server's `get_libraries` and `search_design_system` tools. Without those tools, as inside Figma Design's agent, do only 5.1 and 5.4.
   1. List the remote assets the design uses itself, across all the results, each once: each component set or component in `components.components` with `remote: true` and either `instances` above 0 or its key among the components in `bindings.inherited`, counting a set once however many of its variants appear, the `source` of each frame in `components.detached` with `remote: true`, and each style in `bindings.styles` with `remote: true` and `uses` above `inComponents`. Any other asset comes only inside an instance and belongs with that instance's component, so it isn't looked up. Keep the first 20, in the order they first appear. With none, this step is done.
   2. Call `get_libraries` once, with the file key. Keep the `libraryKey` of each library in `libraries_added_to_file`.
   3. For each asset you kept, call `search_design_system` with the file key, `includeLibraryKeys` set to the kept library keys, and one query: `entity` `component` (for a set too) or `style`, and `query` the asset's name, or its set's name for a variant. Find the result whose key is the asset's: `componentKey` against the set's key for a variant, or else the component's key, and `key` for a style. Set the asset's `library` to that result's `libraryName`, in every result that holds the asset. Never take a library from a name that matches without its key.
   4. In each result that still holds one of the assets listed in step 5.1 with no `library`, add `{ "what": "component and style libraries", "reason": "no library name for <n> components and styles: <why>" }` to its `unread`. The why is "`search_design_system` didn't find their keys among the libraries added to this file", "the lookup stops at 20 assets per scan", or, without the tools, as inside Figma Design's agent, "this runtime has no library lookup for components and styles". Give each reason that applies.

The scan is done when every id in the scope has a result for every fact group asked for, every asset listed in step 5.1 has a `library` or is counted in its result's `unread`, and every result has been handed back.

## Hand back

Return the Design Facts to the calling skill: a JSON array holding one result per scanned node, with `"runtime"` added. When both scripts ran on a node, merge their outputs into one result: `factsVersion`, `fileKey` and `scope` from either, their `groups` and their `unread` joined, and each group's field from its script. Pass the values on as the scripts returned them, with the libraries step 5 named.

## Design Facts format

`factsVersion` 0.4. Each result holds:

- `factsVersion`, and `runtime` (added by you).
- `fileKey`: the file's key, or null when the runtime doesn't give it.
- `scope`: the node scanned: `id`, `name`, `type`, `page`, and `topLevelFrame` when the node sits inside a top-level frame.
- `groups`: the fact groups read.
- `unread[]`: what couldn't be read, each `{ what, reason }`, with `scanInstead` ids when the answer is to scan those instead.
- `bindings` and `components`: each group's facts, or null when it wasn't read. The other four fields are the other scanner's: the caller joins the two results.

Positions and sizes are in Figma px. `x` and `y` are measured from the top-level frame's top-left corner.

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

Each visible instance in the scope, grouped by its main component, the frames detached from an instance, and what each instance changes from its main component. Hidden layers and layers at zero opacity are skipped. Each main component is read once, however many instances use it.

- `instances`: how many instances were read.
- `components[]`: one per main component, in the order first found: `{ key, name, set, remote, library, instances, nested, nodes }`.
  - `set`: `{ key, name }` of the component set a variant belongs to, or null. A set's variants are separate entries with the same `set`.
  - `remote`: true for a component from another file, such as a library's. False for one defined in the reviewed file.
  - `library`: the library's name, found by key in step 5 of Steps, or null: for a local component, or one whose library couldn't be named, and `unread` then says why.
  - `instances`: how many of its instances are placed in the scope, outside any other instance. `nested`: how many sit inside another instance, and so come with that instance's component.
  - `nodes[]`: up to 10 of its instances, each `{ id, path }`, plus `inside`, the id of the outermost instance a nested one sits in.
- An instance whose main component can't be read counts in `instances`, and `unread` says so.
- `detached[]`: each frame outside any instance whose `detachedInfo` says it was detached from an instance, in the scope or holding the scanned node: `{ node: { id, path }, source }`.
  - `source`: the component it came from, as `detachedInfo` names it: `{ type, key, name, set, remote, library }`, with `type` `library` or `local`, and `id` for a local one. The scanner only reads, so it names the component only when an instance in the scope uses it, and gives `name`, `set` and `remote` as read from that instance's main component, with `library` as for `components`. Otherwise `name`, `set` and `remote` are null, and `key` is the library component's key from `detachedInfo`, or null for a local one. With a null `name`, `unread` stays empty: the frame is detached from a component the scope doesn't show.
- `overrides[]`: each layer that an instance changes from its main component, as the outermost instance's `overrides` list it, plus each nested instance swapped for another component: `{ node: { id, path }, instance, detached, changes }`. A scanned node inside an instance also gets the changes on the layers holding it.
  - `instance`: `{ id, name, component }` of the outermost instance, which holds the change, with its main component's key. `detached`: the id of the detached frame the instance sits in, when there is one.
  - `changes[]`: one per property changed, each `{ property, fields, through, carried, uncertain, values }`, the last four only when they apply.
  - `property`: what the change is to: `fill`, `stroke`, `effect`, `radius`, `spacing` or `text`, as in the bindings facts; `opacity` (opacity or blend mode); `layout` (auto-layout direction, alignment, wrapping or clipping); `size` (width, height or how it's sized); `content` (text content or a link); `visible`; `component` (a nested instance swapped); `variables` (bound variables changed, on a property the facts can't name); or `other` (any other field, and bound variables that match the main component's). A layer's new name isn't a change, so it isn't listed.
  - `fields`: the Figma fields the instance's `overrides` list, such as `fills` or `boundVariables`. A swap isn't in `overrides`, so its `fields` is empty: it's found by comparing the nested instance's component with the one its main component has there.
  - `through`: the name of the component property the change came through, such as `Label` or `Icon`, when the layer's field is bound to one.
  - `carried`: true when Figma carried the main component's own change over to a component swapped in: the main component's instance there changes the same fields, on the layer with the same names below it, to the same values.
  - `uncertain`: why the facts can't tell how the change came about, such as a change inside a nested instance whose component couldn't be read.
  - `values`: what the layer has now. A fill or stroke gives each paint, `{ value, variable }` or `{ value, style }` when it's bound, a radius, spacing or opacity `{ field, value, variable }`, text `{ value, style }`, an effect `{ value }` or `{ style }`, and layout `{ field, value }`. A `variable` or `style` is `{ key, name }`, and values are written as in the bindings facts. A size gives `{ width, height, component: { width, height }, sizing: { horizontal, vertical } }`: the layer's size, its main component's, and whether each axis is `FIXED`, `HUG` or `FILL`. A swap gives `{ key, name, was: { key, name } }`.

## The bindings script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.4';
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

## The components script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.4';
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

// An instance's layers are matched to its main component's by their positions, so the layers it hides have to be there too.
// Figma leaves them out while figma.skipInvisibleInstanceChildren is on, as it is through use_figma, so it's off until the script ends.
const skipping = figma.skipInvisibleInstanceChildren;
figma.skipInvisibleInstanceChildren = false;
try {
  // Main components. Each instance's is fetched once, all in parallel, and each main component is read once, however many instances use it:
  // these lookups dominate scan time.
  const mainOf = new Map(), readMains = new Map();
  const fetchMain = (n) => {
    if (!mainOf.has(n.id)) mainOf.set(n.id, n.getMainComponentAsync().catch(() => null));
    return mainOf.get(n.id);
  };
  const readMain = (main) => {
    if (!readMains.has(main.id)) {
      const set = main.parent && main.parent.type === 'COMPONENT_SET' ? { key: main.parent.key, name: main.parent.name } : null;
      readMains.set(main.id, { key: main.key, name: main.name, set, remote: main.remote });
    }
    return readMains.get(main.id);
  };
  const hidden = (n) => n.visible === false || ('opacity' in n && n.opacity === 0);
  const pathOf = (n) => { const names = []; for (let x = n; x && x.type !== 'PAGE'; x = x.parent) names.unshift(x.name); return names.join(' / '); };

  // Each visible instance, in layer order, and each frame detached from an instance. An instance inside another instance is nested:
  // it comes with the outer one's component. `detachedIn` is the detached frame an instance sits in, if any.
  const found = [], detachedFrames = [];
  const walk = (n, outerInstance, detachedIn, parentPath) => {
    if (hidden(n)) return;
    const path = parentPath ? `${parentPath} / ${n.name}` : n.name;
    if (n.type === 'INSTANCE') found.push({ n, path, outerInstance, detachedIn });
    else if (!outerInstance && n.type === 'FRAME' && n.detachedInfo) { detachedFrames.push({ n, path }); detachedIn = n; }
    const outer = outerInstance || (n.type === 'INSTANCE' ? n : null);
    if ('children' in n) for (const c of n.children) walk(c, outer, detachedIn, path);
  };
  // A scanned node inside an instance starts with the outermost instance above it, and one inside a detached frame with that frame,
  // which is listed too: when a large frame is scanned child by child, each child's result names it.
  let outerAbove = null, detachedAbove = null, parentPath = '';
  for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) {
    if (x.type === 'INSTANCE') outerAbove = x;
    parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
  }
  if (!outerAbove) for (let x = node.parent; x && x.type !== 'PAGE' && !detachedAbove; x = x.parent) if (x.type === 'FRAME' && x.detachedInfo) detachedAbove = x;
  if (detachedAbove) detachedFrames.push({ n: detachedAbove, path: pathOf(detachedAbove) });
  walk(node, outerAbove, detachedAbove, parentPath);
  await Promise.all(found.map(f => fetchMain(f.n)));

  // Grouped by main component, in the order first found.
  const components = new Map(), mainsByKey = new Map(), mainsById = new Map(), missing = [];
  for (const { n, path, outerInstance } of found) {
    const main = await fetchMain(n);
    if (!main) { missing.push(n.id); continue; }
    const { key, name, set, remote } = readMain(main);
    if (!components.has(key)) { components.set(key, { key, name, set, remote, library: null, instances: 0, nested: 0, nodes: [] }); mainsByKey.set(key, main); mainsById.set(main.id, main); }
    const entry = components.get(key);
    if (outerInstance) entry.nested++; else entry.instances++;
    if (entry.nodes.length < SAMPLES) entry.nodes.push(outerInstance ? { id: n.id, path, inside: outerInstance.id } : { id: n.id, path });
  }
  const instances = found.length;
  if (missing.length) out.unread.push({ what: 'main components', reason: `${missing.length} instances' main components couldn't be read, such as ${missing[0]}` });

  // The component each detached frame came from. detachedInfo names it by key (a library's) or id (a local one). It is named here only
  // when an instance in the scope already uses it: the scanner only reads, so it loads no other component into the file.
  const detached = [];
  for (const { n, path } of detachedFrames) {
    const info = n.detachedInfo, local = info.type === 'local';
    const main = local ? mainsById.get(info.componentId) : mainsByKey.get(info.componentKey);
    const read = main ? readMain(main) : { key: local ? null : info.componentKey, name: null, set: null, remote: null };
    detached.push({ node: { id: n.id, path }, source: { type: info.type, ...(local ? { id: info.componentId } : {}), key: read.key, name: read.name, set: read.set, remote: read.remote, library: null } });
  }

  // Overrides: what each outermost instance changes from its main component, as its `overrides` list it, by layer and property.
  // A renamed layer isn't a change to the design, so `name` isn't listed.
  const PROPERTIES = {
    fill: ['fills', 'fillStyleId', 'backgrounds', 'backgroundStyleId', 'textRangeFills'],
    stroke: ['strokes', 'strokeStyleId', 'strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeAlign', 'strokeCap', 'strokeJoin', 'strokeMiterLimit', 'dashPattern'],
    effect: ['effects', 'effectStyleId'],
    radius: ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius', 'cornerSmoothing'],
    spacing: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'itemSpacing', 'counterAxisSpacing'],
    text: ['fontName', 'fontFamily', 'fontStyle', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent', 'listSpacing', 'textCase', 'textDecoration', 'textDecorationSkipInk', 'textStyleId', 'openTypeFeatures', 'textAlignHorizontal', 'textAlignVertical', 'leadingTrim', 'hangingPunctuation', 'hangingList'],
    opacity: ['opacity', 'blendMode'],
    layout: ['layoutMode', 'layoutWrap', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent', 'itemReverseZIndex', 'strokesIncludedInLayout', 'clipsContent', 'layoutGrids', 'gridStyleId'],
    size: ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'primaryAxisSizingMode', 'counterAxisSizingMode', 'layoutGrow', 'layoutAlign', 'layoutSizingHorizontal', 'layoutSizingVertical', 'constrainProportions', 'textAutoResize'],
    content: ['characters', 'hyperlink'],
    visible: ['visible'],
  };
  const CORNERS = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
  const PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  const propertyOf = (field) => Object.keys(PROPERTIES).find(p => PROPERTIES[p].includes(field)) || 'other';
  const round = (v) => Math.round(v * 100) / 100;
  const hex = (c, a = 1) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase() : '');
  const shown = (paints) => (Array.isArray(paints) ? paints.filter(p => p.visible !== false && (p.opacity ?? 1) > 0) : []);
  const same = (a, b) => JSON.stringify(a, (k, v) => (v === figma.mixed ? 'mixed' : v)) === JSON.stringify(b, (k, v) => (v === figma.mixed ? 'mixed' : v));
  const variables = new Map(), styles = new Map();
  const variableOf = async (alias) => {
    if (!alias || !alias.id) return null;
    if (!variables.has(alias.id)) {
      const v = await figma.variables.getVariableByIdAsync(alias.id);
      variables.set(alias.id, v ? { key: v.key, name: v.name } : { id: alias.id, name: null });
    }
    return variables.get(alias.id);
  };
  const withVariable = async (value, alias) => { const v = await variableOf(alias); return v ? { ...value, variable: v } : value; };
  const styleOf = async (id) => {
    if (!styles.has(id)) { const s = await figma.getStyleByIdAsync(id); styles.set(id, s ? { key: s.key, name: s.name } : { id, name: null }); }
    return styles.get(id);
  };

  // A layer's counterpart in its outermost instance's main component, found at the same child positions: the layer as the component has it.
  // A nested instance that shows another component than the main component's own instance there (its slot) was swapped. Below it,
  // the counterpart is in the component it shows, and `swap` records the nested instance and the slot.
  const counterparts = new Map();
  const counterpartOf = async (n, instance) => {
    if (n.id === instance.id) return { node: await fetchMain(instance), swap: null };
    if (!counterparts.has(n.id)) counterparts.set(n.id, (async () => {
      const above = await counterpartOf(n.parent, instance);
      const at = n.parent.children.findIndex(c => c.id === n.id);
      let counterpart = above.node && 'children' in above.node ? above.node.children[at] || null : null, swap = above.swap;
      if (n.type === 'INSTANCE') {
        const shows = await fetchMain(n), slot = counterpart && counterpart.type === 'INSTANCE' ? counterpart : null, was = slot ? await fetchMain(slot) : null;
        if (!shows || !was) { swap = { at: n, slot, unknown: true }; counterpart = shows || counterpart; }
        else if (shows.id !== was.id) { swap = { at: n, slot, shows, was }; counterpart = shows; }
      }
      return { node: counterpart, swap };
    })());
    return counterparts.get(n.id);
  };

  // What a layer has now for a changed property, in the bindings facts' notation, with the variable or style it's bound to.
  // `keys` are the layer's fields that changed.
  const valuesOf = async (n, property, keys, counterpart) => {
    if (property === 'fill' || property === 'stroke') {
      const paints = property === 'fill' ? n.fills : n.strokes, styleId = property === 'fill' ? n.fillStyleId : n.strokeStyleId;
      if (paints === figma.mixed) return [{ value: 'mixed' }];
      const style = typeof styleId === 'string' && styleId ? await styleOf(styleId) : null;
      return Promise.all(shown(paints).map(p => {
        const value = { value: p.type === 'SOLID' ? hex(p.color, p.opacity ?? 1) : p.type.toLowerCase() };
        return style ? { ...value, style } : withVariable(value, p.boundVariables && p.boundVariables.color);
      }));
    }
    if (property === 'radius' || property === 'spacing' || property === 'opacity') {
      const fieldsToRead = property === 'radius' && keys.includes('cornerRadius') ? CORNERS : PROPERTIES[property].filter(f => f !== 'cornerRadius' && keys.includes(f));
      const bound = n.boundVariables || {};
      const values = await Promise.all(fieldsToRead.filter(f => typeof n[f] === 'number' || f === 'blendMode')
        .map(f => (f === 'blendMode' ? { field: f, value: n[f] } : withVariable({ field: f, value: round(n[f]) }, bound[f]))));
      // Four equal corners or paddings are one value, as in the bindings facts.
      for (const [four, field] of [[CORNERS, 'cornerRadius'], [PADDING, 'padding']]) {
        const these = values.filter(v => four.includes(v.field));
        if (these.length === 4 && these.every(v => same([v.value, v.variable], [these[0].value, these[0].variable]))) values.splice(values.indexOf(these[0]), 4, { ...these[0], field });
      }
      return values;
    }
    if (property === 'text') {
      const style = typeof n.textStyleId === 'string' && n.textStyleId ? await styleOf(n.textStyleId) : null;
      const { fontName, fontSize, lineHeight, letterSpacing } = n;
      const lh = !lineHeight || lineHeight.unit === 'AUTO' ? 'auto' : lineHeight.unit === 'PERCENT' ? `${round(lineHeight.value)}%` : round(lineHeight.value);
      const ls = letterSpacing && letterSpacing.value ? ` ${round(letterSpacing.value)}${letterSpacing.unit === 'PERCENT' ? '%' : 'px'}` : '';
      const mixed = !fontName || [fontName, fontSize, lineHeight, letterSpacing].includes(figma.mixed);
      const value = mixed ? 'mixed' : `${fontName.family} ${fontName.style} ${round(fontSize)}/${lh}${ls}`;
      return [style ? { value, style } : { value }];
    }
    if (property === 'effect') {
      if (typeof n.effectStyleId === 'string' && n.effectStyleId) return [{ style: await styleOf(n.effectStyleId) }];
      return (n.effects || []).filter(e => e.visible !== false).map(e => ({ value: e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'
        ? `${e.type} ${hex(e.color, e.color.a)} ${round(e.offset.x)} ${round(e.offset.y)} ${round(e.radius)} ${round(e.spread || 0)}`
        : 'radius' in e ? `${e.type} ${round(e.radius)}` : e.type }));
    }
    if (property === 'layout') return keys.map(f => ({ field: f, value: n[f] === figma.mixed ? 'mixed' : n[f] }));
    if (property === 'size') {
      return [{ width: round(n.width), height: round(n.height), component: counterpart ? { width: round(counterpart.width), height: round(counterpart.height) } : null, sizing: { horizontal: n.layoutSizingHorizontal || null, vertical: n.layoutSizingVertical || null } }];
    }
    return undefined;
  };
  const textField = (f) => PROPERTIES.text.includes(f);
  const propertyName = (ref) => String(ref).replace(/#[^#]*$/, '');
  // When a nested instance is swapped, Figma carries the main component's own changes on its slot over to the component swapped in,
  // to the layer at the same path of names. A change is carried over when the slot's overrides change that layer's fields to the same values.
  const namesBelow = (n, top) => { const names = []; for (let x = n; x && x.id !== top.id; x = x.parent) names.unshift(x.name); return names.join(' / '); };
  const carriedOver = async (n, keys, swap) => {
    const boundOn = (x, k) => (x.boundVariables || {})[k];
    for (const o of (swap.slot && swap.slot.overrides) || []) {
      const shared = keys.filter(k => o.overriddenFields.includes(k) || o.overriddenFields.includes('boundVariables'));
      if (!shared.length) continue;
      const slotLayer = await figma.getNodeByIdAsync(o.id);
      if (slotLayer && namesBelow(slotLayer, swap.slot) === namesBelow(n, swap.at) && shared.every(k => same(n[k], slotLayer[k]) && same(boundOn(n, k), boundOn(slotLayer, k)))) return true;
    }
    return false;
  };
  // The fields whose bound variables differ from the counterpart's, or null when there's no counterpart to compare with.
  const reboundFields = (n, counterpart) => {
    if (!counterpart) return null;
    const mine = n.boundVariables || {}, theirs = counterpart.boundVariables || {};
    return [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter(f => !same(mine[f], theirs[f]));
  };
  const changesOf = async (n, fields, instance) => {
    const { node: counterpart, swap } = await counterpartOf(n, instance);
    // Each changed field goes with its property, and `keys` collects the layer's fields to read the property's values from.
    const byProperty = new Map();
    const add = (property, field, key) => {
      if (!byProperty.has(property)) byProperty.set(property, { fields: [], keys: [] });
      const entry = byProperty.get(property);
      if (!entry.fields.includes(field)) entry.fields.push(field);
      if (key && !entry.keys.includes(key)) entry.keys.push(key);
    };
    for (const f of fields) {
      if (f === 'boundVariables') {
        // Figma names no property for a change of bound variables, so it's found by comparing them with the main component's.
        const rebound = reboundFields(n, counterpart);
        if (!rebound) add('variables', f);
        else if (!rebound.length) add('other', f);
        else for (const k of rebound) add(propertyOf(k), f, k);
      }
      // styledTextSegments changes with the text's content or its style: it goes with whichever else changed.
      else if (f === 'styledTextSegments') add(fields.some(textField) || !fields.includes('characters') ? 'text' : 'content', f);
      else add(propertyOf(f), f, f);
    }
    const refs = n.componentPropertyReferences || {};
    const changes = [];
    for (const [property, { fields: fs, keys }] of byProperty) {
      const change = { property, fields: fs };
      const ref = property === 'content' ? refs.characters : property === 'visible' ? refs.visible : null;
      if (ref) change.through = propertyName(ref);
      else if (property === 'variables') change.uncertain = 'its bound variables changed, and its main component couldn\'t be read to say on which property';
      else if (swap && swap.unknown) change.uncertain = `it's inside the nested instance ${swap.at.name}, whose component couldn't be compared with the main component's`;
      else if (swap && await carriedOver(n, keys, swap)) change.carried = true;
      const values = await valuesOf(n, property, keys, counterpart);
      if (values) change.values = values;
      changes.push(change);
    }
    return changes;
  };
  const fullName = (main) => { const { name, set } = readMain(main); return set ? `${set.name}, ${name}` : name; };
  // A change is listed when its layer is shown and in the scope, or holds the scanned node: when a large instance is scanned child by child,
  // each child's result gives the changes on the layers above it. A hidden layer is listed only when hiding it is the change.
  const listed = (n, fields, instance) => {
    if (hidden(n) && !fields.includes('visible')) return false;
    let inScope = !outerAbove;
    for (let x = n; x; x = x.parent) {
      if (x.id === node.id) inScope = true;
      if (x.id === instance.id) break;
      if (x.id !== n.id && hidden(x)) return false;
    }
    for (let x = node; !inScope && x && x.id !== instance.id; x = x.parent) if (x.parent && x.parent.id === n.id) inScope = true;
    return inScope;
  };
  const overrides = [];
  const outermost = [...(outerAbove ? [{ n: outerAbove, detachedIn: null }] : []), ...found.filter(f => !f.outerInstance)];
  const nestedIn = new Map(outermost.map(o => [o.n.id, []]));
  for (const f of found) if (f.outerInstance) nestedIn.get(f.outerInstance.id).push(f.n);
  for (const { n: instance, detachedIn } of outermost) {
    const main = await fetchMain(instance);
    const entries = new Map();
    const entryFor = (n) => {
      if (!entries.has(n.id)) entries.set(n.id, { node: { id: n.id, path: pathOf(n) }, instance: { id: instance.id, name: instance.name, component: main ? readMain(main).key : null }, ...(detachedIn ? { detached: detachedIn.id } : {}), changes: [] });
      return entries.get(n.id);
    };
    // Swaps aren't in `overrides`: a nested instance is swapped when it shows another component than its slot.
    for (const n of nestedIn.get(instance.id)) {
      const { swap } = await counterpartOf(n, instance);
      if (!swap || swap.at.id !== n.id || swap.unknown) continue;
      const ref = (n.componentPropertyReferences || {}).mainComponent;
      entryFor(n).changes.push({ property: 'component', fields: [], ...(ref ? { through: propertyName(ref) } : {}), values: [{ key: readMain(swap.shows).key, name: fullName(swap.shows), was: { key: readMain(swap.was).key, name: fullName(swap.was) } }] });
    }
    for (const o of instance.overrides || []) {
      const fields = o.overriddenFields.filter(f => f !== 'name');
      if (!fields.length) continue;
      const n = o.id === instance.id ? instance : await figma.getNodeByIdAsync(o.id);
      if (!n || !listed(n, fields, instance)) continue;
      entryFor(n).changes.push(...await changesOf(n, fields, instance));
    }
    overrides.push(...entries.values());
  }

  // Keep the output under the smaller runtime limit (about 20 kB through use_figma).
  out.components = { instances, components: [...components.values()], detached, overrides };
  const size = () => JSON.stringify(out).length;
  const located = () => [...out.components.components.flatMap(c => c.nodes), ...detached.map(d => d.node), ...overrides.map(o => o.node)];
  if (size() > LIMIT) for (const x of located()) x.path = x.path.split(' / ').slice(-3).join(' / ');
  if (size() > LIMIT) for (const c of out.components.components) c.nodes = c.nodes.slice(0, 3);
  if (size() > LIMIT) for (const x of located()) delete x.path;
  if (size() > LIMIT) {
    out.components = null;
    out.groups = [];
    out.unread = [{ what: 'components', reason: `output limit: ${components.size} components, ${detached.length} detached frames and ${overrides.length} overridden layers are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
  }
  return out;
} finally {
  figma.skipInvisibleInstanceChildren = skipping;
}
```
