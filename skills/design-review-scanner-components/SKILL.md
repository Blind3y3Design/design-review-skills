---
name: design-review-scanner-components
description: Reads a Figma frame and returns one group of Design Facts, `components`, each visible instance grouped by its main component, detached frames and overrides, for design-review-scanner, which invokes it and joins its result with the other groups. To read a design, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner: Components

Version 0.1.0-dev of the design review skills.

Returns the `components` Design Facts group, each visible instance grouped by its main component, detached frames and overrides: what was read or measured, never a judgement. This is one of six scanning skills, each of which reads one fact group. `design-review-scanner` invokes the ones for the groups a caller asks for and joins their results. This skill holds no thresholds and no criteria, and only reads.

Reading goes through a fixed script, tested as written, so every review reads a file the same way. You change only the input line at the top.

## Inputs

The calling skill gives you:

- **Node id:** the one node id to scan. Scripts can't see the user's selection, so the caller passes the id of the selected or named frame.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Run the script.** Copy The components script section below and replace `NODE_ID` on its first line with the node id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written, with `evaluate_script` inside Figma Design's agent and the Figma MCP server's `use_figma` in an external agent, with the file key from the file's link. If the call errors, run it once more unchanged. If it errors again, tell the calling skill that the `components` group couldn't be read for this node, with the error message.
2. **Hand it back.** Return the result as the script returned it, with `"runtime"` added, and nothing else changed. The calling skill joins this group with the others for the node.

The scan is done when you have handed back the result.

## This group's facts


Each visible instance in the scope, grouped by its main component, the frames detached from an instance, and what each instance changes from its main component. Hidden layers and layers at zero opacity are skipped. Each main component is read once, however many instances use it.

- `instances`: how many instances were read.
- `components[]`: one per main component, in the order first found: `{ key, name, set, remote, library, instances, nested, nodes }`.
  - `set`: `{ key, name }` of the component set a variant belongs to, or null. A set's variants are separate entries with the same `set`.
  - `remote`: true for a component from another file, such as a library's. False for one defined in the reviewed file.
  - `library`: the library's name, found by key by the Design Scanner's library-naming step, or null: for a local component, or one whose library couldn't be named, and `unread` then says why.
  - `instances`: how many of its instances are placed in the scope, outside any other instance. `nested`: how many sit inside another instance, and so come with that instance's component.
  - `nodes[]`: up to 10 of its instances, each `{ id, path }`, plus `inside`, the id of the outermost instance a nested one sits in.
- An instance whose main component can't be read counts in `instances`, and `unread` says so.
- `detached[]`: each frame outside any instance whose `detachedInfo` says it was detached from an instance, in the scope or holding the scanned node: `{ node: { id, path }, source }`.
  - `source`: the component it came from, as `detachedInfo` names it: `{ type, key, name, set, remote, library }`, with `type` `library` or `local`, and `id` for a local one. The scanner only reads: it names a local component by reading it by `id`, and a library component only when an instance in the scope uses it, since naming any other would mean loading it into the file. A named source gives `key`, `name`, `set` and `remote` as read from its main component, with `library` as for `components`. Otherwise `name`, `set` and `remote` are null, and `key` is the library component's key from `detachedInfo`, or null for a local one. With a null `name`, `unread` stays empty: the frame is detached from a library component the scope doesn't show, or from a local component that no longer exists.
- `overrides[]`: each layer that an instance changes from its main component, as the outermost instance's `overrides` list it, plus each nested instance swapped for another component: `{ node: { id, path }, instance, detached, changes }`. A scanned node inside an instance also gets the changes on the layers holding it.
  - `instance`: `{ id, name, component }` of the outermost instance, which holds the change, with its main component's key. `detached`: the id of the detached frame the instance sits in, when there is one.
  - `changes[]`: one per property changed, each `{ property, fields, through, carried, uncertain, values }`, the last four only when they apply.
  - `property`: what the change is to: `fill`, `stroke`, `effect`, `radius`, `spacing` or `text`, as in the bindings facts; `opacity` (opacity or blend mode); `layout` (auto-layout direction, alignment, wrapping or clipping); `size` (width, height or how it's sized); `content` (text content or a link); `visible`; `component` (a nested instance swapped); `variables` (bound variables changed, on a property the facts can't name); or `other` (any other field, and bound variables that match the main component's). A layer's new name isn't a change, so it isn't listed.
  - `fields`: the Figma fields the instance's `overrides` list, such as `fills` or `boundVariables`. A swap isn't in `overrides`, so its `fields` is empty: it's found by comparing the nested instance's component with the one its main component has there.
  - `through`: the name of the component property the change came through, such as `Label` or `Icon`, when the layer's field is bound to one.
  - `carried`: true when Figma carried the main component's own change over to a component swapped in: the main component's instance there changes the same fields, on the layer with the same names below it, to the same values.
  - `uncertain`: why the facts can't tell how the change came about, such as a change inside a nested instance whose component couldn't be read.
  - `values`: what the layer has now. A fill or stroke gives each paint, `{ value, variable }` or `{ value, style }` when it's bound, a radius, spacing or opacity `{ field, value, variable }`, text `{ value, style }`, an effect `{ value }` or `{ style }`, and layout `{ field, value }`. A `variable` or `style` is `{ key, name }`, and values are written as in the bindings facts. A size gives `{ width, height, component: { width, height }, sizing: { horizontal, vertical } }`: the layer's size, its main component's, and whether each axis is `FIXED`, `HUG` or `FILL`. A swap gives `{ key, name, was: { key, name } }`.

## The components script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const SAMPLES = 10;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['components'], unread: [], components: null };
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
  // Layer names from the top-level frame down to a layer, or from the page's child for a layer above the frame.
  const pathOf = (n) => { const names = []; for (let x = n; x && x.type !== 'PAGE'; x = x === topFrame ? null : x.parent) names.unshift(x.name); return names.join(' / '); };

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
  for (let x = node.parent; x && x.type !== 'PAGE'; x = x.parent) if (x.type === 'INSTANCE') outerAbove = x;
  for (let x = node !== topFrame ? node.parent : null; x; x = x === topFrame ? null : x.parent) parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
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

  // The component each detached frame came from. detachedInfo names it by key (a library's) or id (a local one). A local one is read by id.
  // A library's is named only when an instance in the scope already uses it, so no other component is loaded into the file.
  const detached = [];
  for (const { n, path } of detachedFrames) {
    const info = n.detachedInfo, local = info.type === 'local';
    let main = local ? mainsById.get(info.componentId) : mainsByKey.get(info.componentKey);
    if (!main && local) main = await figma.getNodeByIdAsync(info.componentId).then(c => c && c.type === 'COMPONENT' ? c : null).catch(() => null);
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
