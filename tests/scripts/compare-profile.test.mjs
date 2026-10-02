// Tests the profile comparison script: it compares a saved Review Profile with a case's expected profile on its layout and its settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareProfiles } from '../smoke/compare-profile.mjs';

const script = fileURLToPath(new URL('../smoke/compare-profile.mjs', import.meta.url));
const run = (args, input) => spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });
const saved = (name, text) => {
  const path = join(mkdtempSync(join(tmpdir(), 'compare-profile-')), name);
  writeFileSync(path, text);
  return path;
};

const PROFILE = `# Review Profile: Checkout team profile

Profile version: 0.1

## Identity

What this profile is called and who maintains it.

- Name: Checkout team profile
- Owner: Checkout design team
- Last updated: 2026-10-02

## Design System Layers

The design systems this work is checked against, most general first.

- Baseline: the skill's default

### 1. Foundation

- Libraries: Foundation Tokens
- Match hints: prefix \`Foundation/\`
- Rules document: none (Design system baseline only)

## Accessibility

The accessibility standard designs are judged against.

- Standard: WCAG
- Version: 2.2
- Level: AA
- Criteria reference: the skill's default
`;

const differences = (actual, expected = PROFILE) => compareProfiles(expected, actual).differences;

test('a profile matches itself', () => {
  assert.deepEqual(compareProfiles(PROFILE, PROFILE), { pass: true, differences: [] });
});

test('the sentences under headings and the date it was updated are not compared', () => {
  const actual = PROFILE.replace('What this profile is called and who maintains it.', 'Who made this.').replace('2026-10-02', '2027-01-15');
  assert.deepEqual(differences(actual), []);
  assert.deepEqual(differences(PROFILE.replace('2026-10-02', 'yesterday')), ['Identity: "Last updated" is "yesterday", expected a date like 2026-10-02']);
});

test('a changed setting is named by its section and key', () => {
  assert.deepEqual(differences(PROFILE.replace('- Level: AA', '- Level: AAA')), ['Accessibility: "Level" is "AAA", expected "AA"']);
  assert.deepEqual(differences(PROFILE.replace('- Owner: Checkout design team', '- Owner: Someone')), ['Identity: "Owner" is "Someone", expected "Checkout design team"']);
});

test('a missing or extra setting fails', () => {
  assert.deepEqual(differences(PROFILE.replace('- Version: 2.2\n', '')), ['Accessibility: missing "Version: 2.2"']);
  assert.deepEqual(differences(PROFILE.replace('- Level: AA', '- Level: AA\n- Extra: yes')), ['Accessibility: unexpected "Extra: yes"']);
});

test('a layer is a section of its own, with its own settings', () => {
  assert.deepEqual(differences(PROFILE.replace('prefix `Foundation/`', 'none')), ['1. Foundation: "Match hints" is "none", expected "prefix `Foundation/`"']);
  assert.deepEqual(differences(PROFILE.replace('### 1. Foundation', '### 1. Foundation Tokens')), ['Missing heading: ### 1. Foundation', 'Unexpected heading: ### 1. Foundation Tokens']);
});

test('headings are compared in order, and a missing section or a different order fails', () => {
  assert.deepEqual(differences(PROFILE.replace(/## Accessibility[\s\S]*$/, '')), ['Missing heading: ## Accessibility']);
  const [identity, layers, accessibility] = PROFILE.split(/^(?=## )/m).slice(1);
  const swapped = PROFILE.split(/^(?=## )/m)[0] + accessibility + '\n' + identity + layers;
  assert.deepEqual(differences(swapped), ['Headings are in a different order: expected Identity, Design System Layers, 1. Foundation, Accessibility, got Accessibility, Identity, Design System Layers, 1. Foundation']);
});

test('the title and the profile version are compared', () => {
  assert.deepEqual(differences(PROFILE.replace('# Review Profile: Checkout team profile', '# Review Profile: Other')), ['Title is "Other", expected "Checkout team profile"']);
  assert.deepEqual(differences(PROFILE.replace('Profile version: 0.1', 'Profile version: 0.2')), ['Profile version is "0.2", expected "0.1"']);
});

test('each section has one sentence', () => {
  assert.deepEqual(differences(PROFILE.replace('What this profile is called and who maintains it.', 'One. \n\nTwo.')), ['Identity: has 2 sentence lines, expected 1']);
  assert.deepEqual(differences(PROFILE.replace('The accessibility standard designs are judged against.\n\n', '')), ['Accessibility: has 0 sentence lines, expected 1']);
});

test('on the command line it prints PASS or FAIL with one line per difference, and exits 0, 1 or 2', () => {
  const expected = saved('expected.md', PROFILE);
  assert.deepEqual(run([expected, saved('a.md', PROFILE)]).stdout, 'PASS expected.md\n');
  const failed = run([expected, '-'], PROFILE.replace('- Level: AA', '- Level: AAA'));
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, 'FAIL expected.md\n- Accessibility: "Level" is "AAA", expected "AA"\n');
  assert.equal(run([expected]).status, 2);
  assert.equal(run([expected, '/no/such/file.md']).status, 2);
});
