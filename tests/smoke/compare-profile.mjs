// Compares a saved Review Profile with a case's expected profile: its title, version, headings and Key: value settings.
// The sentence under each heading and the date it was last updated are not compared.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node tests/smoke/compare-profile.mjs <expected profile file> <saved profile file, or - to read it from stdin>';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function main([expectedArg, actualArg]) {
  if (!expectedArg || !actualArg) return fail(USAGE);
  let expected, actual;
  try {
    expected = readFileSync(expectedArg, 'utf8');
    actual = readFileSync(actualArg === '-' ? 0 : actualArg, 'utf8');
  } catch (error) {
    return fail(error.message);
  }
  const { pass, differences } = compareProfiles(expected, actual);
  const name = basename(expectedArg);
  process.stdout.write(pass ? `PASS ${name}\n` : `FAIL ${name}\n${differences.map((d) => `- ${d}\n`).join('')}`);
  process.exitCode = pass ? 0 : 1;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}

// A profile as a title, a version and sections in order, each with its settings and its sentence lines.
function parse(text) {
  const profile = { title: null, version: null, sections: [] };
  let section = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const title = /^# Review Profile:\s*(.*)$/.exec(line);
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const version = /^Profile version:\s*(.*)$/.exec(line);
    const setting = /^[-*]\s+([^:]+?):\s*(.*)$/.exec(line);
    if (title) profile.title = title[1].trim();
    else if (heading) profile.sections.push(section = { level: heading[1].length, name: heading[2].trim(), settings: [], sentences: 0 });
    else if (version && !section) profile.version = version[1].trim();
    else if (!section || !line || line.startsWith('<!--')) continue;
    else if (setting) section.settings.push([setting[1].trim(), setting[2].trim()]);
    else section.sentences++;
  }
  return profile;
}

export function compareProfiles(expectedText, actualText) {
  const expected = parse(expectedText), actual = parse(actualText);
  const differences = [];
  if (actual.title !== expected.title) differences.push(`Title is "${actual.title}", expected "${expected.title}"`);
  if (actual.version !== expected.version) differences.push(`Profile version is "${actual.version}", expected "${expected.version}"`);

  const label = (s) => `${'#'.repeat(s.level)} ${s.name}`;
  const expectedHeadings = expected.sections.map(label), actualHeadings = actual.sections.map(label);
  const missing = expectedHeadings.filter((h) => !actualHeadings.includes(h));
  const extra = actualHeadings.filter((h) => !expectedHeadings.includes(h));
  differences.push(...missing.map((h) => `Missing heading: ${h}`), ...extra.map((h) => `Unexpected heading: ${h}`));
  const common = (list, other) => list.filter((h) => other.includes(h));
  if (common(expectedHeadings, actualHeadings).join('\n') !== common(actualHeadings, expectedHeadings).join('\n')) {
    const names = (sections) => sections.map((s) => s.name).join(', ');
    differences.push(`Headings are in a different order: expected ${names(expected.sections)}, got ${names(actual.sections)}`);
  }

  for (const want of expected.sections) {
    const got = actual.sections.find((s) => label(s) === label(want));
    if (!got) continue;
    if (got.level === 2 && got.sentences !== 1) differences.push(`${got.name}: has ${got.sentences} sentence lines, expected 1`);
    const unused = [...got.settings];
    const take = (match) => { const i = unused.findIndex(match); return i < 0 ? null : unused.splice(i, 1)[0]; };
    const left = want.settings.filter(([key, value]) => !take(([k, v]) => k === key && (key === 'Last updated' ? DATE.test(v) : v === value)));
    for (const [key, value] of left) {
      const found = take(([k]) => k === key);
      if (!found) differences.push(`${want.name}: missing "${key}: ${value}"`);
      else differences.push(`${want.name}: "${key}" is "${found[1]}", expected ${key === 'Last updated' ? `a date like ${value}` : `"${value}"`}`);
    }
    for (const [key, value] of unused) differences.push(`${want.name}: unexpected "${key}: ${value}"`);
  }
  return { pass: differences.length === 0, differences };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
