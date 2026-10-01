// Tests the Design Scanner's fact group scripts, run as the skill gives them, against a small fake of the Figma Plugin API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncFunction, scriptUnder } from './scanner-script.mjs';

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
function fakeFigma(pageSpec, { variables = {}, styles = {}, components = {}, collections = {}, libraries = [], categories = [], noAnnotations = false } = {}) {
  let next = 1;
  const lookups = { count: 0 };
  const byId = new Map();
  const build = (spec, parent) => {
    const { children = [], x = 0, y = 0, width = 100, height = 100, segments, main, ...props } = spec;
    const node = {
      id: spec.id || `1:${next++}`, name: '', visible: true, opacity: 1, blendMode: 'PASS_THROUGH', fills: [], strokes: [], strokeWeight: 0,
      x, y, width, height, absoluteBoundingBox: { x, y, width, height }, parent, reactions: [], annotations: [], ...props,
    };
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
    if (node.type === 'INSTANCE') node.getMainComponentAsync = async () => { lookups.count++; return components[main] || null; };
    if (spec.type !== 'TEXT') node.children = children.map((c) => build(c, node));
    return node;
  };
  const root = { type: 'DOCUMENT', id: '0:0', name: 'Document', parent: null };
  const page = build({ type: 'PAGE', id: '0:1', name: 'Cases', ...pageSpec }, root);
  page.loadAsync = async () => {};
  root.children = [page];
  return {
    root,
    fileKey: 'FAKEFILEKEY',
    mixed: MIXED,
    lookups,
    annotations: noAnnotations ? undefined : { async getAnnotationCategoriesAsync() { return categories; } },
    async getNodeByIdAsync(id) { return byId.get(id) || null; },
    async getStyleByIdAsync(id) { return styles[id] || null; },
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
  assert.match(tooMany.unread[0].reason, /^output limit: 400 components are too many for one call/);
  assert.equal(tooMany.unread[0].scanInstead.length, 400);
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
