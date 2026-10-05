// Tests the release script (scripts/release.mjs) through its command line, on small skill trees built in a temporary folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/release.mjs', import.meta.url));
const BASE = 'https://raw.githubusercontent.com/Blind3y3Design/design-review-skills';
const run = (root, args, env = {}) => spawnSync(process.execPath, [script, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, ...env } });

// A skill file as the repo has them. `link` is the ref in a default Reference Document link, or null for a skill with none.
const skillText = ({ name, version = '0.1.0-dev', bodyVersion = version, link = null }) => `---
name: ${name}
description: A skill.
metadata:
  version: "${version}"
---

# ${name}

Version ${bodyVersion} of the design review skills.

Steps.
${link ? `\nIts default is \`${BASE}/${link}/reference-documents/${name}.md\`, read whole.\n` : ''}`;

// A repo root holding the given skills, each as { name, ...overrides } for skillText, plus any extra files.
const makeRoot = (skills, extra = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'release-'));
  for (const s of skills) {
    mkdirSync(join(root, 'skills', s.name), { recursive: true });
    writeFileSync(join(root, 'skills', s.name, 'SKILL.md'), skillText(s));
  }
  for (const [path, text] of Object.entries(extra)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};
const read = (root, name) => readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8');

test('set puts a release version in both places and pins the default links to its tag', () => {
  const root = makeRoot([{ name: 'a', link: 'main' }, { name: 'b' }]);
  const result = run(root, ['set', '0.2.0']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, 'a'), skillText({ name: 'a', version: '0.2.0', link: 'v0.2.0' }));
  assert.equal(read(root, 'b'), skillText({ name: 'b', version: '0.2.0' }));
});

test('set with a -dev version points the default links back at main', () => {
  const root = makeRoot([{ name: 'a', version: '0.2.0', link: 'v0.2.0' }]);
  assert.equal(run(root, ['set', '0.3.0-dev']).status, 0);
  assert.equal(read(root, 'a'), skillText({ name: 'a', version: '0.3.0-dev', link: 'main' }));
});

test('set takes an alpha, beta or rc version, pins its links to the tag, and check --release accepts it', () => {
  const root = makeRoot([{ name: 'a', link: 'main' }]);
  assert.equal(run(root, ['set', '0.1.0-alpha.1']).status, 0);
  assert.equal(read(root, 'a'), skillText({ name: 'a', version: '0.1.0-alpha.1', link: 'v0.1.0-alpha.1' }));
  const result = run(root, ['check', '--release', '0.1.0-alpha.1']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('set refuses a version that is not semantic and changes nothing', () => {
  const root = makeRoot([{ name: 'a', link: 'main' }]);
  const result = run(root, ['set', 'v1']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a semantic version/);
  assert.equal(read(root, 'a'), skillText({ name: 'a', link: 'main' }));
});

test('set stops and changes nothing when a skill has no Version line in its body', () => {
  const root = makeRoot([{ name: 'a' }, { name: 'b' }]);
  writeFileSync(join(root, 'skills', 'b', 'SKILL.md'), skillText({ name: 'b' }).replace(/^Version .*\n/m, ''));
  const result = run(root, ['set', '0.2.0']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /b: no "Version … of the design review skills" line/);
  assert.equal(read(root, 'a'), skillText({ name: 'a' }));
});

test('check passes for a consistent -dev tree and for a consistent release tree', () => {
  const dev = makeRoot([{ name: 'a', link: 'main' }, { name: 'b' }]);
  assert.equal(run(dev, ['check']).status, 0);
  const released = makeRoot([{ name: 'a', version: '0.2.0', link: 'v0.2.0' }, { name: 'b', version: '0.2.0' }]);
  const result = run(released, ['check', '--release', '0.2.0']);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^PASS /);
});

test('check names a skill whose frontmatter and body versions differ', () => {
  const root = makeRoot([{ name: 'a', version: '0.2.0', bodyVersion: '0.1.0-dev' }, { name: 'b', version: '0.2.0' }]);
  const result = run(root, ['check']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^FAIL/);
  assert.match(result.stdout, /a: metadata.version is 0.2.0 but the body says 0.1.0-dev/);
});

test('check names a skill at a different version from the rest of the set', () => {
  const root = makeRoot([{ name: 'a', version: '0.2.0' }, { name: 'b', version: '0.2.1' }, { name: 'c', version: '0.2.0' }]);
  const result = run(root, ['check']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /b: version 0.2.1, but the set is at 0.2.0/);
});

test('check --release fails a -dev version, and a version other than the one named', () => {
  const dev = makeRoot([{ name: 'a' }]);
  assert.match(run(dev, ['check', '--release']).stdout, /a: 0.1.0-dev is a -dev version/);
  const other = makeRoot([{ name: 'a', version: '0.2.0' }]);
  assert.match(run(other, ['check', '--release', '0.3.0']).stdout, /a: version 0.2.0, expected 0.3.0/);
});

test('check fails a default link that is not pinned to the version, in either direction', () => {
  const released = makeRoot([{ name: 'a', version: '0.2.0', link: 'main' }]);
  assert.match(run(released, ['check']).stdout, /a: .*\/main\/.* should point at v0.2.0/);
  const dev = makeRoot([{ name: 'a', link: 'v0.1.0' }]);
  assert.match(run(dev, ['check']).stdout, /a: .*\/v0.1.0\/.* should point at main/);
});

test('check fails a skill folder that holds more than its SKILL.md, and a folder with no SKILL.md', () => {
  const root = makeRoot([{ name: 'a' }], { 'skills/a/notes.md': 'x', 'skills/empty/README.md': 'x' });
  const out = run(root, ['check']).stdout;
  assert.match(out, /a: holds notes.md besides SKILL.md/);
  assert.match(out, /empty: has no SKILL.md/);
});

test('check ignores hidden files a system leaves in a skill folder, such as .DS_Store, and still names a real extra file', () => {
  const root = makeRoot([{ name: 'a' }], { 'skills/a/.DS_Store': 'x', 'skills/a/.hidden/x': 'x' });
  assert.equal(run(root, ['check']).status, 0, run(root, ['check']).stdout);
  const withNotes = makeRoot([{ name: 'a' }], { 'skills/a/.DS_Store': 'x', 'skills/a/notes.md': 'x' });
  assert.match(run(withNotes, ['check']).stdout, /a: holds notes.md besides SKILL.md/);
});

test('a version with a leading zero is not semantic, for set and for check', () => {
  for (const version of ['01.2.3', '1.02.3', '1.2.03', '0.1.0-rc.01', '0.1.0-alpha.00']) {
    const root = makeRoot([{ name: 'a', link: 'main' }]);
    const set = run(root, ['set', version]);
    assert.equal(set.status, 2, version);
    assert.match(set.stderr, /not a semantic version/, version);
    assert.equal(run(root, ['check', version]).status, 2, version);
  }
  for (const version of ['0.0.0', '10.20.30', '0.1.0-alpha.0', '1.0.0-rc.10']) {
    assert.equal(run(makeRoot([{ name: 'a' }]), ['set', version]).status, 0, version);
  }
});

test('a default link whose ref holds a slash is read, pinned by set, and failed by check when it is the wrong one', () => {
  const root = makeRoot([{ name: 'a', link: 'release/0.1.0-alpha.2' }]);
  assert.match(run(root, ['check']).stdout, /a: .*\/release\/0.1.0-alpha.2\/.* should point at main/);
  assert.equal(run(root, ['set', '0.2.0']).status, 0);
  assert.equal(read(root, 'a'), skillText({ name: 'a', version: '0.2.0', link: 'v0.2.0' }));
  assert.equal(run(root, ['check', '--release', '0.2.0']).status, 0);
});

test('check fails a SKILL.md whose name differs from its folder', () => {
  const root = makeRoot([{ name: 'a' }]);
  writeFileSync(join(root, 'skills', 'a', 'SKILL.md'), skillText({ name: 'other' }));
  assert.match(run(root, ['check']).stdout, /a: name is "other", not the folder's/);
});

// Figma rejects a skill over 65,536 characters. `size` is the SKILL.md's length in characters, padded with a three-byte character
// so that a count of bytes would disagree with it.
const LIMIT = 65536;
const sized = (name, size) => {
  const base = skillText({ name });
  return base + '…'.repeat(size - base.length);
};

test('check passes a SKILL.md of exactly 65,536 characters, even when it is over that in bytes', () => {
  const root = makeRoot([{ name: 'a' }]);
  writeFileSync(join(root, 'skills', 'a', 'SKILL.md'), sized('a', LIMIT));
  assert.ok(Buffer.byteLength(read(root, 'a')) > LIMIT);
  const result = run(root, ['check']);
  assert.equal(result.status, 0, result.stdout);
});

test('check fails a SKILL.md one character over the limit, naming the skill and its size, and still checks the others', () => {
  const root = makeRoot([{ name: 'a' }, { name: 'big' }, { name: 'c', version: '0.2.0' }]);
  writeFileSync(join(root, 'skills', 'big', 'SKILL.md'), sized('big', LIMIT + 1));
  const result = run(root, ['check']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /big: 65,537 characters, over the 65,536 Figma allows in a skill/);
  assert.match(result.stdout, /c: version 0.2.0/);
  assert.doesNotMatch(result.stdout, /a: .*characters/);
});

test('this repo\'s own skills pass check, each within the size limit', () => {
  const repo = fileURLToPath(new URL('../..', import.meta.url));
  const result = run(repo, ['check']);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^PASS \d+ skills at /);
});

// A stand-in for `npx skills`, which installs the skills named in STUB_INSTALLS into .agents/skills of the current folder.
const stubCli = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'stub-')), 'skills-stub.sh');
  writeFileSync(path, '#!/bin/sh\nfor n in $STUB_INSTALLS; do mkdir -p ".agents/skills/$n" && echo x > ".agents/skills/$n/SKILL.md"; done\n');
  chmodSync(path, 0o755);
  return path;
};

test('install-check passes when the scratch project gets exactly the repo\'s skills', () => {
  const root = makeRoot([{ name: 'a' }, { name: 'b' }]);
  const result = run(root, ['install-check', 'some/source'], { SKILLS_CLI: stubCli(), STUB_INSTALLS: 'a b' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^PASS install-check: 2 skills/);
});

test('install-check fails on an extra skill, such as a vendored development skill, and on a missing one', () => {
  const root = makeRoot([{ name: 'a' }, { name: 'b' }]);
  const result = run(root, ['install-check', 'some/source'], { SKILLS_CLI: stubCli(), STUB_INSTALLS: 'a tdd' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /installed but not in skills\/: tdd/);
  assert.match(result.stdout, /in skills\/ but not installed: b/);
});

test('install-check says what to give it when it is not given a source', () => {
  const result = run(makeRoot([{ name: 'a' }]), ['install-check']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});

test('check fails, without crashing, on a root with no skills or no versions', () => {
  const result = run(makeRoot([]), ['check']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^FAIL/);
  assert.match(result.stdout, /no skills found/);
  assert.equal(result.stderr, '');
});

test('a --root without a folder prints the usage', () => {
  const result = spawnSync(process.execPath, [script, 'check', '--root'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});

test('set and check read a SKILL.md saved with Windows line endings', () => {
  const root = makeRoot([{ name: 'a', link: 'main' }]);
  const file = join(root, 'skills', 'a', 'SKILL.md');
  writeFileSync(file, skillText({ name: 'a', link: 'main' }).replace(/\n/g, '\r\n'));
  assert.equal(run(root, ['check']).status, 0);
  assert.equal(run(root, ['set', '0.2.0']).status, 0);
  assert.equal(read(root, 'a'), skillText({ name: 'a', version: '0.2.0', link: 'v0.2.0' }).replace(/\n/g, '\r\n'));
});

test('set stops and changes nothing when a skill folder has no SKILL.md', () => {
  const root = makeRoot([{ name: 'a' }], { 'skills/empty/README.md': 'x' });
  const result = run(root, ['set', '0.2.0']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /empty: has no SKILL.md/);
  assert.equal(read(root, 'a'), skillText({ name: 'a' }));
});

test('install-check passes a source with a space or a dollar sign to the CLI as it was given', () => {
  const root = makeRoot([{ name: 'a' }]);
  const log = join(mkdtempSync(join(tmpdir(), 'args-')), 'args.txt');
  const cli = join(mkdtempSync(join(tmpdir(), 'stub-')), 'cli.sh');
  writeFileSync(cli, `#!/bin/sh\nprintf '%s\\n' "$2" > "${log}"\nmkdir -p .agents/skills/a\n`);
  chmodSync(cli, 0o755);
  assert.equal(run(root, ['install-check', 'my dir/$HOME'], { SKILLS_CLI: cli }).status, 0);
  assert.equal(readFileSync(log, 'utf8').trim(), 'my dir/$HOME');
});

// `npx skills add` skips a skill whose frontmatter isn't valid YAML. An unquoted description with ": " is a nested mapping.
test('check fails a description that is not valid YAML, and passes the same text quoted', () => {
  const bad = makeRoot([{ name: 'a' }, { name: 'b' }]);
  const file = join(bad, 'skills', 'b', 'SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('description: A skill.', 'description: Writes the file: frames and notes.'));
  const result = run(bad, ['check']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /b: the description has ": " or " #" in an unquoted value/);
  assert.doesNotMatch(result.stdout, /a: the description/);
  writeFileSync(file, readFileSync(file, 'utf8').replace('description: Writes the file: frames and notes.', 'description: "Writes the file: frames and notes."'));
  assert.equal(run(bad, ['check']).status, 0);
});
