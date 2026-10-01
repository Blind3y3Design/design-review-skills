// Tests the Figma Writer's layer annotations script, run as the skill gives it, against a small fake of the Figma Plugin API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncFunction, scriptUnder } from './skill-script.mjs';

const script = scriptUnder('Writing annotations', 'design-review-figma-writer');

// Sets the script's first three lines as the skill says, then runs it with top-level await and return.
const run = (figma, { scope = ['5:1'], axes = ['accessibility'], marks = [] } = {}) => {
  const code = script
    .replace(/^const SCOPE = .*$/m, `const SCOPE = ${JSON.stringify(scope)};`)
    .replace(/^const AXES = .*$/m, `const AXES = ${JSON.stringify(axes)};`)
    .replace(/^const MARKS = .*$/m, `const MARKS = ${JSON.stringify(marks)};`);
  return new AsyncFunction('figma', code)(figma);
};

// The fake refuses what Figma refused when tried live (#44): an annotation with both label and labelMarkdown, or with
// no content, and annotations on a group, a section or a page, which have no `annotations` property. Read back, an
// annotation written with labelMarkdown has its plain `label` too. Categories have no remove(), as in Figma (#21).
const HOLDS = new Set(['FRAME', 'TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET']);
function fakeFigma(pageSpec, { categories = [], refuseOn = null } = {}) {
  const byId = new Map();
  const cats = categories.map((c) => ({ isPreset: false, color: 'pink', ...c }));
  let nextCategory = 90;
  const writes = { count: 0 };
  const build = (spec, parent) => {
    const { children = [], annotations = [], ...props } = spec;
    const node = { name: '', parent, ...props };
    byId.set(node.id, node);
    if (HOLDS.has(node.type)) {
      let stored = annotations.map((a) => readBack(a));
      Object.defineProperty(node, 'annotations', {
        enumerable: true,
        get: () => stored.map((a) => ({ ...a, ...(a.properties ? { properties: a.properties.map((p) => ({ ...p })) } : {}) })),
        set: (list) => {
          if (refuseOn === node.id || refuseOn === 'all') throw new Error(`fake: annotations on ${node.id} refused`);
          list.forEach((a, i) => {
            if (a.label !== undefined && a.labelMarkdown !== undefined) throw new Error(`Only one of label or labelMarkdown should be given. at index ${i}`);
            if (!a.label && !a.labelMarkdown && !(a.properties && a.properties.length)) throw new Error('Setting an annotation with no content is invalid');
          });
          writes.count++;
          stored = list.map((a) => readBack(a));
        },
      });
    }
    if (spec.type !== 'TEXT' && spec.type !== 'RECTANGLE') {
      node.children = children.map((c) => build(c, node));
      node.findAll = (callback = () => true) => {
        const found = [];
        const visit = (n) => { for (const c of n.children || []) { if (callback(c)) found.push(c); visit(c); } };
        visit(node);
        return found;
      };
    }
    return node;
  };
  const root = { type: 'DOCUMENT', id: '0:0', name: 'Document', parent: null };
  const page = build({ type: 'PAGE', id: '0:1', name: 'Cases', ...pageSpec }, root);
  page.loaded = false;
  page.loadAsync = async () => { page.loaded = true; };
  root.children = [page];
  return {
    root,
    fileKey: 'FAKEFILEKEY',
    writes,
    categories: cats,
    async getNodeByIdAsync(id) { return byId.get(id) || null; },
    annotations: {
      async getAnnotationCategoriesAsync() { return cats.map((c) => ({ ...c })); },
      async addAnnotationCategoryAsync({ label, color }) {
        if (refuseOn === 'category') throw new Error('fake: category refused');
        const c = { id: `${nextCategory++}:0`, label, color, isPreset: false };
        cats.push(c);
        return { ...c };
      },
    },
  };
}
const readBack = (a) => {
  const out = {};
  if (a.labelMarkdown !== undefined) Object.assign(out, { label: a.labelMarkdown.replace(/\*\*|`/g, ''), labelMarkdown: a.labelMarkdown });
  else if (a.label !== undefined) Object.assign(out, { label: a.label, labelMarkdown: a.label });
  if (a.properties) out.properties = a.properties.map((p) => ({ ...p }));
  if (a.categoryId) out.categoryId = a.categoryId;
  return out;
};

// A top-level frame on the page, holding the given layers.
const frameWith = (children, props = {}) => ({ children: [{ type: 'FRAME', id: '5:1', name: 'A11Y-99', children, ...props }] });

test('the script is in the Figma Writer skill, with the three lines a caller sets', () => {
  assert.ok(script, 'no js block under "## Writing annotations"');
  for (const constant of ['SCOPE', 'AXES', 'MARKS']) assert.match(script, new RegExp(`^const ${constant} = `, 'm'));
});

test('the script as the skill gives it, with its first lines unset, changes nothing', async () => {
  const figma = fakeFigma(frameWith([{ type: 'TEXT', id: '5:2', name: 'Body' }]));
  const result = await new AsyncFunction('figma', script)(figma);
  assert.match(result.error, /SCOPE, AXES and MARKS/);
  assert.deepEqual([figma.writes.count, figma.categories.length], [0, 0]);
});

test('each mark is written on its layers in its axis\'s review category, which is added when the file has none', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:2', name: 'Body' },
    { type: 'RECTANGLE', id: '5:3', name: 'Photo' },
    { type: 'RECTANGLE', id: '5:4', name: 'Swatch' },
  ]), { categories: [{ id: '37:2', label: 'Accessibility', isPreset: true }] });
  const contrast = '**a11y/1.4.3/5:2** Body text contrast is 3.45:1';
  const raw = '**ds/raw-value/5:4** Swatch has a raw fill';
  const result = await run(figma, {
    axes: ['accessibility', 'design-system'],
    marks: [
      { axis: 'accessibility', finding: 'a11y/1.4.3/5:2', nodes: ['5:2', '5:3'], text: contrast },
      { axis: 'design-system', finding: 'ds/raw-value/5:4', nodes: ['5:4'], text: raw },
    ],
  });
  const [a11y, ds] = figma.categories.slice(1);
  assert.deepEqual([a11y.label, a11y.color, ds.label, ds.color], ['Design review: Accessibility', 'violet', 'Design review: Design system adherence', 'teal']);
  const node = (id) => figma.getNodeByIdAsync(id);
  assert.deepEqual((await node('5:2')).annotations, [{ label: 'a11y/1.4.3/5:2 Body text contrast is 3.45:1', labelMarkdown: contrast, categoryId: a11y.id }]);
  assert.deepEqual((await node('5:3')).annotations.map((a) => [a.labelMarkdown, a.categoryId]), [[contrast, a11y.id]]);
  assert.deepEqual((await node('5:4')).annotations.map((a) => [a.labelMarkdown, a.categoryId]), [[raw, ds.id]]);
  assert.deepEqual((await node('5:1')).annotations, [], 'the frame was marked');
  assert.deepEqual(result, {
    categories: [
      { axis: 'accessibility', label: 'Design review: Accessibility', id: a11y.id, created: true },
      { axis: 'design-system', label: 'Design review: Design system adherence', id: ds.id, created: true },
    ],
    cleared: 0, written: 3, marked: 2, moved: [], unmarked: [],
  });
});

test('a designer\'s own annotations on a marked layer are kept as they were, and a review category already in the file is used', async () => {
  const mine = [
    { labelMarkdown: '**Copy:** approved by content design', categoryId: '37:3' },
    { label: 'Truncate after two lines' },
    { properties: [{ type: 'width' }, { type: 'fills' }] },
  ];
  const figma = fakeFigma(frameWith([{ type: 'TEXT', id: '5:2', name: 'Body', annotations: mine }]), {
    categories: [{ id: '37:3', label: 'Content', isPreset: true }, { id: '91:0', label: 'design review: accessibility ', color: 'violet' }],
  });
  const before = (await figma.getNodeByIdAsync('5:2')).annotations;
  const result = await run(figma, { marks: [{ axis: 'accessibility', finding: 'a11y/1.4.3/5:2', nodes: ['5:2'], text: '**a11y/1.4.3/5:2** Body text contrast is 3.45:1' }] });
  const after = (await figma.getNodeByIdAsync('5:2')).annotations;
  assert.deepEqual(after.slice(0, 3), before);
  assert.deepEqual(after.slice(3).map((a) => [a.labelMarkdown, a.categoryId]), [['**a11y/1.4.3/5:2** Body text contrast is 3.45:1', '91:0']]);
  assert.equal(figma.categories.length, 2, 'a second review category was added');
  assert.deepEqual(result.categories, [{ axis: 'accessibility', label: 'Design review: Accessibility', id: '91:0', created: false }]);
});

// Review categories in a file that has been reviewed before, with a team category whose name only starts the same way.
const reviewed = [
  { id: '91:0', label: 'Design review: Accessibility' },
  { id: '92:0', label: 'Design review: Design system adherence' },
  { id: '93:0', label: 'Design reviews' },
];
const old = (text, categoryId = '91:0') => ({ labelMarkdown: text, categoryId });
const texts = async (figma, id) => (await figma.getNodeByIdAsync(id)).annotations.map((a) => a.labelMarkdown);

test('each run first clears the review\'s annotations for the axes it covered, everywhere in its scope, and leaves every other annotation', async () => {
  const figma = fakeFigma({ children: [
    { type: 'FRAME', id: '5:1', name: 'A11Y-99', annotations: [old('frame, last run')], children: [
      { type: 'TEXT', id: '5:2', name: 'Body', annotations: [old('body, last run'), { labelMarkdown: 'Checked in the team review', categoryId: '93:0' }, { label: 'Truncate after two lines' }] },
      { type: 'RECTANGLE', id: '5:3', name: 'Photo', annotations: [old('photo, last run'), old('photo, design system', '92:0')] },
      { type: 'INSTANCE', id: '5:4', name: 'Button', children: [{ type: 'TEXT', id: 'I5:4;1:1', name: 'Label', annotations: [old('label, last run')] }] },
      { type: 'RECTANGLE', id: '5:5', name: 'Hidden', visible: false, annotations: [old('hidden, last run')] },
    ] },
    { type: 'FRAME', id: '6:1', name: 'Another frame', annotations: [old('another frame, last run')] },
  ] }, { categories: reviewed });
  const result = await run(figma, { marks: [{ axis: 'accessibility', finding: 'photo', nodes: ['5:3'], text: 'photo, this run' }] });
  assert.deepEqual(await texts(figma, '5:1'), []);
  assert.deepEqual(await texts(figma, '5:2'), ['Checked in the team review', 'Truncate after two lines']);
  assert.deepEqual(await texts(figma, '5:3'), ['photo, design system', 'photo, this run']);
  assert.deepEqual(await texts(figma, 'I5:4;1:1'), []);
  assert.deepEqual(await texts(figma, '5:5'), []);
  assert.deepEqual(await texts(figma, '6:1'), ['another frame, last run']);
  assert.deepEqual([result.cleared, result.written, result.marked], [5, 1, 1]);
});

test('a run with no Findings on an axis clears that axis\'s annotations in its scope', async () => {
  const figma = fakeFigma(frameWith([{ type: 'TEXT', id: '5:2', name: 'Body', annotations: [old('body, last run'), old('body, design system', '92:0')] }]), { categories: reviewed });
  const result = await run(figma, { axes: ['accessibility'], marks: [] });
  assert.deepEqual(await texts(figma, '5:2'), ['body, design system']);
  assert.deepEqual([result.cleared, result.written, result.marked], [1, 0, 0]);
  assert.equal(figma.categories.length, 3);
});

test('a mark on a layer that can\'t hold annotations, such as a group, goes on the nearest layer holding it that can, once', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'FRAME', id: '5:6', name: 'Card', children: [
      { type: 'GROUP', id: '5:2', name: 'Price', children: [{ type: 'RECTANGLE', id: '5:3', name: 'Tag' }] },
      { type: 'GROUP', id: '5:7', name: 'Badge', children: [{ type: 'RECTANGLE', id: '5:8', name: 'Dot' }] },
    ] },
  ]));
  const result = await run(figma, { marks: [
    { axis: 'accessibility', finding: 'first', nodes: ['5:2'], text: 'first' },
    { axis: 'accessibility', finding: 'second', nodes: ['5:2', '5:7'], text: 'second' },
  ] });
  assert.deepEqual(await texts(figma, '5:6'), ['first', 'second']);
  assert.deepEqual(result.moved, [
    { finding: 'first', node: '5:2', to: '5:6' },
    { finding: 'second', node: '5:2', to: '5:6' },
    { finding: 'second', node: '5:7', to: '5:6' },
  ]);
  assert.deepEqual([result.written, result.marked], [2, 2]);
});

test('a mark on a layer outside the scope, or with nothing in the scope to hold it, isn\'t written and is handed back', async () => {
  const figma = fakeFigma({ children: [
    { type: 'FRAME', id: '5:1', name: 'A11Y-99', children: [{ type: 'TEXT', id: '5:2', name: 'Body' }] },
    { type: 'FRAME', id: '6:1', name: 'Another frame' },
    { type: 'SECTION', id: '7:1', name: 'Checkout', children: [{ type: 'FRAME', id: '7:2', name: 'Payment' }] },
  ] });
  const result = await run(figma, { scope: ['5:1', '7:1'], marks: [
    { axis: 'accessibility', finding: 'nowhere', nodes: ['6:1', '9:9', '7:1'], text: 'nowhere' },
    { axis: 'accessibility', finding: 'somewhere', nodes: ['5:2', '7:2'], text: 'somewhere' },
  ] });
  assert.deepEqual(result.unmarked, [
    { finding: 'nowhere', node: '6:1', reason: 'not a layer in the scope' },
    { finding: 'nowhere', node: '9:9', reason: 'not a layer in the scope' },
    { finding: 'nowhere', node: '7:1', reason: 'no layer in the scope can hold an annotation here' },
  ]);
  assert.deepEqual([await texts(figma, '6:1'), await texts(figma, '5:2'), await texts(figma, '7:2')], [[], ['somewhere'], ['somewhere']]);
  assert.deepEqual([result.written, result.marked, result.moved], [2, 1, []]);
});

test('a write Figma refuses, such as without edit access, leaves every layer as it was and returns the error, naming any category added', async () => {
  const layers = () => frameWith([
    { type: 'TEXT', id: '5:2', name: 'Body', annotations: [old('body, last run'), { label: 'Truncate after two lines' }] },
    { type: 'RECTANGLE', id: '5:3', name: 'Photo' },
  ]);
  const marks = [{ axis: 'accessibility', finding: 'photo', nodes: ['5:3'], text: 'photo, this run' }, { axis: 'design-system', finding: 'raw', nodes: ['5:3'], text: 'photo, raw fill' }];
  const partway = fakeFigma(layers(), { categories: reviewed.slice(0, 1), refuseOn: '5:3' });
  const result = await run(partway, { marks });
  assert.deepEqual(result, {
    error: 'fake: annotations on 5:3 refused',
    categoriesAdded: [{ axis: 'design-system', label: 'Design review: Design system adherence', id: '90:0' }],
  });
  assert.deepEqual([await texts(partway, '5:2'), await texts(partway, '5:3')], [['body, last run', 'Truncate after two lines'], []]);

  for (const refuseOn of ['all', 'category']) {
    const figma = fakeFigma(layers(), { categories: reviewed.slice(0, 1), refuseOn });
    const refused = await run(figma, { marks });
    assert.match(refused.error, /^fake: /, refuseOn);
    assert.deepEqual([await texts(figma, '5:2'), await texts(figma, '5:3')], [['body, last run', 'Truncate after two lines'], []], refuseOn);
  }
});

test('a later part of a run split across calls, with no axes to clear, keeps the earlier parts\' marks and adds none twice', async () => {
  const figma = fakeFigma(frameWith([
    { type: 'TEXT', id: '5:2', name: 'Body', annotations: [old('first part')] },
    { type: 'RECTANGLE', id: '5:3', name: 'Photo' },
  ]), { categories: reviewed });
  const result = await run(figma, { axes: [], marks: [
    { axis: 'accessibility', finding: 'body', nodes: ['5:2'], text: 'first part' },
    { axis: 'accessibility', finding: 'photo', nodes: ['5:3'], text: 'second part' },
  ] });
  assert.deepEqual([await texts(figma, '5:2'), await texts(figma, '5:3')], [['first part'], ['second part']]);
  assert.deepEqual([result.cleared, result.written, result.marked], [0, 1, 2]);
  assert.equal(figma.writes.count, 1, 'a layer that didn\'t change was written');
});

test('an axis or a mark the script doesn\'t know is refused before anything is written', async () => {
  const figma = fakeFigma(frameWith([{ type: 'TEXT', id: '5:2', name: 'Body' }]));
  for (const [input, error] of [
    [{ axes: ['contrast'] }, /unknown axis: contrast/],
    [{ marks: [{ axis: 'a11y', finding: 'x', nodes: ['5:2'], text: 'x' }] }, /unknown axis: a11y/],
    [{ marks: [{ axis: 'accessibility', finding: 'x', nodes: ['5:2'], text: ' ' }] }, /mark 0 needs a finding, nodes and a text/],
    [{ marks: [{ axis: 'accessibility', finding: 'x', node: '5:2', text: 'x' }] }, /mark 0 needs a finding, nodes and a text/],
    [{ marks: [{ axis: 'accessibility', nodes: ['5:2'], text: 'x' }] }, /mark 0 needs a finding, nodes and a text/],
    [{ scope: ['9:9'] }, /no node with id 9:9/],
  ]) assert.match((await run(figma, input)).error, error);
  assert.deepEqual([figma.writes.count, figma.categories.length], [0, 0]);
});

test('the moved and unmarked lists stop at 20 each, with their totals, so the output stays small', async () => {
  const groups = Array.from({ length: 30 }, (_, i) => ({ type: 'GROUP', id: `6:${i}`, name: `Group ${i}`, children: [{ type: 'RECTANGLE', id: `7:${i}`, name: 'Dot' }] }));
  const figma = fakeFigma(frameWith(groups));
  const result = await run(figma, { marks: [{ axis: 'accessibility', finding: 'grouped', nodes: [...groups.map((g) => g.id), ...groups.map((_, i) => `8:${i}`)], text: 'grouped' }] });
  assert.deepEqual([result.moved.length, result.movedTotal, result.unmarked.length, result.unmarkedTotal], [20, 30, 20, 30]);
  assert.deepEqual([await texts(figma, '5:1'), result.written, result.marked], [['grouped'], 1, 1]);
  assert.ok(JSON.stringify(result).length < 4000);
});

test('a category is the review\'s only when the annotations script would leave it out too: a label with leading spaces is the designer\'s', async () => {
  const figma = fakeFigma(frameWith([{ type: 'TEXT', id: '5:2', name: 'Body', annotations: [old('the designer\'s', '94:0')] }]), {
    categories: [{ id: '94:0', label: ' Design review: Accessibility' }],
  });
  const result = await run(figma, { marks: [{ axis: 'accessibility', finding: 'body', nodes: ['5:2'], text: 'this run' }] });
  assert.deepEqual(await texts(figma, '5:2'), ['the designer\'s', 'this run']);
  assert.deepEqual([result.cleared, result.categories[0].created], [0, true]);
});
