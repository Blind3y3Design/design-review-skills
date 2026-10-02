// Tests the Figma Writer's Review Profile page script, run as the skill gives it, against a small fake of the Figma Plugin API.
// A last test reads what it wrote back with the Profile Finder's page script, as a later review would.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncFunction, scriptUnder } from './skill-script.mjs';

const script = scriptUnder('Writing a Review Profile page', 'design-review-figma-writer');
const finderScript = scriptUnder('The page script', 'design-review-profile');

const PROFILE = ['# Review Profile: Checkout team profile', '', 'Profile version: 0.1', '', '## Identity', '', '- Name: Checkout team profile', '- Owner: Checkout design team'];

// Sets the script's first two lines as the skill says, then runs it with top-level await and return.
const run = (figma, { text = PROFILE, before = null } = {}) => {
  const code = script
    .replace(/^const TEXT = .*$/m, `const TEXT = ${JSON.stringify(text)};`)
    .replace(/^const BEFORE = .*$/m, `const BEFORE = ${JSON.stringify(before)};`);
  return new AsyncFunction('figma', code)(figma);
};

// The fake keeps a tree of nodes, and refuses what Figma refuses: text changes in a font that isn't loaded.
function fakeFigma({ pages = ['Cases'], failOn } = {}) {
  let next = 1;
  const loaded = new Set();
  const fontKey = (f) => `${f.family}/${f.style}`;
  const needFont = (f) => { if (!loaded.has(fontKey(f))) throw new Error(`Cannot write to node with unloaded font "${f.family} ${f.style}"`); };
  const refuse = (what) => { if (failOn === what) throw new Error(`fake: ${what} refused`); };
  class Node {
    constructor(type) {
      Object.assign(this, { type, id: `9:${next++}`, name: '', x: 0, y: 0, parent: null, children: [], removed: false, visible: true });
      this.size = { width: 100, height: 100 };
    }
    get width() { return this.size.width; }
    get height() { return this.size.height; }
    resize(width, height) { this.size = { width, height }; }
    appendChild(child) {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
      child.parent = this;
      this.children.push(child);
    }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.removed = true; }
    findAllWithCriteria({ types }) { return this.children.flatMap((c) => [c, ...c.findAllWithCriteria({ types })]).filter((n) => types.includes(n.type)); }
  }
  class Page extends Node {
    constructor(name) { super('PAGE'); this.name = name; this.loaded = false; }
    async loadAsync() { this.loaded = true; }
  }
  class Text extends Node {
    constructor(characters = '', font = { family: 'Inter', style: 'Regular' }) { super('TEXT'); this._font = font; this._characters = characters; this.fontSize = 12; }
    get fontName() { return this._font; }
    set fontName(font) { needFont(font); this._font = font; }
    get characters() { return this._characters; }
    // A refused write lands half-way: the text changes, then Figma errors, once.
    set characters(value) {
      needFont(this._font);
      this._characters = value;
      if (failOn === 'characters' && !this.failed) { this.failed = true; throw new Error('fake: characters refused'); }
    }
    getRangeAllFontNames() { return [this._font]; }
    get height() { return this._characters.split('\n').length * Math.round(this.fontSize * 1.5); }
  }
  const root = new Node('DOCUMENT');
  // Each page is a name, or { name, texts: [{ characters, visible, x, y }] }.
  for (const spec of pages) {
    const { name, texts = [] } = typeof spec === 'string' ? { name: spec } : spec;
    const page = new Page(name);
    root.appendChild(page);
    for (const { characters, ...props } of texts) {
      const t = Object.assign(new Text(characters), props);
      page.appendChild(t);
    }
  }
  const figma = {
    root,
    fileKey: 'FAKEFILEKEY',
    get currentPage() { return root.children[0]; },
    createPage() { refuse('createPage'); const page = new Page('Page'); root.appendChild(page); return page; },
    createText() { refuse('createText'); const text = new Text(); figma.currentPage.appendChild(text); return text; },
    async loadFontAsync(font) { loaded.add(fontKey(font)); },
  };
  return figma;
}

const page = (figma, name) => figma.root.children.find((p) => p.name === name);
const texts = (p) => p.children.filter((c) => c.type === 'TEXT');
const TEXT = PROFILE.join('\n');

test('the script is in the Figma Writer skill, with the two lines a caller sets', () => {
  assert.ok(script, 'no js block under "## Writing a Review Profile page"');
  for (const constant of ['TEXT', 'BEFORE']) assert.match(script, new RegExp(`^const ${constant} = `, 'm'));
});

test('with no profile page, it adds a "Review Profile" page holding one text layer with the text, and touches nothing else', async () => {
  const figma = fakeFigma();
  const result = await run(figma);
  const profile = page(figma, 'Review Profile');
  assert.ok(profile, 'no "Review Profile" page');
  assert.equal(texts(profile).length, 1);
  assert.equal(texts(profile)[0].characters, TEXT);
  assert.deepEqual(result, {
    page: { id: profile.id, name: 'Review Profile', url: `https://www.figma.com/design/FAKEFILEKEY/?node-id=${profile.id.replace(':', '-')}`, created: true },
    layer: { id: texts(profile)[0].id },
  });
  assert.equal(page(figma, 'Cases').children.length, 0, 'something was left on the current page');
});

test('a page that is already there is never written over in create mode, even an empty one', async () => {
  const figma = fakeFigma({ pages: ['Cases', ' review PROFILE '] });
  const result = await run(figma);
  assert.match(result.error, /already/);
  assert.equal(figma.root.children.length, 2, 'a page was added');
  assert.equal(texts(figma.root.children[1]).length, 0);
});

test('what it writes is what the Profile Finder reads back', async () => {
  const figma = fakeFigma();
  await run(figma);
  const read = await new AsyncFunction('figma', finderScript)(figma);
  assert.equal(read.page.textLayers, 1);
  assert.equal(read.text, TEXT);
  assert.deepEqual(read.unread, []);
});

test('with the text it read, it replaces the page\'s one text layer in place', async () => {
  const figma = fakeFigma({ pages: ['Cases', { name: 'Review Profile', texts: [{ characters: TEXT }] }] });
  const layer = texts(figma.root.children[1])[0];
  const more = [...PROFILE, '', '## Accessibility', '', '- Level: AA'];
  const result = await run(figma, { text: more, before: PROFILE });
  assert.equal(figma.root.children.length, 2);
  assert.equal(texts(figma.root.children[1]).length, 1);
  assert.equal(layer.characters, more.join('\n'));
  assert.equal(result.page.created, false);
  assert.equal(result.layer.id, layer.id);
});

test('it compares the text it read ignoring blank edges, and refuses text that changed since', async () => {
  const figma = fakeFigma({ pages: ['Cases', { name: 'Review Profile', texts: [{ characters: `${TEXT}\n\n` }] }] });
  const layer = texts(figma.root.children[1])[0];
  assert.equal((await run(figma, { text: ['new'], before: PROFILE })).error, undefined);
  assert.equal(layer.characters, 'new');

  layer.characters = 'someone edited this';
  const refused = await run(figma, { text: ['newer'], before: PROFILE });
  assert.match(refused.error, /changed/);
  assert.equal(layer.characters, 'someone edited this');
});

test('it refuses a page that holds more than one visible text layer, or none, or is missing', async () => {
  const two = fakeFigma({ pages: [{ name: 'Review Profile', texts: [{ characters: TEXT }, { characters: 'A designer\'s note' }] }] });
  assert.match((await run(two, { before: PROFILE })).error, /2 text layers/);
  assert.equal(texts(two.root.children[0])[0].characters, TEXT);

  const hidden = fakeFigma({ pages: [{ name: 'Review Profile', texts: [{ characters: TEXT }, { characters: 'old draft', visible: false }] }] });
  assert.equal((await run(hidden, { text: ['x'], before: PROFILE })).error, undefined, 'a hidden layer is not read by the Profile Finder, so it does not count');

  const none = fakeFigma({ pages: [{ name: 'Review Profile' }] });
  assert.match((await run(none, { before: PROFILE })).error, /no text layer/);

  const missing = fakeFigma();
  assert.match((await run(missing, { before: PROFILE })).error, /no .*Review Profile.* page/);
  assert.equal(missing.root.children.length, 1);
});

test('when a write fails, the page it added is removed, and the text it replaced is put back', async () => {
  const created = fakeFigma({ failOn: 'createText' });
  const result = await run(created);
  assert.match(result.error, /createText refused/);
  assert.equal(created.root.children.length, 1, 'the page it added stayed');

  const figma = fakeFigma({ pages: ['Cases', { name: 'Review Profile', texts: [{ characters: TEXT }] }], failOn: 'characters' });
  const layer = texts(figma.root.children[1])[0];
  const replaced = await run(figma, { text: ['x'], before: PROFILE });
  assert.match(replaced.error, /characters refused/);
  assert.equal(layer.characters, TEXT);
});
