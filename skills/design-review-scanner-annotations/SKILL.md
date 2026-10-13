---
name: design-review-scanner-annotations
description: Reads a Figma frame and returns one group of Design Facts, `annotations`, what might annotate the scanned node, for design-review-scanner, which invokes it and joins its result with the other groups. To read a design, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0" # x-release-please-version
---

# Design Scanner: Annotations

Version 0.1.0 of the design review skills. <!-- x-release-please-version -->

Returns the `annotations` Design Facts group, what might annotate the scanned node: what was read or measured, never a judgement. This is one of six scanning skills, each of which reads one fact group. `design-review-scanner` invokes the ones for the groups a caller asks for and joins their results. This skill holds no thresholds and no criteria, and only reads.

Reading goes through a fixed script, tested as written, so every review reads a file the same way. You change only the input line at the top.

## Inputs

The calling skill gives you:

- **Node id:** the one node id to scan. Scripts can't see the user's selection, so the caller passes the id of the selected or named frame.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.
- **Annotation kits,** optionally: the kits whose instances count as annotations, each named by what its components' names start with, such as `A11y annotations/`.


## Steps

1. **Run the script.** Copy The annotations script section below and replace `NODE_ID` on its first line with the node id, such as `const NODE_ID = '5:3';`. In it, also put the annotation kits on its second line as quoted strings, such as `const KITS = ['A11y annotations/'];`, or leave the list empty. Run everything else exactly as written, with `evaluate_script` inside Figma Design's agent and the Figma MCP server's `use_figma` in an external agent, with the file key from the file's link. If the call errors, run it once more unchanged. If it errors again, tell the calling skill that the `annotations` group couldn't be read for this node, with the error message.
2. **Hand it back.** Return the result as the script returned it, with `"runtime"` added, and nothing else changed. The calling skill joins this group with the others for the node.

The scan is done when you have handed back the result.

## This group's facts


What might annotate the scanned node, read as it is, without deciding what any of it means.

- `native[]`: Figma's own annotations on the scanned node, the layers inside it and the frames holding it. Each has `node` (`{ id, path, type }`), `category` (its label, or null), `text` and, when it pins properties, `properties`.
- `kits[]`: instances of the annotation kits the caller named, in the scope (nested in other instances too) or on the canvas beside it. Each has `kit`, `component`, `node`, `text` (the text inside it) and `where`. With no kits named, none are looked for.
- `notes[]`: free-text notes on the canvas: text layers outside every frame, nearest to this node's frame and within 200 px of it. Each has `node`, `text` and `gap` in px.
- `excluded`: how many annotations in the review's own categories were left out. The review's categories are named `Design review: <axis>`, such as `Design review: Accessibility`.

A `text` is cut to 500 characters, or to 150 over the output limit, and its entry then has `truncated: true` and `unread` says so.

Comments aren't read. When the runtime can't read annotations, `unread` says why, and `annotations` is null.

## The annotations script

```js
const NODE_ID = 'NODE_ID';
const KITS = [];

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const NEAR = 200;
const LONG = 500;
const SHORT = 150;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['annotations'], unread: [], annotations: null };
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

const hidden = (n) => n.visible === false || ('opacity' in n && n.opacity === 0);
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
// An entry's text, cut to n characters, with `truncated: true` when it was.
const clipped = (s, n) => (s.length > n ? { text: cut(s, n), truncated: true } : { text: s });
// Layer names from the top-level frame down to a layer, or from the page's child for a layer above the frame.
const pathOf = (n) => {
  const names = [];
  for (let a = n; a && a.type !== 'PAGE'; a = a === topFrame ? null : a.parent) names.unshift(a.name);
  return names.join(' / ');
};
// The visible text inside a layer, such as a kit instance's note.
const textIn = (n) => {
  const parts = [];
  const visit = (x) => {
    if (hidden(x)) return;
    if (x.type === 'TEXT') { if (x.characters.trim()) parts.push(x.characters.trim()); }
    else if ('children' in x) x.children.forEach(visit);
  };
  visit(n);
  return parts.join(' / ');
};

let categories;
try {
  categories = new Map((await figma.annotations.getAnnotationCategoriesAsync()).map(c => [c.id, c.label]));
} catch (e) {
  out.groups = [];
  out.unread.push({ what: 'annotations', reason: `annotations can't be read here: ${String((e && e.message) || e)}` });
  return out;
}
// The review's own categories are named "Design review: <axis>", and are left out.
const reviewCategory = (label) => /^design review: /i.test(label || '');

// An instance's component, and the kit it belongs to. Only looked up when the caller names kits, since lookups are slow.
const componentOf = async (n) => {
  const main = await n.getMainComponentAsync();
  const name = main ? main.name : null;
  const set = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : null;
  const kit = KITS.find(k => [name, set].some(s => s && s.toLowerCase().startsWith(String(k).toLowerCase()))) || null;
  return { kit, label: set ? `${set} (${name})` : name };
};

const native = [], kits = [], notes = [];
let excluded = 0;
const readAnnotations = (n, path) => {
  if (!Array.isArray(n.annotations)) return;
  for (const a of n.annotations) {
    const category = a.categoryId ? categories.get(a.categoryId) || null : null;
    if (reviewCategory(category)) { excluded++; continue; }
    const entry = { node: { id: n.id, path, type: n.type }, category, ...clipped(a.labelMarkdown || a.label || '', LONG) };
    if (a.properties && a.properties.length) entry.properties = a.properties.map(p => p.type);
    native.push(entry);
  }
};
const walk = async (n, path) => {
  if (hidden(n)) return;
  readAnnotations(n, path);
  if (n.type === 'INSTANCE' && n.id !== node.id && KITS.length) {
    const c = await componentOf(n);
    if (c.kit) { kits.push({ kit: c.kit, component: c.label, node: { id: n.id, path }, ...clipped(textIn(n), LONG), where: 'in scope' }); return; }
  }
  if ('children' in n) for (const c of n.children) await walk(c, `${path} / ${c.name}`);
};
try {
  // Annotations on the frames holding the scanned node apply to it too.
  const holders = [];
  for (let a = node.parent; a && a.type !== 'PAGE'; a = a.parent) holders.unshift(a);
  for (const a of holders) readAnnotations(a, pathOf(a));
  await walk(node, pathOf(node));
} catch (e) {
  out.groups = [];
  out.unread.push({ what: 'annotations', reason: `the read failed: ${String((e && e.message) || e)}` });
  return out;
}

// Free-text notes and kit instances on the canvas: outside every frame, nearest to this node's frame, and within NEAR px of it.
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
for (const c of canvasItems) {
  const b = c.absoluteBoundingBox;
  if (!b || c.id === frameOnCanvas.id) continue;
  if (c.type === 'INSTANCE' && !KITS.length) continue;
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
  if (component) kits.push({ kit: component.kit, component: component.label, node: { id: c.id, path: c.name }, ...clipped(textIn(c), LONG), where: `on the canvas, ${Math.round(best)} px away` });
  else if (c.characters.trim()) notes.push({ node: { id: c.id }, ...clipped(c.characters.trim(), LONG), gap: Math.round(best) });
}

// Keep the output under the smaller runtime limit (about 20 kB through use_figma).
out.annotations = { native, kits, notes, excluded };
const size = () => JSON.stringify(out).length;
const located = () => [...native, ...kits].map(a => a.node);
const entries = () => [...native, ...kits, ...notes];
// `unread` says how far text was cut. Its entry is in the output before the limit is checked.
let cutNote = null;
const noteCut = (limit, why) => {
  if (!entries().some(a => a.truncated)) return;
  if (!cutNote) out.unread.push(cutNote = { what: 'annotation text', reason: '' });
  cutNote.reason = `${why}text longer than ${limit} characters was cut`;
};
noteCut(LONG, '');
if (size() > LIMIT) for (const x of located()) x.path = x.path.split(' / ').slice(-3).join(' / ');
if (size() > LIMIT) { for (const a of entries()) Object.assign(a, clipped(a.text, SHORT)); noteCut(SHORT, 'output limit: '); }
if (size() > LIMIT) {
  out.annotations = null;
  out.groups = [];
  out.unread = [{ what: 'annotations', reason: `output limit: ${native.length + kits.length + notes.length} annotations are too many for one call; scan each id in scanInstead`, scanInstead: childIds(node) }];
}
return out;
```
