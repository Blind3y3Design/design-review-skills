---
name: design-review-scanner-structure
description: Reads a Figma frame and returns one group of Design Facts, `structure`, the top-level frame and every visible layer in it, for design-review-scanner, which invokes it and joins its result with the other groups. To read a design, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-alpha.4"
---

# Design Scanner: Structure

Version 0.1.0-alpha.4 of the design review skills.

Returns the `structure` Design Facts group, the top-level frame and every visible layer in it: what was read or measured, never a judgement. This is one of six scanning skills, each of which reads one fact group. `design-review-scanner` invokes the ones for the groups a caller asks for and joins their results. This skill holds no thresholds and no criteria, and only reads.

Reading goes through a fixed script, tested as written, so every review reads a file the same way. You change only the input line at the top.

## Inputs

The calling skill gives you:

- **Node id:** the one node id to scan. Scripts can't see the user's selection, so the caller passes the id of the selected or named frame.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Run the script.** Copy The structure script section below and replace `NODE_ID` on its first line with the node id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written, with `evaluate_script` inside Figma Design's agent and the Figma MCP server's `use_figma` in an external agent, with the file key from the file's link. If the call errors, run it once more unchanged. If it errors again, tell the calling skill that the `structure` group couldn't be read for this node, with the error message.
2. **Hand it back.** Return the result as the script returned it, with `"runtime"` added, and nothing else changed. The calling skill joins this group with the others for the node.

The scan is done when you have handed back the result.

## This group's facts


The top-level frame and every other visible layer in the scope, other than text.

- `frame`: `{ id, name, width, height }` of the top-level frame: the frame itself for a frame in a Figma section.
- `sections[]`: the Figma sections holding the scanned node, innermost first, each `{ id, name }`.
- `layers[]`: each `{ id, path, type, x, y, width, height }`, in layer order, plus:
  - `reactions`: the prototype triggers set on the layer, such as `ON_CLICK`.
  - `image`: true when it shows an image or video fill.
  - `variant`: a variant component's or instance's variant values, such as `{ "State": "Focused" }`.
  - `look`: the layer's visible `fills`, `strokes` (colour, weight and alignment, such as `#C7C7C7 2 OUTSIDE`) and `effects`, for comparing two states of one component. Components and instances give it, and other layers when they have a stroke or an effect. Over the output limit, it's the first thing left out.

  Inside an instance, only nested instances and layers with reactions or images are listed. An instance's main component is in the components facts. Paths are shortened, then left out, when the output limit needs it.

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
