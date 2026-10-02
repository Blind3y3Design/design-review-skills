// Tests the Design Scanner's fact group scripts, run as the skill gives them, against a small fake of the Figma Plugin API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AsyncFunction, scriptUnder } from './skill-script.mjs';

// Sets NODE_ID on the script's first line, and the annotation kits on KITS's line when it has one, as the skill says, then runs it.
const scan = (heading, figma, id, kits = []) => {
  const script = scriptUnder(heading);
  assert.ok(script, `no js block under "## ${heading}"`);
  const set = script.replace(/^const NODE_ID = .*$/m, `const NODE_ID = ${JSON.stringify(id)};`).replace(/^const KITS = .*$/m, `const KITS = ${JSON.stringify(kits)};`);
  return new AsyncFunction('figma', set)(figma);
};

// A read-only fake of a file. Each node is a spec: { type, name, x, y, width, height, children, ...props },
// with x and y on the canvas. A text node's `segments` lists its styled runs; without them it has one run.
const MIXED = Symbol('mixed');
const SEGMENT_FIELDS = ['fontSize', 'fontWeight', 'fontName', 'textStyleId', 'fills', 'fillStyleId', 'textDecoration', 'hyperlink'];
const white = { r: 1, g: 1, b: 1 };
const solid = (color, props = {}) => ({ type: 'SOLID', color, visible: true, opacity: 1, blendMode: 'NORMAL', ...props });
const rgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });

// `collections` are the file's variable collections by id, and `libraries` what figma.teamLibrary lists, or an Error it throws.
// `mains` are main components, built like the page's nodes but kept off the page, as a file keeps a library's components.
// An instance's `main` names a main component's id, or a key of `components`. Each read of a built node's `key` is counted.
function fakeFigma(pageSpec, { variables = {}, styles = {}, components = {}, mains = [], collections = {}, libraries = [], categories = [], noAnnotations = false } = {}) {
  let next = 1;
  const lookups = { count: 0, keyReads: {}, imports: 0 };
  const byId = new Map(), byKey = new Map();
  for (const [name, c] of Object.entries(components)) if (!('id' in c)) c.id = `main:${name}`;
  const build = (spec, parent) => {
    const { children = [], x = 0, y = 0, width = 100, height = 100, segments, main, key, ...props } = spec;
    const node = {
      id: spec.id || `1:${next++}`, name: '', visible: true, opacity: 1, blendMode: 'PASS_THROUGH', fills: [], strokes: [], strokeWeight: 0,
      x, y, width, height, absoluteBoundingBox: { x, y, width, height }, parent, reactions: [], annotations: [],
      ...(spec.type === 'INSTANCE' ? { overrides: [] } : {}), ...props,
    };
    if (key !== undefined) {
      Object.defineProperty(node, 'key', { enumerable: true, get() { lookups.keyReads[node.id] = (lookups.keyReads[node.id] || 0) + 1; return key; } });
      byKey.set(key, node);
    }
    byId.set(node.id, node);
    if (node.type === 'TEXT') {
      const runs = segments || [{ characters: node.characters }];
      const run = (s) => ({ fontSize: 16, fontWeight: 400, fontName: { family: 'Inter', style: 'Regular' }, textStyleId: '', fills: node.fills, fillStyleId: '', textDecoration: 'NONE', hyperlink: null, ...props, ...s });
      node.characters = runs.map((s) => s.characters).join('');
      for (const field of SEGMENT_FIELDS) {
        const values = runs.map((s) => run(s)[field]);
        node[field] = values.every((v) => JSON.stringify(v) === JSON.stringify(values[0])) ? values[0] : MIXED;
      }
      node.getStyledTextSegments = (fields) => {
        let start = 0;
        return runs.map((s) => {
          const r = run(s);
          const out = { characters: s.characters, start, end: start + s.characters.length };
          start = out.end;
          for (const f of fields) out[f] = r[f];
          return out;
        });
      };
    }
    if (node.type === 'INSTANCE') node.getMainComponentAsync = async () => { lookups.count++; return byId.get(main) || components[main] || null; };
    if (spec.type !== 'TEXT') {
      const all = children.map((c) => build(c, node));
      // As in Figma, with figma.skipInvisibleInstanceChildren on, an instance's hidden layers aren't there.
      Object.defineProperty(node, 'children', { enumerable: true, get: () => (fake.skipInvisibleInstanceChildren && inInstance(node) ? all.filter((c) => c.visible !== false) : all) });
    }
    return node;
  };
  const inInstance = (n) => { for (let x = n; x; x = x.parent) if (x.type === 'INSTANCE') return true; return false; };
  const reachable = (n) => !fake.skipInvisibleInstanceChildren || !n.parent || !inInstance(n.parent) || n.visible !== false && reachable(n.parent);
  const root = { type: 'DOCUMENT', id: '0:0', name: 'Document', parent: null };
  const library = { type: 'PAGE', id: '0:99', name: 'Library components', parent: null };
  library.children = mains.map((spec) => build(spec, library));
  const page = build({ type: 'PAGE', id: '0:1', name: 'Cases', ...pageSpec }, root);
  page.loadAsync = async () => {};
  root.children = [page];
  const fake = {
    skipInvisibleInstanceChildren: true,
    root,
    fileKey: 'FAKEFILEKEY',
    mixed: MIXED,
    lookups,
    annotations: noAnnotations ? undefined : { async getAnnotationCategoriesAsync() { return categories; } },
    async getNodeByIdAsync(id) { const n = byId.get(id); return n && reachable(n) ? n : null; },
    async getStyleByIdAsync(id) { return styles[id] || null; },
    async importComponentByKeyAsync(key) {
      lookups.imports++;
      const found = byKey.get(key);
      if (!found || found.type !== 'COMPONENT') throw new Error(`no published component with the key ${key}`);
      return found;
    },
    variables: {
      async getVariableByIdAsync(id) { return variables[id] || null; },
      async getVariableCollectionByIdAsync(id) { return collections[id] || null; },
    },
    teamLibrary: {
      async getAvailableLibraryVariableCollectionsAsync() {
        if (libraries instanceof Error) throw libraries;
        return libraries;
      },
    },
  };
  return fake;
}

// A top-level frame at (100, 200) on the page, holding the given layers.
const frameWith = (children, props = {}) => ({ children: [{ type: 'FRAME', id: '5:1', name: 'A11Y-99', x: 100, y: 200, width: 360, height: 240, fills: [solid(white)], children, ...props }] });

test('text: each text layer gives its content, its box in the top-level frame, and its font, size, weight, style and colour', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:2', name: 'Title', x: 124, y: 224, width: 312, height: 29, characters: 'Order summary', fontSize: 24, fontWeight: 700, fontName: { family: 'Inter', style: 'Bold' }, textStyleId: 'S:heading', fills: [solid(rgb('#1A1A1A'))] },
  ]), { styles: { 'S:heading': { key: 'k-heading', name: 'Test Foundation/Heading', remote: true } } });
  const result = await scan('The text script', figma, '5:1');
  assert.deepEqual(result.groups, ['text']);
  assert.deepEqual(result.unread, []);
  assert.deepEqual(result.scope, { id: '5:1', name: 'A11Y-99', type: 'FRAME', page: 'Cases', topLevelFrame: null });
  assert.deepEqual(result.text, {
    textLayers: 1,
    layers: [{
      id: '5:2', path: 'A11Y-99 / Title', x: 24, y: 24, width: 312, height: 29, content: 'Order summary',
      runs: [{ fontSize: 24, fontWeight: 700, font: 'Inter Bold', textStyle: { key: 'k-heading', name: 'Test Foundation/Heading', remote: true }, colour: '#1A1A1A' }],
    }],
  });
});

test('text: a layer with several styles gives one run per style, each with its text, and any underline or link', async () => {
  const body = { fills: [solid(rgb('#333333'))] };
  const link = { fills: [solid(rgb('#1F4E8C'))], textDecoration: 'UNDERLINE', hyperlink: { type: 'URL', value: 'https://example.com/returns' } };
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:3', name: 'Returns', x: 124, y: 300, width: 312, height: 40, fontSize: 14, segments: [
      { characters: 'Read our ', ...body }, { characters: 'returns policy', ...link }, { characters: ' before you order.', ...body },
    ] },
  ]));
  const { text } = await scan('The text script', figma, '5:1');
  assert.equal(text.layers[0].content, 'Read our returns policy before you order.');
  const plain = { fontSize: 14, fontWeight: 400, font: 'Inter Regular', textStyle: null, colour: '#333333' };
  assert.deepEqual(text.layers[0].runs, [
    { text: 'Read our ', ...plain },
    { text: 'returns policy', ...plain, colour: '#1F4E8C', decoration: 'UNDERLINE', link: 'https://example.com/returns' },
    { text: ' before you order.', ...plain },
  ]);
});

test('text: scanning a layer inside a frame reads only that layer\'s text, skipping hidden, see-through and empty layers', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:2', name: 'Outside', x: 124, y: 224, characters: 'Not in scope' },
    { type: 'FRAME', id: '5:3', name: 'Card', x: 124, y: 260, width: 312, height: 120, children: [
      { type: 'TEXT', id: '5:4', name: 'Shown', x: 140, y: 276, width: 100, height: 20, characters: 'In scope' },
      { type: 'TEXT', id: '5:5', name: 'Hidden', x: 140, y: 300, characters: 'Hidden', visible: false },
      { type: 'TEXT', id: '5:6', name: 'Clear', x: 140, y: 320, characters: 'See-through', opacity: 0 },
      { type: 'TEXT', id: '5:7', name: 'Empty', x: 140, y: 340, characters: '  ' },
      { type: 'GROUP', id: '5:8', name: 'Hidden group', visible: false, children: [{ type: 'TEXT', id: '5:9', name: 'Inside', characters: 'Hidden too' }] },
    ] },
  ]));
  const result = await scan('The text script', figma, '5:3');
  assert.deepEqual(result.scope.topLevelFrame, { id: '5:1', name: 'A11Y-99' });
  assert.deepEqual(result.text.layers.map((l) => [l.id, l.path, l.x, l.y]), [['5:4', 'A11Y-99 / Card / Shown', 40, 76]]);
  assert.equal(result.text.textLayers, 1);
});

test('text: a page is handed back as its frames to scan instead, and an unknown id says so', async () => {
  const figma = fakeFigma(frameWith([]));
  const pageResult = await scan('The text script', figma, '0:1');
  assert.deepEqual([pageResult.text, pageResult.groups, pageResult.unread[0].scanInstead], [null, [], ['5:1']]);
  const missing = await scan('The text script', figma, '9:9');
  assert.deepEqual(missing.unread, [{ what: '9:9', reason: 'no node with this id' }]);
});

// Text layers nested `depth` groups deep, each holding `length` characters.
const manyTexts = (count, length, depth = 1) => frameWith(Array.from({ length: count }, (_, i) => {
  let layer = { type: 'TEXT', id: `6:${i}`, name: `Paragraph ${i}`, x: 124, y: 224 + i * 20, characters: 'x'.repeat(length) };
  for (let d = 0; d < depth; d++) layer = { type: 'GROUP', id: `7:${i}:${d}`, name: `Wrapper ${d}`, children: [layer] };
  return layer;
}));

test('text: over the output limit, long text is cut to 200 characters and marked, and the result says so', async () => {
  const result = await scan('The text script', fakeFigma(manyTexts(40, 600)), '5:1');
  assert.equal(result.text.textLayers, 40);
  for (const layer of result.text.layers) {
    assert.equal(layer.content, `${'x'.repeat(200)}…`);
    assert.equal(layer.truncated, true);
  }
  assert.deepEqual(result.unread, [{ what: 'text content', reason: 'output limit: text longer than 200 characters was cut' }]);
  assert.ok(JSON.stringify(result).length <= 18000);
});

test('text: when even cut text is over the output limit, the frame\'s children are handed back to scan instead', async () => {
  const result = await scan('The text script', fakeFigma(manyTexts(150, 150, 4)), '5:1');
  assert.equal(result.text, null);
  assert.deepEqual(result.groups, []);
  assert.equal(result.unread.length, 1);
  assert.match(result.unread[0].reason, /^output limit: 150 text layers are too many for one call/);
  assert.equal(result.unread[0].scanInstead.length, 150);
});

test('structure: gives the top-level frame\'s name and size, and each layer below it with its type and box in the frame', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:2', name: 'Title', x: 124, y: 224, characters: 'Gallery' },
    { type: 'FRAME', id: '5:3', name: 'Toolbar', x: 124, y: 260, width: 312, height: 40, children: [
      { type: 'RECTANGLE', id: '5:4', name: 'Previous button', x: 132, y: 272, width: 16, height: 16 },
      { type: 'VECTOR', id: '5:5', name: 'Chevron', x: 134.004, y: 274, width: 12, height: 12, visible: false },
    ] },
  ]));
  const result = await scan('The structure script', figma, '5:1');
  assert.deepEqual(result.groups, ['structure']);
  assert.deepEqual(result.structure.frame, { id: '5:1', name: 'A11Y-99', width: 360, height: 240 });
  assert.deepEqual(result.structure.layers, [
    { id: '5:3', path: 'A11Y-99 / Toolbar', type: 'FRAME', x: 24, y: 60, width: 312, height: 40 },
    { id: '5:4', path: 'A11Y-99 / Toolbar / Previous button', type: 'RECTANGLE', x: 32, y: 72, width: 16, height: 16 },
  ]);
});

test('structure: a layer gives its prototype triggers and whether it shows an image, and inside an instance only nested instances are listed', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'FRAME', id: '5:2', name: 'Close', x: 110, y: 210, width: 20, height: 20, reactions: [
      { trigger: { type: 'ON_CLICK' }, actions: [] }, { trigger: { type: 'ON_HOVER' }, actions: [] }, { trigger: { type: 'ON_CLICK' }, actions: [] },
    ] },
    { type: 'RECTANGLE', id: '5:3', name: 'Photo', x: 124, y: 240, width: 312, height: 140, fills: [{ type: 'IMAGE', visible: true, opacity: 1, imageHash: 'h' }] },
    { type: 'RECTANGLE', id: '5:5', name: 'Faded photo', x: 124, y: 240, width: 312, height: 140, fills: [{ type: 'IMAGE', visible: true, opacity: 0, imageHash: 'h' }] },
    { type: 'INSTANCE', id: '5:4', name: 'Place order', x: 124, y: 390, width: 102, height: 36, children: [
      { type: 'FRAME', id: 'I5:4;1:1', name: 'Content', x: 132, y: 398, width: 86, height: 20, children: [
        { type: 'INSTANCE', id: 'I5:4;1:2', name: 'Icon', x: 132, y: 400, width: 16, height: 16, children: [
          { type: 'VECTOR', id: 'I5:4;1:3', name: 'Check', x: 134, y: 402, width: 12, height: 12 },
        ] },
        { type: 'TEXT', id: 'I5:4;1:4', name: 'Label', x: 152, y: 398, characters: 'Place order' },
      ] },
    ] },
  ]));
  const { structure } = await scan('The structure script', figma, '5:1');
  assert.deepEqual(structure.layers, [
    { id: '5:2', path: 'A11Y-99 / Close', type: 'FRAME', x: 10, y: 10, width: 20, height: 20, reactions: ['ON_CLICK', 'ON_HOVER'] },
    { id: '5:3', path: 'A11Y-99 / Photo', type: 'RECTANGLE', x: 24, y: 40, width: 312, height: 140, image: true },
    { id: '5:5', path: 'A11Y-99 / Faded photo', type: 'RECTANGLE', x: 24, y: 40, width: 312, height: 140 },
    { id: '5:4', path: 'A11Y-99 / Place order', type: 'INSTANCE', x: 24, y: 190, width: 102, height: 36 },
    { id: 'I5:4;1:2', path: 'A11Y-99 / Place order / Content / Icon', type: 'INSTANCE', x: 32, y: 200, width: 16, height: 16 },
  ]);
});

// Known contrast ratios, from WebAIM's contrast checker: #1F4E8C and #5C5C5C on #FFFFFF.
const BLUE = '#1F4E8C', GREY = '#5C5C5C';

test('colour pairs: each non-text layer\'s fill and stroke is measured against the colour behind it, and a stroke against its own fill', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'FRAME', id: '5:2', name: 'Place order', x: 124, y: 300, width: 312, height: 48, fills: [solid(rgb(BLUE))], children: [
      { type: 'VECTOR', id: '5:3', name: 'Chevron', x: 400, y: 316, width: 16, height: 16, strokes: [solid(white)], strokeWeight: 2 },
    ] },
    { type: 'FRAME', id: '5:4', name: 'Checkbox', x: 124, y: 360, width: 24, height: 24, fills: [solid(white)], strokes: [solid(rgb(GREY))], strokeWeight: 2 },
  ]));
  const { colourPairs } = await scan('The colour pairs script', figma, '5:1');
  const frameFill = { hex: '#FFFFFF', source: { kind: 'raw' }, node: '5:1' };
  const pair = (part, id, name, hex, against, ratio, more = {}) => ({
    part, colour: { hex, source: { kind: 'raw', node: id } }, against, ratio, flags: [], reason: null, ...more, count: 1, nodes: [{ id, path: `A11Y-99 / ${name}` }],
  });
  assert.equal(colourPairs.nonTextLayers, 3);
  assert.deepEqual(colourPairs.nonText, [
    pair('fill', '5:2', 'Place order', BLUE, frameFill, 8.31),
    { ...pair('stroke', '5:3', 'Place order / Chevron', '#FFFFFF', { hex: BLUE, source: { kind: 'raw' }, node: '5:2' }, 8.31) },
    pair('fill', '5:4', 'Checkbox', '#FFFFFF', frameFill, 1),
    pair('stroke', '5:4', 'Checkbox', GREY, frameFill, 6.68, { inside: { hex: '#FFFFFF', ratio: 6.68 } }),
  ]);
});

test('colour pairs: a non-text pair is flagged for opacity or a blend mode, and a gradient isn\'t measured but is counted', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'RECTANGLE', id: '5:2', name: 'Scrim', x: 124, y: 224, width: 50, height: 50, fills: [solid(rgb(BLUE), { opacity: 0.5 })] },
    { type: 'RECTANGLE', id: '5:3', name: 'Multiply', x: 224, y: 224, width: 50, height: 50, fills: [solid(rgb(GREY))], blendMode: 'MULTIPLY' },
    { type: 'RECTANGLE', id: '5:4', name: 'Gradient', x: 324, y: 224, width: 50, height: 50, fills: [{ type: 'GRADIENT_LINEAR', visible: true, opacity: 1 }] },
    { type: 'RECTANGLE', id: '5:5', name: 'Photo', x: 124, y: 324, width: 50, height: 50, fills: [{ type: 'IMAGE', visible: true, opacity: 1 }] },
  ]));
  const result = await scan('The colour pairs script', figma, '5:1');
  assert.deepEqual(result.colourPairs.nonText.map((p) => [p.nodes[0].id, p.flags]), [['5:2', ['opacity']], ['5:3', ['blend-mode']]]);
  assert.equal(result.colourPairs.nonTextLayers, 2, 'layers with no solid paint were counted as measured');
  assert.deepEqual(result.unread, [{ what: 'gradient paints', reason: '1 gradient paints on non-text layers weren\'t measured' }]);
});

test('colour pairs: a line is measured by its rendered stroke, and a translucent stroke against its own fill as it shows there', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'LINE', id: '5:2', name: 'Divider', x: 124, y: 300, width: 312, height: 0, absoluteRenderBounds: { x: 124, y: 299.5, width: 312, height: 1 }, strokes: [solid(rgb(GREY))], strokeWeight: 1 },
    { type: 'FRAME', id: '5:3', name: 'Field', x: 124, y: 320, width: 200, height: 40, fills: [solid(rgb(BLUE))], strokes: [solid(white, { opacity: 0.5 })], strokeWeight: 1 },
  ]));
  const { colourPairs } = await scan('The colour pairs script', figma, '5:1');
  assert.deepEqual(colourPairs.nonText.map((p) => [p.nodes[0].id, p.part, p.colour.hex, p.ratio]), [
    ['5:2', 'stroke', GREY, 6.68],
    ['5:3', 'fill', BLUE, 8.31],
    ['5:3', 'stroke', '#FFFFFF', 1],
  ]);
  // Half-white over the blue fill, as the stroke shows inside the layer: #8FA7C6 on #1F4E8C, worked by hand to 3.35:1.
  assert.deepEqual(colourPairs.nonText[2].inside, { hex: BLUE, ratio: 3.35 });
});

test('colour pairs: text pairs are measured as before, beside the non-text pairs', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:2', name: 'Body', x: 124, y: 224, width: 312, height: 20, characters: 'Standard delivery', fills: [solid(rgb('#8A8A8A'))] },
  ]));
  const { colourPairs } = await scan('The colour pairs script', figma, '5:1');
  assert.equal(colourPairs.textLayers, 1);
  assert.deepEqual(colourPairs.groups.map((g) => [g.text.hex, g.background.hex, g.ratio, g.nodes[0].id]), [['#8A8A8A', '#FFFFFF', 3.45, '5:2']]);
  assert.deepEqual([colourPairs.nonTextLayers, colourPairs.nonText], [0, []]);
});

test('colour pairs: with too many raw-coloured layers for one call, the frame\'s children are handed back to scan instead', async () => {
  const swatches = Array.from({ length: 120 }, (_, i) => ({ type: 'RECTANGLE', id: `6:${i}`, name: `Swatch ${i}`, x: 124, y: 224, width: 10, height: 10, fills: [solid(rgb(GREY))] }));
  const result = await scan('The colour pairs script', fakeFigma(frameWith(swatches)), '5:1');
  assert.equal(result.colourPairs, null);
  assert.deepEqual(result.unread.map((u) => [u.what, u.reason.split(';')[0], u.scanInstead.length]), [['colourPairs', 'output limit: 0 text layers and 120 other layers are too many for one call', 120]]);
});

test('structure: names the Figma sections holding the scanned node, innermost first', async () => {
  const figma = fakeFigma({ children: [{ type: 'SECTION', id: '4:1', name: 'Focus states', x: 0, y: 0, width: 900, height: 700, children: [
    { type: 'SECTION', id: '4:2', name: 'Buttons', x: 50, y: 50, width: 800, height: 600, children: [
      { type: 'FRAME', id: '5:1', name: 'A11Y-99', x: 100, y: 200, width: 360, height: 240, fills: [solid(white)] },
    ] },
  ] }] });
  const result = await scan('The structure script', figma, '5:1');
  assert.deepEqual(result.unread, []);
  assert.deepEqual(result.structure.sections, [{ id: '4:2', name: 'Buttons' }, { id: '4:1', name: 'Focus states' }]);
  const onPage = await scan('The structure script', fakeFigma(frameWith([])), '5:1');
  assert.deepEqual([onPage.unread, onPage.structure.sections], [[], []]);
});

test('structure: a variant gives its values, and a component, an instance or a layer with a stroke or an effect gives its look', async () => {
  const shadow = { type: 'DROP_SHADOW', visible: true, color: { ...rgb(BLUE), a: 1 }, offset: { x: 0, y: 0 }, radius: 0, spread: 2 };
  const figma = fakeFigma(frameWith([
    { type: 'COMPONENT_SET', id: '5:2', name: 'Continue button', x: 124, y: 224, width: 246, height: 55, children: [
      { type: 'COMPONENT', id: '5:3', name: 'State=Default', x: 132, y: 232, width: 103, height: 39, variantProperties: { State: 'Default' }, fills: [solid(rgb(BLUE))] },
      { type: 'COMPONENT', id: '5:4', name: 'State=Focused', x: 259, y: 232, width: 103, height: 39, variantProperties: { State: 'Focused' }, fills: [solid(rgb(BLUE))], strokes: [solid(rgb(GREY))], strokeWeight: 2, strokeAlign: 'OUTSIDE' },
    ] },
    { type: 'INSTANCE', id: '5:5', name: 'Continue button', x: 124, y: 300, width: 103, height: 39, variantProperties: { State: 'Focused' }, fills: [solid(rgb(BLUE))], effects: [shadow] },
    { type: 'FRAME', id: '5:6', name: 'Card', x: 124, y: 360, width: 200, height: 40, fills: [solid(white)], strokes: [solid(rgb(GREY))], strokeWeight: 1, strokeAlign: 'INSIDE' },
    { type: 'RECTANGLE', id: '5:7', name: 'Plain', x: 124, y: 420, width: 20, height: 20, fills: [solid(white)] },
  ]));
  const { structure } = await scan('The structure script', figma, '5:1');
  const row = (id) => structure.layers.find((l) => l.id === id);
  assert.deepEqual(Object.keys(row('5:2')), ['id', 'path', 'type', 'x', 'y', 'width', 'height']);
  assert.deepEqual([row('5:3').variant, row('5:3').look], [{ State: 'Default' }, { fills: [BLUE] }]);
  assert.deepEqual([row('5:4').variant, row('5:4').look], [{ State: 'Focused' }, { fills: [BLUE], strokes: [`${GREY} 2 OUTSIDE`] }]);
  assert.deepEqual([row('5:5').variant, row('5:5').look], [{ State: 'Focused' }, { fills: [BLUE], effects: [`DROP_SHADOW ${BLUE} spread 2`] }]);
  assert.deepEqual(row('5:6').look, { fills: ['#FFFFFF'], strokes: [`${GREY} 1 INSIDE`] });
  assert.deepEqual(Object.keys(row('5:7')), ['id', 'path', 'type', 'x', 'y', 'width', 'height']);
  assert.equal(figma.lookups.count, 0, 'the structure script looked up a main component');
});

// Rectangles nested `depth` groups deep.
const manyShapes = (count, depth, props = {}) => frameWith(Array.from({ length: count }, (_, i) => {
  let layer = { type: 'RECTANGLE', id: `6:${i}`, name: `Swatch ${i}`, x: 124, y: 224, ...props };
  for (let d = 0; d < depth; d++) layer = { type: 'GROUP', id: `7:${i}:${d}`, name: `A long wrapper name ${d}`, x: 124, y: 224, children: [layer] };
  return layer;
}));

test('structure: over the output limit, paths are shortened, then left out, before the frame\'s children are handed back to scan instead', async () => {
  const depthOf = (l) => l.path.split(' / ').length;
  const few = await scan('The structure script', fakeFigma(manyShapes(5, 4)), '5:1');
  assert.equal(Math.max(...few.structure.layers.map(depthOf)), 6, 'paths were shortened with no need');
  const more = await scan('The structure script', fakeFigma(manyShapes(25, 4)), '5:1');
  assert.equal(more.structure.layers.length, 125);
  assert.equal(Math.max(...more.structure.layers.map(depthOf)), 3);
  const most = await scan('The structure script', fakeFigma(manyShapes(40, 4)), '5:1');
  assert.equal(most.structure.layers.length, 200);
  assert.ok(most.structure.layers.every((l) => !('path' in l)));
  for (const result of [more, most]) assert.ok(JSON.stringify(result).length <= 18000);
  const tooMany = await scan('The structure script', fakeFigma(manyShapes(200, 4)), '5:1');
  assert.equal(tooMany.structure, null);
  assert.deepEqual(tooMany.groups, []);
  assert.match(tooMany.unread[0].reason, /^output limit: 1000 layers are too many for one call/);
  assert.equal(tooMany.unread[0].scanInstead.length, 200);
});

// Library assets for the components and bindings scripts.
const COMPONENTS = {
  primary: { key: 'k-primary', name: 'Type=Primary', remote: true, parent: { type: 'COMPONENT_SET', key: 'k-button', name: 'Test Foundation/Button' } },
  secondary: { key: 'k-secondary', name: 'Type=Secondary', remote: true, parent: { type: 'COMPONENT_SET', key: 'k-button', name: 'Test Foundation/Button' } },
  check: { key: 'k-check', name: 'Test Foundation/Icon/Check', remote: true, parent: null },
  promo: { key: 'k-promo', name: 'Test Unlisted/Promo Tile', remote: true, parent: null },
  card: { key: 'k-card', name: 'Card', remote: false, parent: { type: 'PAGE', name: 'Components' } },
};
const buttonWithIcon = (id, name, main = 'primary') => ({ type: 'INSTANCE', id, name, main, x: 124, y: 224, children: [
  { type: 'INSTANCE', id: `I${id};1:1`, name: 'Icon', main: 'check', x: 132, y: 232 },
] });

test('components: each instance gives its main component, grouped by component, with its set, whether it\'s remote, and the instances placed and nested', async () => {
  const figma = fakeFigma(frameWith([
    buttonWithIcon('5:2', 'Place order'),
    { type: 'INSTANCE', id: '5:3', name: 'Cancel', main: 'secondary', x: 124, y: 270 },
    { type: 'FRAME', id: '5:4', name: 'Aside', x: 124, y: 320, children: [
      { type: 'INSTANCE', id: '5:5', name: 'Promo', main: 'promo', x: 124, y: 320 },
      { type: 'INSTANCE', id: '5:6', name: 'Hidden promo', main: 'promo', x: 124, y: 320, visible: false },
    ] },
    { type: 'INSTANCE', id: '5:7', name: 'Card', main: 'card', x: 124, y: 400 },
    buttonWithIcon('5:8', 'Pay now'),
  ]), { components: COMPONENTS });
  const result = await scan('The components script', figma, '5:1');
  assert.deepEqual(result.groups, ['components']);
  assert.deepEqual(result.unread, []);
  const button = { key: 'k-button', name: 'Test Foundation/Button' };
  assert.deepEqual(result.components, {
    instances: 7,
    components: [
      { key: 'k-primary', name: 'Type=Primary', set: button, remote: true, library: null, instances: 2, nested: 0, nodes: [{ id: '5:2', path: 'A11Y-99 / Place order' }, { id: '5:8', path: 'A11Y-99 / Pay now' }] },
      { key: 'k-check', name: 'Test Foundation/Icon/Check', set: null, remote: true, library: null, instances: 0, nested: 2, nodes: [
        { id: 'I5:2;1:1', path: 'A11Y-99 / Place order / Icon', inside: '5:2' }, { id: 'I5:8;1:1', path: 'A11Y-99 / Pay now / Icon', inside: '5:8' },
      ] },
      { key: 'k-secondary', name: 'Type=Secondary', set: button, remote: true, library: null, instances: 1, nested: 0, nodes: [{ id: '5:3', path: 'A11Y-99 / Cancel' }] },
      { key: 'k-promo', name: 'Test Unlisted/Promo Tile', set: null, remote: true, library: null, instances: 1, nested: 0, nodes: [{ id: '5:5', path: 'A11Y-99 / Aside / Promo' }] },
      { key: 'k-card', name: 'Card', set: null, remote: false, library: null, instances: 1, nested: 0, nodes: [{ id: '5:7', path: 'A11Y-99 / Card' }] },
    ],
    detached: [],
    overrides: [],
  });
});

test('components: a scanned layer inside an instance counts its instances as nested, and an instance whose main component can\'t be read says so', async () => {
  const figma = fakeFigma(frameWith([
    buttonWithIcon('5:2', 'Place order'),
    { type: 'INSTANCE', id: '5:3', name: 'Ghost', main: 'missing', x: 124, y: 270 },
  ]), { components: COMPONENTS });
  const inside = await scan('The components script', figma, 'I5:2;1:1');
  assert.deepEqual(inside.components.components.map((c) => [c.key, c.instances, c.nested, c.nodes[0].inside]), [['k-check', 0, 1, '5:2']]);
  const whole = await scan('The components script', figma, '5:1');
  assert.equal(whole.components.instances, 3);
  assert.deepEqual(whole.components.components.map((c) => c.key), ['k-primary', 'k-check']);
  assert.deepEqual(whole.unread, [{ what: 'main components', reason: '1 instances\' main components couldn\'t be read, such as 5:3' }]);
});

test('components: a page is handed back as its frames to scan instead, and over the output limit the frame\'s children are', async () => {
  const pageResult = await scan('The components script', fakeFigma(frameWith([])), '0:1');
  assert.deepEqual([pageResult.components, pageResult.groups, pageResult.unread[0].scanInstead], [null, [], ['5:1']]);
  // `count` components, one instance each, nested 4 groups deep.
  const many = (count) => {
    const components = {};
    const children = Array.from({ length: count }, (_, i) => {
      components[`c${i}`] = { key: `k-${'x'.repeat(36)}-${i}`, name: `Test Foundation/Component ${i}`, remote: true, parent: null };
      let layer = { type: 'INSTANCE', id: `6:${i}`, name: `Instance ${i}`, main: `c${i}` };
      for (let d = 0; d < 4; d++) layer = { type: 'GROUP', id: `7:${i}:${d}`, name: `A long wrapper name ${d}`, children: [layer] };
      return layer;
    });
    return fakeFigma(frameWith(children), { components });
  };
  const pathsOf = (result) => result.components.components.map((c) => c.nodes[0].path);
  const few = await scan('The components script', many(5), '5:1');
  assert.equal(Math.max(...pathsOf(few).map((p) => p.split(' / ').length)), 6, 'paths were shortened with no need');
  const more = await scan('The components script', many(70), '5:1');
  assert.equal(more.components.components.length, 70);
  assert.equal(Math.max(...pathsOf(more).map((p) => p.split(' / ').length)), 3);
  const most = await scan('The components script', many(85), '5:1');
  assert.equal(most.components.components.length, 85);
  assert.ok(pathsOf(most).every((p) => p === undefined));
  for (const result of [more, most]) assert.ok(JSON.stringify(result).length <= 18000);
  const tooMany = await scan('The components script', many(400), '5:1');
  assert.equal(tooMany.components, null);
  assert.deepEqual(tooMany.groups, []);
  assert.match(tooMany.unread[0].reason, /^output limit: 400 components, 0 detached frames and 0 overridden layers are too many for one call/);
  assert.equal(tooMany.unread[0].scanInstead.length, 400);
});

// Library components as a file holds them: a Button set whose icon is a nested Check, the Check and Arrow icons, and a Tag.
// The Button's main component overrides its icon's stroke, as the test library's does.
const bound = (hex, variable) => solid(rgb(hex), { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable } } });
const alias = (id) => ({ type: 'VARIABLE_ALIAS', id });
const corners = (radius, variable) => ({
  topLeftRadius: radius, topRightRadius: radius, bottomRightRadius: radius, bottomLeftRadius: radius,
  boundVariables: { fills: [alias('V:primary')], topLeftRadius: alias(variable), topRightRadius: alias(variable), bottomRightRadius: alias(variable), bottomLeftRadius: alias(variable) },
});
// The Button's root as its main component has it, which an instance has too until it's changed.
const BUTTON_ROOT = { width: 102, height: 36, fills: [bound('#0B5FFF', 'V:primary')], ...corners(4, 'V:sm') };
const libraryMains = () => [
  { type: 'COMPONENT_SET', id: 'c:button', name: 'Test Foundation/Button', key: 'k-button', remote: true, children: [
    { type: 'COMPONENT', id: 'c:primary', name: 'Type=Primary', key: 'k-primary', remote: true, ...BUTTON_ROOT, children: [
      { type: 'INSTANCE', id: 'c:primary-icon', name: 'icon', main: 'c:check', width: 16, height: 16, overrides: [{ id: 'I:c:primary-icon;v', overriddenFields: ['strokes'] }], children: [
        { type: 'VECTOR', id: 'I:c:primary-icon;v', name: 'Vector', strokes: [bound('#FFFFFF', 'V:on-action')], strokeWeight: 2 },
      ] },
      { type: 'TEXT', id: 'c:primary-label', name: 'label', characters: 'Button', width: 46, height: 20 },
    ] },
  ] },
  { type: 'COMPONENT', id: 'c:check', name: 'Test Foundation/Icon/Check', key: 'k-check', remote: true, width: 16, height: 16, children: [
    { type: 'VECTOR', id: 'c:check-v', name: 'Vector', strokes: [bound('#1A1A1A', 'V:icon')], strokeWeight: 2 },
  ] },
  { type: 'COMPONENT', id: 'c:arrow', name: 'Test Foundation/Icon/Arrow', key: 'k-arrow', remote: true, width: 16, height: 16, children: [
    { type: 'VECTOR', id: 'c:arrow-v', name: 'Vector', strokes: [bound('#1A1A1A', 'V:icon')], strokeWeight: 2 },
  ] },
  { type: 'COMPONENT', id: 'c:tag', name: 'Test Foundation/Tag', key: 'k-tag', remote: true, children: [
    { type: 'TEXT', id: 'c:tag-label', name: 'label', characters: 'Tag' },
  ] },
];
// A Button instance as the test file has it. `icon` is the main component its icon shows; the other options go on its root, its icon, the icon's vector and its label.
const button = (id, { icon = 'c:check', iconProps = {}, vector = {}, label = {}, ...props } = {}) => ({
  type: 'INSTANCE', id, name: 'Test Foundation/Button', main: 'c:primary', ...BUTTON_ROOT, ...props, children: [
    { type: 'INSTANCE', id: `I${id};icon`, name: 'icon', main: icon, width: 16, height: 16, componentPropertyReferences: { visible: 'Show icon#4:4', mainComponent: 'Icon#4:7' }, ...iconProps, children: [
      { type: 'VECTOR', id: `I${id};icon;v`, name: 'Vector', strokes: [bound('#FFFFFF', 'V:on-action')], strokeWeight: 2, ...vector },
    ] },
    { type: 'TEXT', id: `I${id};label`, name: 'label', characters: 'Button', componentPropertyReferences: { characters: 'Label#4:1' }, ...label },
  ],
});
const dsFrame = (children) => ({ children: [{ type: 'FRAME', id: '5:1', name: 'DS-99', x: 100, y: 200, width: 600, height: 240, fills: [solid(white)], children }] });

test('components: each main component is read once, however many instances use it', async () => {
  const figma = fakeFigma(dsFrame([button('6:1'), button('6:2'), button('6:3')]), { mains: libraryMains() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.components.map((c) => [c.key, c.set && c.set.key, c.instances, c.nested]), [['k-primary', 'k-button', 3, 0], ['k-check', null, 0, 3]]);
  assert.deepEqual(figma.lookups.keyReads, { 'c:primary': 1, 'c:button': 1, 'c:check': 1 });
});

test('components: a detached frame says it is detached, and names its source only when an instance in the scope already uses that component', async () => {
  const mains = [
    ...libraryMains(),
    { type: 'COMPONENT', id: 'c:card', name: 'Card', key: 'k-card-local', remote: false },
    { type: 'COMPONENT', id: 'c:other', name: 'Other', key: 'k-other-local', remote: false },
  ];
  const figma = fakeFigma(dsFrame([
    button('6:1'),
    { type: 'INSTANCE', id: '6:8', name: 'Card', main: 'c:card' },
    { type: 'FRAME', id: '6:2', name: 'Test Foundation/Button', detachedInfo: { type: 'library', componentKey: 'k-primary' } },
    { type: 'FRAME', id: '6:3', name: 'Card', detachedInfo: { type: 'local', componentId: 'c:card' } },
    { type: 'FRAME', id: '6:4', name: 'Tile', detachedInfo: { type: 'library', componentKey: 'k-tag' } },
    { type: 'FRAME', id: '6:5', name: 'Gone', detachedInfo: { type: 'library', componentKey: 'k-gone' } },
    { type: 'FRAME', id: '6:6', name: 'Hidden', visible: false, detachedInfo: { type: 'library', componentKey: 'k-tag' } },
    { type: 'FRAME', id: '6:7', name: 'Plain frame', detachedInfo: null },
    { type: 'FRAME', id: '6:9', name: 'Other', detachedInfo: { type: 'local', componentId: 'c:other' } },
  ]), { mains });
  const { components, unread } = await scan('The components script', figma, '5:1');
  const at = (id, name) => ({ id, path: `DS-99 / ${name}` });
  assert.deepEqual(components.detached, [
    { node: at('6:2', 'Test Foundation/Button'), source: { type: 'library', key: 'k-primary', name: 'Type=Primary', set: { key: 'k-button', name: 'Test Foundation/Button' }, remote: true, library: null } },
    { node: at('6:3', 'Card'), source: { type: 'local', id: 'c:card', key: 'k-card-local', name: 'Card', set: null, remote: false, library: null } },
    { node: at('6:4', 'Tile'), source: { type: 'library', key: 'k-tag', name: null, set: null, remote: null, library: null } },
    { node: at('6:5', 'Gone'), source: { type: 'library', key: 'k-gone', name: null, set: null, remote: null, library: null } },
    { node: at('6:9', 'Other'), source: { type: 'local', id: 'c:other', key: null, name: null, set: null, remote: null, library: null } },
  ]);
  assert.deepEqual(unread, []);
});

test('components: the scanner only reads, so a detached frame\'s source is never loaded into the file', async () => {
  const figma = fakeFigma(dsFrame([
    { type: 'FRAME', id: '6:2', name: 'Tile', detachedInfo: { type: 'library', componentKey: 'k-tag' } },
  ]), { mains: libraryMains() });
  await scan('The components script', figma, '5:1');
  assert.equal(figma.lookups.imports, 0, 'a component was imported by key');
  assert.doesNotMatch(readFileSync(new URL('../../skills/design-review-scanner/SKILL.md', import.meta.url), 'utf8'), /import\w*ByKeyAsync/);
});

// Called in a test, after the bindings tests' helpers below are defined.
const tokens = () => ({
  'V:text': colourVariable('V:text', 'k-text', 'color/text/default', 'C:ftheme', '#1A1A1A'),
  'V:md': { id: 'V:md', key: 'k-md', name: 'radius/md', resolvedType: 'FLOAT', variableCollectionId: 'C:fsize', remote: true },
  'V:sm': { id: 'V:sm', key: 'k-sm', name: 'radius/sm', resolvedType: 'FLOAT', variableCollectionId: 'C:fsize', remote: true },
  'V:on-action': colourVariable('V:on-action', 'k-on-action', 'color/icon/on-action', 'C:ftheme', '#FFFFFF'),
});
const BUTTON = { id: '6:1', name: 'Test Foundation/Button', component: 'k-primary' };
const onButton = (id = '6:1') => ({ id, path: 'DS-99 / Test Foundation/Button' });

test('components: an instance\'s direct change to a style property gives what the layer has now, such as the token swapped in or a raw value', async () => {
  const figma = fakeFigma(dsFrame([
    button('6:1', { fills: [bound('#1A1A1A', 'V:text')], overrides: [{ id: '6:1', overriddenFields: ['fills', 'name'] }] }),
    button('6:2', { fills: [solid(rgb('#1F4E8C'))], overrides: [{ id: '6:2', overriddenFields: ['fills'] }] }),
    button('6:3', { overrides: [{ id: '6:3', overriddenFields: ['name'] }] }),
  ]), { mains: libraryMains(), variables: tokens() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides, [
    { node: onButton(), instance: BUTTON, changes: [{ property: 'fill', fields: ['fills'], values: [{ value: '#1A1A1A', variable: { key: 'k-text', name: 'color/text/default' } }] }] },
    { node: onButton('6:2'), instance: { ...BUTTON, id: '6:2' }, changes: [{ property: 'fill', fields: ['fills'], values: [{ value: '#1F4E8C' }] }] },
  ]);
});

test('components: a change made through a component property names the property, and a hugging instance that a property change resized gives its size', async () => {
  const hidden = { visible: false };
  const figma = fakeFigma(dsFrame([
    // A longer label, set through the Label property, as Figma records it: only the hugging instance's new size.
    button('6:1', { width: 118, layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG', overrides: [{ id: '6:1', overriddenFields: ['height', 'name', 'width'] }] }),
    button('6:2', { label: { characters: 'Continue' }, overrides: [{ id: 'I6:2;label', overriddenFields: ['characters', 'styledTextSegments'] }] }),
    button('6:3', { iconProps: hidden, label: hidden, overrides: [{ id: 'I6:3;icon', overriddenFields: ['visible'] }, { id: 'I6:3;label', overriddenFields: ['visible'] }] }),
  ]), { mains: libraryMains() });
  const { components } = await scan('The components script', figma, '5:1');
  const on = (id, layer) => ({ id, path: `DS-99 / Test Foundation/Button / ${layer}` });
  assert.deepEqual(components.overrides.map(({ node, changes }) => [node, changes]), [
    [onButton('6:1'), [{ property: 'size', fields: ['height', 'width'], values: [{ width: 118, height: 36, component: { width: 102, height: 36 }, sizing: { horizontal: 'HUG', vertical: 'HUG' } }] }]],
    [on('I6:2;label', 'label'), [{ property: 'content', fields: ['characters', 'styledTextSegments'], through: 'Label' }]],
    [on('I6:3;icon', 'icon'), [{ property: 'visible', fields: ['visible'], through: 'Show icon' }]],
    [on('I6:3;label', 'label'), [{ property: 'visible', fields: ['visible'] }]],
  ]);
});

test('components: a swapped nested instance gives the component it shows, and a style Figma carried over from the main component in the swap says so', async () => {
  const red = { strokes: [solid(rgb('#FF0000'))] };
  const figma = fakeFigma(dsFrame([
    // The Icon property set to Arrow, as Figma records it: the Button's own stroke on its icon, carried over to Arrow's vector.
    button('6:1', { icon: 'c:arrow', overrides: [{ id: 'I6:1;icon', overriddenFields: ['name'] }, { id: 'I6:1;icon;v', overriddenFields: ['strokes'] }] }),
    button('6:2', { vector: red, overrides: [{ id: 'I6:2;icon;v', overriddenFields: ['strokes'] }] }),
    button('6:3', { icon: 'c:arrow', vector: red, overrides: [{ id: 'I6:3;icon;v', overriddenFields: ['strokes'] }] }),
  ]), { mains: libraryMains(), variables: tokens() });
  const { components } = await scan('The components script', figma, '5:1');
  const on = (id, layer) => ({ id, path: `DS-99 / Test Foundation/Button / ${layer}` });
  const swapped = { property: 'component', fields: [], through: 'Icon', values: [{ key: 'k-arrow', name: 'Test Foundation/Icon/Arrow', was: { key: 'k-check', name: 'Test Foundation/Icon/Check' } }] };
  assert.deepEqual(components.overrides.map(({ node, changes }) => [node, changes]), [
    [on('I6:1;icon', 'icon'), [swapped]],
    [on('I6:1;icon;v', 'icon / Vector'), [{ property: 'stroke', fields: ['strokes'], carried: true, values: [{ value: '#FFFFFF', variable: { key: 'k-on-action', name: 'color/icon/on-action' } }] }]],
    [on('I6:2;icon;v', 'icon / Vector'), [{ property: 'stroke', fields: ['strokes'], values: [{ value: '#FF0000' }] }]],
    [on('I6:3;icon', 'icon'), [swapped]],
    [on('I6:3;icon;v', 'icon / Vector'), [{ property: 'stroke', fields: ['strokes'], values: [{ value: '#FF0000' }] }]],
  ]);
});

test('components: an instance inside a detached frame names the frame, since its changes may have come with the component it was detached from', async () => {
  const figma = fakeFigma(dsFrame([
    { type: 'FRAME', id: '6:1', name: 'Test Foundation/Button', detachedInfo: { type: 'library', componentKey: 'k-primary' }, children: [
      { type: 'INSTANCE', id: '6:2', name: 'icon', main: 'c:check', overrides: [{ id: 'I6:2;v', overriddenFields: ['strokes'] }], children: [
        { type: 'VECTOR', id: 'I6:2;v', name: 'Vector', strokes: [bound('#FFFFFF', 'V:on-action')], strokeWeight: 2 },
      ] },
    ] },
  ]), { mains: libraryMains(), variables: tokens() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides, [{
    node: { id: 'I6:2;v', path: 'DS-99 / Test Foundation/Button / icon / Vector' }, instance: { id: '6:2', name: 'icon', component: 'k-check' }, detached: '6:1',
    changes: [{ property: 'stroke', fields: ['strokes'], values: [{ value: '#FFFFFF', variable: { key: 'k-on-action', name: 'color/icon/on-action' } }] }],
  }]);
});

test('components: a layer is matched to its counterpart in the main component when the instance hides a layer before it', async () => {
  const figma = fakeFigma(dsFrame([
    button('6:1', { iconProps: { visible: false }, label: { width: 60, height: 20 }, overrides: [{ id: 'I6:1;label', overriddenFields: ['width'] }] }),
  ]), { mains: libraryMains() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides[0].changes[0].values[0].component, { width: 46, height: 20 });
  assert.equal(figma.skipInvisibleInstanceChildren, true, 'the script left figma.skipInvisibleInstanceChildren off');
});

test('components: a change on a layer that isn\'t shown, or beside a scanned layer inside an instance, isn\'t listed, but hiding a layer is', async () => {
  const figma = fakeFigma(dsFrame([
    button('6:1', { iconProps: { visible: false }, vector: { strokes: [solid(rgb('#FF0000'))] }, overrides: [{ id: 'I6:1;icon', overriddenFields: ['visible'] }, { id: 'I6:1;icon;v', overriddenFields: ['strokes'] }] }),
    button('6:2', { fills: [solid(rgb('#1F4E8C'))], vector: { strokes: [solid(rgb('#FF0000'))] }, overrides: [{ id: '6:2', overriddenFields: ['fills'] }, { id: 'I6:2;icon;v', overriddenFields: ['strokes'] }] }),
  ]), { mains: libraryMains() });
  const whole = await scan('The components script', figma, '5:1');
  assert.deepEqual(whole.components.overrides.map(({ node, changes }) => [node.id, changes.map((c) => c.property)]), [['I6:1;icon', ['visible']], ['6:2', ['fill']], ['I6:2;icon;v', ['stroke']]]);
  const inside = await scan('The components script', figma, 'I6:2;icon');
  assert.deepEqual(inside.components.overrides.map(({ node, instance }) => [node.id, instance.id]), [['6:2', '6:2'], ['I6:2;icon;v', '6:2']]);
});

test('components: only the layer Figma carried a change to in a swap, matched by its name, counts as carried over', async () => {
  // An icon with two vectors. In the swap, the Button's change to its icon's "Vector" carries to this one's "Vector"; "Head" was set by hand.
  const mains = [...libraryMains(), { type: 'COMPONENT', id: 'c:double', name: 'Test Foundation/Icon/Double', key: 'k-double', remote: true, width: 16, height: 16, children: [
    { type: 'VECTOR', id: 'c:double-v', name: 'Vector', strokes: [bound('#1A1A1A', 'V:icon')], strokeWeight: 2 },
    { type: 'VECTOR', id: 'c:double-h', name: 'Head', strokes: [bound('#1A1A1A', 'V:icon')], strokeWeight: 2 },
  ] }];
  const onAction = [bound('#FFFFFF', 'V:on-action')];
  const figma = fakeFigma(dsFrame([{
    type: 'INSTANCE', id: '6:1', name: 'Test Foundation/Button', main: 'c:primary', ...BUTTON_ROOT,
    overrides: [{ id: 'I6:1;icon;v', overriddenFields: ['strokes'] }, { id: 'I6:1;icon;h', overriddenFields: ['strokes'] }],
    children: [
      { type: 'INSTANCE', id: 'I6:1;icon', name: 'icon', main: 'c:double', componentPropertyReferences: { mainComponent: 'Icon#4:7' }, children: [
        { type: 'VECTOR', id: 'I6:1;icon;v', name: 'Vector', strokes: onAction, strokeWeight: 2 },
        { type: 'VECTOR', id: 'I6:1;icon;h', name: 'Head', strokes: onAction, strokeWeight: 2 },
      ] },
      { type: 'TEXT', id: 'I6:1;label', name: 'label', characters: 'Button' },
    ],
  }]), { mains, variables: tokens() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides.filter((o) => o.node.id !== 'I6:1;icon').map(({ node, changes }) => [node.id, changes[0].carried || false]), [['I6:1;icon;v', true], ['I6:1;icon;h', false]]);
});

test('components: a rebound text font or text fill is a text or fill change, a blend mode is given, and bound variables that match the main component\'s are another change', async () => {
  const font = { boundVariables: { fontFamily: [alias('V:font')] } };
  const figma = fakeFigma(dsFrame([
    button('6:1', { label: font, overrides: [{ id: 'I6:1;label', overriddenFields: ['boundVariables'] }] }),
    button('6:2', { blendMode: 'MULTIPLY', overrides: [{ id: '6:2', overriddenFields: ['blendMode'] }, { id: 'I6:2;label', overriddenFields: ['boundVariables'] }] }),
  ]), { mains: libraryMains(), variables: tokens() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides.map(({ node, changes }) => [node.id, changes.map((c) => [c.property, c.values])]), [
    ['I6:1;label', [['text', [{ value: 'Inter Regular 16/auto' }]]]],
    ['6:2', [['opacity', [{ field: 'blendMode', value: 'MULTIPLY' }]]]],
    ['I6:2;label', [['other', undefined]]],
  ]);
});

test('components: a scanned layer inside a detached frame or an instance lists the frame and the changes on the layers holding it', async () => {
  const figma = fakeFigma(dsFrame([
    { type: 'FRAME', id: '6:1', name: 'Card', detachedInfo: { type: 'library', componentKey: 'k-tag' }, children: [
      { type: 'FRAME', id: '6:2', name: 'Body', children: [{ type: 'RECTANGLE', id: '6:3', name: 'Swatch' }] },
    ] },
    button('6:4', { fills: [solid(rgb('#1F4E8C'))], overrides: [{ id: '6:4', overriddenFields: ['fills'] }] }),
  ]), { mains: libraryMains() });
  const body = await scan('The components script', figma, '6:2');
  assert.deepEqual(body.components.detached.map((d) => d.node), [{ id: '6:1', path: 'DS-99 / Card' }]);
  const icon = await scan('The components script', figma, 'I6:4;icon');
  assert.deepEqual(icon.components.overrides.map(({ node, changes }) => [node.id, changes.map((c) => c.property)]), [['6:4', ['fill']]]);
});

test('components: when the script fails part way, figma.skipInvisibleInstanceChildren is set back', async () => {
  const figma = fakeFigma(dsFrame([button('6:1')]), { mains: libraryMains() });
  const instance = await figma.getNodeByIdAsync('6:1');
  Object.defineProperty(instance, 'overrides', { get() { throw new Error('overrides unavailable'); } });
  await assert.rejects(scan('The components script', figma, '5:1'), /overrides unavailable/);
  assert.equal(figma.skipInvisibleInstanceChildren, true);
});

test('components: over the output limit, the paths of overridden and detached layers are shortened, then left out, before the frame\'s children are handed back to scan instead', async () => {
  // `count` Buttons with a raw fill, each 4 groups deep, beside a detached frame.
  const many = (count) => fakeFigma(dsFrame([
    { type: 'FRAME', id: '6:0', name: 'Test Foundation/Button', detachedInfo: { type: 'library', componentKey: 'k-primary' } },
    ...Array.from({ length: count }, (_, i) => {
      let layer = button(`7:${i}`, { fills: [solid(rgb('#1F4E8C'))], overrides: [{ id: `7:${i}`, overriddenFields: ['fills'] }] });
      for (let d = 0; d < 4; d++) layer = { type: 'GROUP', id: `8:${i}:${d}`, name: `A long wrapper name ${d}`, children: [layer] };
      return layer;
    }),
  ]), { mains: libraryMains() });
  const paths = (result) => [...result.components.overrides, ...result.components.detached].map((o) => o.node.path);
  const few = await scan('The components script', many(5), '5:1');
  assert.equal(Math.max(...paths(few).map((p) => p.split(' / ').length)), 6, 'paths were shortened with no need');
  const more = await scan('The components script', many(60), '5:1');
  assert.equal(more.components.overrides.length, 60);
  assert.equal(Math.max(...paths(more).map((p) => p.split(' / ').length)), 3);
  const most = await scan('The components script', many(90), '5:1');
  assert.equal(most.components.overrides.length, 90);
  assert.ok(paths(most).every((p) => p === undefined));
  for (const result of [more, most]) assert.ok(JSON.stringify(result).length <= 18000, `${JSON.stringify(result).length} characters`);
  const tooMany = await scan('The components script', many(200), '5:1');
  assert.deepEqual([tooMany.components, tooMany.groups], [null, []]);
  assert.match(tooMany.unread[0].reason, /^output limit: 2 components, 1 detached frames and 200 overridden layers are too many for one call/);
  assert.equal(tooMany.unread[0].scanInstead.length, 201);
});

test('components: a direct change to text, effects, opacity or layout gives what the layer has now, and any other field is listed as it is', async () => {
  const STYLES = { 'S:caption': { key: 'k-caption', name: 'Test Foundation/Caption', type: 'TEXT', remote: true } };
  const TEXT = ['fontName', 'fontSize', 'letterSpacing', 'lineHeight', 'openTypeFeatures', 'styledTextSegments', 'textDecorationSkipInk', 'textStyleId'];
  const shadow = { type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0 };
  const figma = fakeFigma(dsFrame([
    button('6:1', { label: { textStyleId: 'S:caption', fontSize: 12, lineHeight: { unit: 'PIXELS', value: 16 } }, overrides: [{ id: 'I6:1;label', overriddenFields: ['textStyleId'] }] }),
    button('6:2', { label: { fontSize: 18 }, overrides: [{ id: 'I6:2;label', overriddenFields: TEXT }] }),
    button('6:3', { effects: [shadow], overrides: [{ id: '6:3', overriddenFields: ['effects'] }] }),
    button('6:4', { opacity: 0.5, primaryAxisAlignItems: 'MAX', exportSettings: [{ format: 'PNG' }], overrides: [{ id: '6:4', overriddenFields: ['exportSettings', 'opacity', 'primaryAxisAlignItems'] }] }),
  ]), { mains: libraryMains(), styles: STYLES });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides.map(({ node, changes }) => [node.id, changes]), [
    ['I6:1;label', [{ property: 'text', fields: ['textStyleId'], values: [{ value: 'Inter Regular 12/16', style: { key: 'k-caption', name: 'Test Foundation/Caption' } }] }]],
    ['I6:2;label', [{ property: 'text', fields: TEXT, values: [{ value: 'Inter Regular 18/auto' }] }]],
    ['6:3', [{ property: 'effect', fields: ['effects'], values: [{ value: 'DROP_SHADOW #00000040 0 2 4 0' }] }]],
    ['6:4', [
      { property: 'other', fields: ['exportSettings'] },
      { property: 'opacity', fields: ['opacity'], values: [{ field: 'opacity', value: 0.5 }] },
      { property: 'layout', fields: ['primaryAxisAlignItems'], values: [{ field: 'primaryAxisAlignItems', value: 'MAX' }] },
    ]],
  ]);
});

test('components: a change to the variables bound on a layer is found by comparing them with the main component\'s, and can\'t be placed when that can\'t be read', async () => {
  const figma = fakeFigma(dsFrame([
    button('6:1', { ...corners(8, 'V:md'), overrides: [{ id: '6:1', overriddenFields: ['boundVariables', 'name'] }] }),
    { type: 'INSTANCE', id: '6:2', name: 'Ghost', main: 'missing', overrides: [{ id: '6:2', overriddenFields: ['boundVariables'] }] },
  ]), { mains: libraryMains(), variables: tokens() });
  const { components } = await scan('The components script', figma, '5:1');
  assert.deepEqual(components.overrides.map(({ node, changes }) => [node.id, changes]), [
    ['6:1', [{ property: 'radius', fields: ['boundVariables'], values: [{ field: 'cornerRadius', value: 8, variable: { key: 'k-md', name: 'radius/md' } }] }]],
    ['6:2', [{ property: 'variables', fields: ['boundVariables'], uncertain: 'its bound variables changed, and its main component couldn\'t be read to say on which property' }]],
  ]);
});

// Two libraries whose collections share a name (#21): Foundation's and Product's Theme.
const COLLECTIONS = {
  'C:ftheme': { id: 'C:ftheme', key: 'k-ftheme', name: 'Theme', defaultModeId: 'm1' },
  'C:ptheme': { id: 'C:ptheme', key: 'k-ptheme', name: 'Theme', defaultModeId: 'm1' },
  'C:local': { id: 'C:local', key: 'k-local', name: 'Local tokens', defaultModeId: 'm1' },
  'C:gone': { id: 'C:gone', key: 'k-gone', name: 'Theme', defaultModeId: 'm1' },
};
const LIBRARIES = [
  { key: 'k-ftheme', name: 'Theme', libraryName: 'DRS Test Foundation' },
  { key: 'k-ptheme', name: 'Theme', libraryName: 'DRS Test Product' },
];
const colourVariable = (id, key, name, collection, hex, { remote = true } = {}) => ({
  id, key, name, resolvedType: 'COLOR', variableCollectionId: collection, remote,
  valuesByMode: { m1: { ...rgb(hex), a: 1 } }, resolveForConsumer: () => ({ value: { ...rgb(hex), a: 1 } }),
});
const VARIABLES = {
  'V:muted': colourVariable('V:muted', 'k-muted', 'color/surface/muted', 'C:ftheme', '#F2F2F2'),
  'V:accent': colourVariable('V:accent', 'k-accent', 'color/product/accent', 'C:ptheme', '#0B5FFF'),
  'V:local': colourVariable('V:local', 'k-localaccent', 'local/accent', 'C:local', '#1F8A70', { remote: false }),
  'V:gone': colourVariable('V:gone', 'k-gonevar', 'color/old', 'C:gone', '#123456'),
};
const boundTo = (id, hex) => solid(rgb(hex), { boundVariables: { color: { type: 'VARIABLE_ALIAS', id } } });
const swatch = (id, name, fills) => ({ type: 'RECTANGLE', id, name, x: 124, y: 224, width: 48, height: 48, fills });
const usesOf = (bindings) => Object.fromEntries([...bindings.variables, ...bindings.styles].map((a) => [a.key, [a.uses, a.inComponents, a.nodes.map((x) => x.id)]]));

test('bindings: each variable gives its library, found by its collection key, so two libraries\' collections with the same name are told apart', async () => {
  const figma = fakeFigma(frameWith([
    swatch('5:2', 'Foundation theme', [boundTo('V:muted', '#F2F2F2')]),
    swatch('5:3', 'Product theme', [boundTo('V:accent', '#0B5FFF')]),
    swatch('5:4', 'Local swatch', [boundTo('V:local', '#1F8A70')]),
    swatch('5:5', 'Old swatch', [boundTo('V:gone', '#123456')]),
  ]), { variables: VARIABLES, collections: COLLECTIONS, libraries: LIBRARIES });
  const { bindings, unread } = await scan('The bindings script', figma, '5:1');
  assert.deepEqual(bindings.variables.map((v) => [v.name, v.collection.name, v.library, v.remote]), [
    ['color/surface/muted', 'Theme', 'DRS Test Foundation', true],
    ['color/product/accent', 'Theme', 'DRS Test Product', true],
    ['local/accent', 'Local tokens', null, false],
    ['color/old', 'Theme', null, true],
  ]);
  assert.deepEqual(unread, [{ what: 'library names', reason: 'no library name for 1 library variables: their collections aren\'t among figma.teamLibrary\'s' }]);
});

test('bindings: when figma.teamLibrary fails, no library variable is named, and the result says why', async () => {
  const figma = fakeFigma(frameWith([swatch('5:2', 'Foundation theme', [boundTo('V:muted', '#F2F2F2')])]),
    { variables: VARIABLES, collections: COLLECTIONS, libraries: new Error('teamLibrary is not available') });
  const { bindings, unread } = await scan('The bindings script', figma, '5:1');
  assert.equal(bindings.variables[0].library, null);
  assert.deepEqual(unread.map((u) => u.reason), [
    'figma.teamLibrary failed: teamLibrary is not available',
    'no library name for 1 library variables: their collections aren\'t among figma.teamLibrary\'s',
  ]);
});

test('bindings: each variable and style counts the uses instances take unchanged from their components, and lists the layers that bind it themselves', async () => {
  const STYLES = { 'S:body': { key: 'k-body', name: 'Test Foundation/Body', type: 'TEXT', remote: true, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, lineHeight: { unit: 'PIXELS', value: 24 } } };
  const figma = fakeFigma(frameWith([
    swatch('5:2', 'Muted swatch', [boundTo('V:muted', '#F2F2F2')]),
    { type: 'TEXT', id: '5:3', name: 'Body', x: 124, y: 280, characters: 'Delivery', textStyleId: 'S:body', fills: [boundTo('V:muted', '#F2F2F2')] },
    { type: 'INSTANCE', id: '5:4', name: 'Promo', main: 'promo', x: 124, y: 320, overrides: [{ id: 'I5:4;1:2', overriddenFields: ['fills'] }], fills: [boundTo('V:muted', '#F2F2F2')], children: [
      { type: 'TEXT', id: 'I5:4;1:1', name: 'title', x: 132, y: 328, characters: 'Free returns', textStyleId: 'S:body', fills: [boundTo('V:muted', '#F2F2F2')] },
      swatch('I5:4;1:2', 'Badge', [boundTo('V:accent', '#0B5FFF')]),
    ] },
  ]), { variables: VARIABLES, collections: COLLECTIONS, libraries: LIBRARIES, styles: STYLES, components: COMPONENTS });
  const { bindings } = await scan('The bindings script', figma, '5:1');
  assert.deepEqual(usesOf(bindings), {
    'k-muted': [4, 2, ['5:2', '5:3']],
    'k-accent': [1, 0, ['I5:4;1:2']],
    'k-body': [2, 1, ['5:3']],
  });
  assert.deepEqual(bindings.styles.map((s) => [s.name, s.library]), [['Test Foundation/Body', null]]);
});

test('structure: over the output limit, looks are left out first, and paths stay whole while that\'s enough', async () => {
  const stroked = { strokes: [solid(rgb(GREY))], strokeWeight: 1, strokeAlign: 'INSIDE' };
  const fits = await scan('The structure script', fakeFigma(manyShapes(5, 4, stroked)), '5:1');
  assert.ok(fits.structure.layers.filter((l) => l.type === 'RECTANGLE').every((l) => l.look), 'looks were left out with no need');
  const tight = await scan('The structure script', fakeFigma(manyShapes(22, 4, stroked)), '5:1');
  assert.ok(tight.structure.layers.every((l) => !('look' in l)));
  assert.equal(Math.max(...tight.structure.layers.map((l) => l.path.split(' / ').length)), 6);
  assert.ok(JSON.stringify(tight).length <= 18000);
});

// A top-level frame at (100, 200), 360 x 240, beside the other given layers on the page.
const canvas = (frameChildren, others = [], frameProps = {}) => ({ children: [
  { type: 'FRAME', id: '5:1', name: 'A11Y-99', x: 100, y: 200, width: 360, height: 240, fills: [solid(white)], children: frameChildren, ...frameProps },
  ...others,
] });
const categories = [{ id: 'c:a11y', label: 'Accessibility' }, { id: 'c:review', label: 'Design review: Accessibility' }, { id: 'c:team', label: 'Design reviews' }];

test('annotations: gives the native annotations on the scanned node, its layers and the frames holding it, leaving out the review\'s own categories', async () => {
  const figma = fakeFigma(canvas([
    { type: 'FRAME', id: '5:2', name: 'Card', x: 124, y: 224, width: 312, height: 160, annotations: [{ labelMarkdown: 'Reading order: title, then price', categoryId: 'c:a11y' }], children: [
      { type: 'RECTANGLE', id: '5:3', name: 'Photo', x: 132, y: 232, width: 100, height: 60, annotations: [
        { label: 'Alt: a lake at sunrise', categoryId: 'c:a11y' },
        { labelMarkdown: 'Raise the contrast', categoryId: 'c:review' },
        { labelMarkdown: 'Checked in the design review', categoryId: 'c:team' },
        { labelMarkdown: 'Width', properties: [{ type: 'width' }] },
      ] },
    ] },
  ], [], { annotations: [{ labelMarkdown: 'Page title: Checkout', categoryId: 'c:a11y' }] }), { categories });
  const result = await scan('The annotations script', figma, '5:2');
  assert.deepEqual([result.groups, result.unread], [['annotations'], []]);
  assert.deepEqual(result.scope.topLevelFrame, { id: '5:1', name: 'A11Y-99' });
  assert.deepEqual(result.annotations, {
    native: [
      { node: { id: '5:1', path: 'A11Y-99', type: 'FRAME' }, category: 'Accessibility', text: 'Page title: Checkout' },
      { node: { id: '5:2', path: 'A11Y-99 / Card', type: 'FRAME' }, category: 'Accessibility', text: 'Reading order: title, then price' },
      { node: { id: '5:3', path: 'A11Y-99 / Card / Photo', type: 'RECTANGLE' }, category: 'Accessibility', text: 'Alt: a lake at sunrise' },
      { node: { id: '5:3', path: 'A11Y-99 / Card / Photo', type: 'RECTANGLE' }, category: 'Design reviews', text: 'Checked in the design review' },
      { node: { id: '5:3', path: 'A11Y-99 / Card / Photo', type: 'RECTANGLE' }, category: null, text: 'Width', properties: ['width'] },
    ],
    kits: [],
    notes: [],
    excluded: 1,
  });
});

test('annotations: instances of the named kits count in the scope, nested in an instance, or on the canvas beside the frame, and with no kits named nothing is looked up', async () => {
  const label = (id, characters) => ({ type: 'TEXT', id, name: 'Label', characters });
  const components = {
    alt: { name: 'Alt text', parent: { type: 'COMPONENT_SET', name: 'A11y kit/Markers' } },
    card: { name: 'Card', parent: { type: 'PAGE' } },
    sticker: { name: 'Sticker', parent: { type: 'PAGE' } },
  };
  const page = canvas([
    { type: 'INSTANCE', id: '5:2', name: 'Alt marker', main: 'alt', x: 124, y: 224, width: 80, height: 20, children: [label('5:3', 'Alt: lake photo')] },
    { type: 'INSTANCE', id: '5:4', name: 'Card', main: 'card', x: 124, y: 260, width: 200, height: 100, children: [
      { type: 'INSTANCE', id: 'I5:4;1:1', name: 'Icon note', main: 'alt', x: 132, y: 268, width: 80, height: 20, children: [label('I5:4;1:2', 'Alt: none, decorative')] },
    ] },
  ], [
    { type: 'INSTANCE', id: '6:1', name: 'Hero note', main: 'alt', x: 100, y: 460, width: 120, height: 20, children: [label('6:2', 'Alt: hero')] },
    { type: 'INSTANCE', id: '6:3', name: 'Sticker', main: 'sticker', x: 240, y: 460, width: 40, height: 40 },
  ]);
  const figma = fakeFigma(page, { components, categories });
  const { annotations } = await scan('The annotations script', figma, '5:1', ['a11y kit/']);
  assert.deepEqual(annotations.kits, [
    { kit: 'a11y kit/', component: 'A11y kit/Markers (Alt text)', node: { id: '5:2', path: 'A11Y-99 / Alt marker' }, text: 'Alt: lake photo', where: 'in scope' },
    { kit: 'a11y kit/', component: 'A11y kit/Markers (Alt text)', node: { id: 'I5:4;1:1', path: 'A11Y-99 / Card / Icon note' }, text: 'Alt: none, decorative', where: 'in scope' },
    { kit: 'a11y kit/', component: 'A11y kit/Markers (Alt text)', node: { id: '6:1', path: 'Hero note' }, text: 'Alt: hero', where: 'on the canvas, 20 px away' },
  ]);
  const plain = fakeFigma(page, { components, categories });
  const none = await scan('The annotations script', plain, '5:1');
  assert.deepEqual([none.annotations.kits, plain.lookups.count], [[], 0]);
});

test('annotations: a free-text note on the canvas counts when it\'s outside every frame, nearest to this frame and within 200 px', async () => {
  const note = (id, x, y, characters, more = {}) => ({ type: 'TEXT', id, name: characters, x, y, width: 100, height: 20, characters, ...more });
  const figma = fakeFigma(canvas([note('5:2', 124, 224, 'Inside the frame is content')], [
    { type: 'FRAME', id: '7:1', name: 'Other', x: 600, y: 200, width: 360, height: 240 },
    note('6:1', 100, 460, 'Alt text: lake'),
    note('6:2', 470, 300, 'Between, nearer this frame'),
    note('6:3', 575, 300, 'Between, nearer the other', { width: 20 }),
    note('6:4', 100, 700, 'Too far away'),
    { type: 'GROUP', id: '6:5', name: 'Notes', children: [note('6:6', 100, 480, 'In a group')] },
    note('6:7', 100, 520, 'Hidden', { visible: false }),
  ]), { categories });
  const { annotations } = await scan('The annotations script', figma, '5:1');
  assert.deepEqual(annotations.notes, [
    { node: { id: '6:1' }, text: 'Alt text: lake', gap: 20 },
    { node: { id: '6:2' }, text: 'Between, nearer this frame', gap: 10 },
    { node: { id: '6:6' }, text: 'In a group', gap: 40 },
  ]);
});

test('annotations: when the runtime can\'t read annotations, the result says so and gives none, and a page or an unknown id is handled as by the other scripts', async () => {
  const figma = fakeFigma(canvas([]), { noAnnotations: true });
  const result = await scan('The annotations script', figma, '5:1');
  assert.deepEqual([result.annotations, result.groups], [null, []]);
  assert.equal(result.unread.length, 1);
  assert.equal(result.unread[0].what, 'annotations');
  assert.match(result.unread[0].reason, /^annotations can't be read here/);
  const readable = fakeFigma(canvas([]), { categories });
  const pageResult = await scan('The annotations script', readable, '0:1');
  assert.deepEqual([pageResult.annotations, pageResult.groups, pageResult.unread[0].scanInstead], [null, [], ['5:1']]);
  const missing = await scan('The annotations script', readable, '9:9');
  assert.deepEqual(missing.unread, [{ what: '9:9', reason: 'no node with this id' }]);
});

test('annotations: over the output limit, paths are shortened and long text is cut, before the frame\'s children are handed back to scan instead', async () => {
  const annotated = (count) => canvas(Array.from({ length: count }, (_, i) => ({
    type: 'GROUP', id: `7:${i}`, name: `A long wrapper name ${i}`, children: [
      { type: 'RECTANGLE', id: `6:${i}`, name: `Photo ${i}`, x: 124, y: 224, annotations: [{ labelMarkdown: `Alt: ${'x'.repeat(400)}`, categoryId: 'c:a11y' }] },
    ],
  })));
  const fits = await scan('The annotations script', fakeFigma(annotated(60), { categories }), '5:1');
  assert.equal(fits.annotations.native.length, 60);
  assert.ok(fits.annotations.native.every((a) => a.text.length <= 151));
  assert.ok(JSON.stringify(fits).length <= 18000);
  const tooMany = await scan('The annotations script', fakeFigma(annotated(200), { categories }), '5:1');
  assert.deepEqual([tooMany.annotations, tooMany.groups], [null, []]);
  assert.match(tooMany.unread[0].reason, /^output limit: 200 annotations are too many for one call/);
  assert.equal(tooMany.unread[0].scanInstead.length, 200);
});
