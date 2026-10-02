// Tests the Figma Writer's report frame script, run as the skill gives it, against a small fake of the Figma Plugin API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncFunction, scriptUnder } from './skill-script.mjs';

const script = scriptUnder('Writing a report frame', 'design-review-figma-writer');

// Sets the script's first three lines as the skill says, then runs it with top-level await and return.
const run =(figma, { name = '2026-09-30 · A11Y-01', markdown = ['# Design review: Accessibility'], report = { schemaVersion: '0.2', findings: [], coverage: [] } } = {}) => {
  const code = script
    .replace(/^const NAME = .*$/m, `const NAME = ${JSON.stringify(name)};`)
    .replace(/^const MARKDOWN = .*$/m, `const MARKDOWN = ${JSON.stringify(markdown)};`)
    .replace(/^const REPORT = .*$/m, `const REPORT = ${JSON.stringify(report)};`);
  return new AsyncFunction('figma', code)(figma);
};

// The fake keeps a tree of nodes, and refuses what Figma refuses: text changes in a font that isn't loaded,
// and shared plugin data entries over 100 kB.
function fakeFigma({ pages = ['Cases'], failOn } = {}) {
  let next = 1;
  const loaded = new Set();
  const fontKey = (f) => `${f.family}/${f.style}`;
  const needFont = (f) => { if (!loaded.has(fontKey(f))) throw new Error(`Cannot write to node with unloaded font "${f.family} ${f.style}"`); };
  const refuse = (what) => { if (failOn === what) throw new Error(`fake: ${what} refused`); };
  class Node {
    constructor(type) {
      Object.assign(this, { type, id: `9:${next++}`, name: '', x: 0, y: 0, parent: null, children: [], data: {}, removed: false });
      this.size = { width: 100, height: 100 };
    }
    get width() { return this.size.width; }
    get height() {
      if (this.layoutMode === 'VERTICAL' && this.primaryAxisSizingMode === 'AUTO') {
        const kids = this.children.reduce((sum, c) => sum + c.height, 0) + this.itemSpacing * Math.max(0, this.children.length - 1);
        return this.paddingTop + this.paddingBottom + kids;
      }
      return this.size.height;
    }
    resize(width, height) { this.size = { width, height }; }
    appendChild(child) {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
      child.parent = this;
      this.children.push(child);
    }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.removed = true; }
    setSharedPluginData(namespace, key, value) {
      refuse('setSharedPluginData');
      if (namespace.length + key.length + Buffer.byteLength(value) > 100000) throw new Error('entry over 100 kB');
      this.data[`${namespace}/${key}`] = value;
    }
    getSharedPluginData(namespace, key) { return this.data[`${namespace}/${key}`] ?? ''; }
  }
  class Page extends Node {
    constructor(name) { super('PAGE'); this.name = name; this.loaded = false; }
    async loadAsync() { this.loaded = true; }
  }
  class Text extends Node {
    constructor() { super('TEXT'); this._font = { family: 'Inter', style: 'Regular' }; this._characters = ''; this.fontSize = 12; this.ranges = []; }
    get fontName() { return this._font; }
    set fontName(font) { needFont(font); this._font = font; }
    get characters() { return this._characters; }
    set characters(value) { needFont(this._font); this._characters = value; }
    get height() { return this._characters.split('\n').length * Math.round(this.fontSize * 1.5); }
    setRangeFontName(start, end, font) { needFont(font); this.ranges.push({ start, end, font: fontKey(font) }); }
    setRangeHyperlink(start, end, link) { this.ranges.push({ start, end, link: link.value }); }
    setRangeTextDecoration(start, end, decoration) { this.ranges.push({ start, end, decoration }); }
  }
  const root = new Node('DOCUMENT');
  // Each page is a name, or { name, frames: [{ name, x, y, width, height }] }.
  for (const spec of pages) {
    const { name, frames = [] } = typeof spec === 'string' ? { name: spec } : spec;
    const page = new Page(name);
    root.appendChild(page);
    for (const { width, height, ...props } of frames) {
      const frame = Object.assign(new Node('FRAME'), props);
      frame.resize(width, height);
      page.appendChild(frame);
    }
  }
  const figma = {
    root,
    fileKey: 'FAKEFILEKEY',
    get currentPage() { return root.children[0]; },
    createPage() { refuse('createPage'); const page = new Page('Page'); root.appendChild(page); return page; },
    createFrame() { refuse('createFrame'); const frame = new Node('FRAME'); figma.currentPage.appendChild(frame); return frame; },
    createText() { refuse('createText'); const text = new Text(); figma.currentPage.appendChild(text); return text; },
    async loadFontAsync(font) { loaded.add(fontKey(font)); },
  };
  return figma;
}

const page = (figma, name) => figma.root.children.find((p) => p.name === name);
const textsOf = (frame) => frame.children.filter((c) => c.type === 'TEXT');

test('the script is in the Figma Writer skill, with the three lines a caller sets', () => {
  assert.ok(script, 'no js block under "## Writing a report frame"');
  for (const constant of ['NAME', 'MARKDOWN', 'REPORT']) assert.match(script, new RegExp(`^const ${constant} = `, 'm'));
});

test('with no report page, it adds a "Design review" page holding one frame, named for the run, carrying the JSON', async () => {
  const figma = fakeFigma();
  const report = { schemaVersion: '0.2', findings: [{ id: 'accessibility/1.4.3/node:5:5' }], coverage: [] };
  const result = await run(figma, { report });
  const reports = page(figma, 'Design review');
  assert.ok(reports, 'no "Design review" page');
  assert.equal(reports.children.length, 1);
  const [frame] = reports.children;
  assert.equal(frame.name, '2026-09-30 · A11Y-01');
  assert.deepEqual(JSON.parse(frame.getSharedPluginData('designreview', 'report')), report);
  assert.deepEqual(result, { page: { id: reports.id, name: 'Design review', created: true }, frame: { id: frame.id, name: frame.name }, json: 'stored' });
  assert.equal(page(figma, 'Cases').children.length, 0, 'something was left on the current page');
});

test('a later run adds its frame first: above everything already on the page, and at the top of the layers panel', async () => {
  const older = { name: 'older report', x: 200, y: -40, width: 720, height: 900 };
  const note = { name: 'a note someone left', x: 1000, y: 300, width: 200, height: 100 };
  const figma = fakeFigma({ pages: ['Cases', { name: ' design Review ', frames: [older, note] }] });
  const reports = figma.root.children[1];

  const result = await run(figma, { name: '2026-10-01 · CLEAN-01' });
  assert.equal(result.page.created, false);
  assert.equal(figma.root.children.length, 2, 'a second report page was added');
  assert.equal(reports.children.length, 3);
  const newest = reports.children[2];
  assert.equal(newest.name, '2026-10-01 · CLEAN-01');
  assert.equal(newest.x, 200);
  assert.ok(newest.y + newest.height < -40, `the new frame (y ${newest.y}, height ${newest.height}) isn't above the older one`);
  assert.deepEqual(reports.children.slice(0, 2).map((f) => [f.x, f.y, f.height]), [[200, -40, 900], [1000, 300, 100]], 'an older node was moved');
});

test('the frame shows the Markdown report: a text layer per heading and paragraph, with no JSON block', async () => {
  const figma = fakeFigma();
  const markdown = [
    '# Design review: Accessibility',
    '',
    '- Scope: A11Y-01 (5:3)',
    '- Date: 2026-09-30',
    '',
    '## Accessibility',
    '',
    '### a11y/1.4.3/5:5 Body text contrast is 3.45:1',
    '- Severity: moderate. Certainty: confirmed',
    '',
    '```json',
    '{ "schemaVersion": "0.2" }',
    '```',
  ];
  await run(figma, { markdown });
  const texts = textsOf(page(figma, 'Design review').children[0]);
  assert.deepEqual(texts.slice(0, -1).map((t) => [t.characters, t.fontName.style, t.fontSize]), [
    ['Design review: Accessibility', 'Bold', 24],
    ['• Scope: A11Y-01 (5:3)\n• Date: 2026-09-30', 'Regular', 13],
    ['Accessibility', 'Bold', 18],
    ['a11y/1.4.3/5:5 Body text contrast is 3.45:1', 'Semi Bold', 15],
    ['• Severity: moderate. Certainty: confirmed', 'Regular', 13],
  ]);
  for (const t of texts) assert.ok(t.textAutoResize === 'HEIGHT' && t.width > 0, `"${t.characters}" doesn't wrap at a fixed width`);
});

test('bold, links and code in the Markdown become bold ranges, hyperlinks and plain text', async () => {
  const figma = fakeFigma();
  const url = 'https://www.figma.com/design/MavZEc8FpIpNX0bagnQQ33/?node-id=5-5';
  await run(figma, { markdown: [`**Where:** [A11Y-01 / Body](${url}), \`#8A8A8A\` on **\`#FFFFFF\`**`] });
  const [text] = textsOf(page(figma, 'Design review').children[0]);
  assert.equal(text.characters, 'Where: A11Y-01 / Body, #8A8A8A on #FFFFFF');
  const at = (s) => text.characters.indexOf(s);
  const sorted = (ranges) => [...ranges].sort((a, b) => a.start - b.start || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.deepEqual(sorted(text.ranges), sorted([
    { start: 0, end: 6, font: 'Inter/Bold' },
    { start: at('A11Y-01'), end: at(','), link: url },
    { start: at('A11Y-01'), end: at(','), decoration: 'UNDERLINE' },
    { start: at('#FFFFFF'), end: at('#FFFFFF') + 7, font: 'Inter/Bold' },
  ]));
});

test('the frame\'s last line says where its JSON is', async () => {
  const figma = fakeFigma();
  await run(figma);
  const texts = textsOf(page(figma, 'Design review').children[0]);
  assert.equal(texts[texts.length - 1].characters, 'Report JSON: in this frame\'s shared plugin data, namespace "designreview", key "report".');
});

test('a report JSON over the 100 kB limit, or none, stays out of the frame, which says the JSON stayed in the chat', async () => {
  const big = { schemaVersion: '0.2', findings: [{ evidence: 'é'.repeat(50001) }], coverage: [] };
  for (const report of [big, null]) {
    const figma = fakeFigma();
    const result = await run(figma, { report });
    const [frame] = page(figma, 'Design review').children;
    assert.equal(result.json, 'too large');
    assert.equal(frame.getSharedPluginData('designreview', 'report'), '');
    const texts = textsOf(frame);
    assert.equal(texts[texts.length - 1].characters, 'Report JSON: too large for this frame, so it stayed in the chat the review ran in.');
  }
});

test('when Figma refuses the JSON for another reason, the frame and the result give that reason', async () => {
  const figma = fakeFigma({ failOn: 'setSharedPluginData' });
  const result = await run(figma);
  const [frame] = page(figma, 'Design review').children;
  assert.deepEqual([result.json, result.jsonError], ['not stored', 'fake: setSharedPluginData refused']);
  const texts = textsOf(frame);
  assert.equal(texts[texts.length - 1].characters, 'Report JSON: not stored in this frame (fake: setSharedPluginData refused), so it stayed in the chat the review ran in.');
});

test('a write Figma refuses, such as without edit access, leaves the file as it was and returns the error', async () => {
  for (const [failOn, pages] of [['createPage', ['Cases']], ['createText', ['Cases']], ['createText', ['Cases', 'Design review']]]) {
    const figma = fakeFigma({ pages, failOn });
    const result = await run(figma);
    assert.deepEqual(result, { error: `fake: ${failOn} refused` }, failOn);
    assert.deepEqual(figma.root.children.map((p) => [p.name, p.children.length]), pages.map((name) => [name, 0]), `${failOn} left something behind`);
  }
});

test('the script as the skill gives it, with its first lines unset, changes nothing', async () => {
  const figma = fakeFigma();
  const result = await new AsyncFunction('figma', script)(figma);
  assert.match(result.error, /NAME, MARKDOWN and REPORT/);
  assert.equal(figma.root.children.length, 1);
});

test('a report JSON just under the limit is kept', async () => {
  const figma = fakeFigma();
  const report = { e: 'x'.repeat(100000 - 'designreview'.length - 'report'.length - '{"e":""}'.length) };
  const result = await run(figma, { report });
  assert.equal(result.json, 'stored');
  assert.equal(page(figma, 'Design review').children[0].getSharedPluginData('designreview', 'report'), JSON.stringify(report));
});
