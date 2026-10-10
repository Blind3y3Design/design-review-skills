---
name: design-review-scanner-text
description: Reads a Figma frame and returns one group of Design Facts, `text`, each visible text layer with its content, box and style runs, for design-review-scanner, which invokes it and joins its result with the other groups. To read a design, use /design-review or a single review such as /design-review-accessibility.
metadata:
  version: "0.1.0-dev"
---

# Design Scanner: Text

Version 0.1.0-dev of the design review skills.

Returns the `text` Design Facts group, each visible text layer with its content, box and style runs: what was read or measured, never a judgement. This is one of six scanning skills, each of which reads one fact group. `design-review-scanner` invokes the ones for the groups a caller asks for and joins their results. This skill holds no thresholds and no criteria, and only reads.

Reading goes through a fixed script, tested as written, so every review reads a file the same way. You change only the input line at the top.

## Inputs

The calling skill gives you:

- **Node id:** the one node id to scan. Scripts can't see the user's selection, so the caller passes the id of the selected or named frame.
- **Runtime:** `figma-agent` inside Figma Design's agent, or `external-agent` for an agent using the Figma MCP server.

## Steps

1. **Run the script.** Copy The text script section below and replace `NODE_ID` on its first line with the node id, such as `const NODE_ID = '5:3';`. Run everything else exactly as written, with `evaluate_script` inside Figma Design's agent and the Figma MCP server's `use_figma` in an external agent, with the file key from the file's link. If the call errors, run it once more unchanged. If it errors again, tell the calling skill that the `text` group couldn't be read for this node, with the error message.
2. **Hand it back.** Return the result as the script returned it, with `"runtime"` added, and nothing else changed. The calling skill joins this group with the others for the node.

The scan is done when you have handed back the result.

## This group's facts


Each visible, non-empty text layer in the scope, in layer order.

- `textLayers`: how many there are.
- `layers[]`: each `{ id, path, x, y, width, height, content, runs[] }`, where `content` is the layer's text.
  - `runs[]`: one per run of text with its own style, each `{ fontSize, fontWeight, font, textStyle, colour }`, plus `text` when the layer has more than one run, `decoration` (`UNDERLINE` or `STRIKETHROUGH`) when it has one, and `link` (a URL, or `node:<id>` for a link to a layer) when it's a link.
  - `font` is the family and style, such as `Inter Semi Bold`. `textStyle` is `{ key, name, remote }` when a text style is applied, otherwise null. `colour` is the top visible paint's `#RRGGBB`, or null when it isn't solid. Contrast is in the colour pairs.
  - `truncated`: true when `content` was cut to fit the output limit, which `unread` then says.

## The text script

```js
const NODE_ID = 'NODE_ID';

const FACTS_VERSION = '0.5';
const LIMIT = 18000;
const out = { factsVersion: FACTS_VERSION, fileKey: figma.fileKey || null, scope: null, groups: ['text'], unread: [], text: null };
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
// Paths run from the top-level frame.
let parentPath = '';
for (let x = node !== topFrame ? node.parent : null; x; x = x === topFrame ? null : x.parent) parentPath = parentPath ? `${x.name} / ${parentPath}` : x.name;
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
