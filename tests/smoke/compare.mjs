// Compares a report's JSON with a smoke case's expected JSON, on the fields the smoke test checks.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node tests/smoke/compare.mjs <case id or expected JSON file> <report file, or - to read it from stdin>';

function main([caseArg, reportArg]) {
  if (!caseArg || !reportArg) return fail(USAGE);
  const expectedPath = existsSync(caseArg) ? caseArg : fileURLToPath(new URL(`./expected/${caseArg}.json`, import.meta.url));
  if (!existsSync(expectedPath)) return fail(`No expected JSON for case ${caseArg} (looked for ${expectedPath})`);
  let expected, actual;
  try {
    expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    actual = readReport(readFileSync(reportArg === '-' ? 0 : reportArg, 'utf8'));
  } catch (error) {
    return fail(error.message);
  }
  const name = expected.case || caseArg;
  const { pass, differences } = compareReports(expected, actual);
  process.stdout.write(pass ? `PASS ${name}\n` : `FAIL ${name}\n${differences.map((d) => `- ${d}\n`).join('')}`);
  process.exitCode = pass ? 0 : 1;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}

export function readReport(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const blocks = [...text.matchAll(/^```json[^\n]*\n([\s\S]*?)^```/gm)];
  if (!blocks.length) throw new Error('There is no report JSON: paste the whole report, or its JSON block');
  return JSON.parse(blocks[blocks.length - 1][1]);
}

export function compareReports(expected, actual) {
  const absent = ['findings', 'coverage'].filter((list) => !Array.isArray(actual[list]));
  if (absent.length) return { pass: false, differences: absent.map((list) => `The report has no "${list}" array`) };
  const differences = [
    ...matchByKey('Finding', expected.findings, actual.findings, findings),
    ...matchByKey('Coverage', expected.coverage, actual.coverage, coverage),
  ];
  return { pass: differences.length === 0, differences };
}

const relatedOf = (finding) => [...(finding.relatedFindings || [])].sort();

const findings = {
  keyOf: (finding) => finding.id,
  describe: (finding) => `${finding.axis}, ${finding.severity}, ${finding.certainty}`,
  differ(want, got) {
    const differences = ['axis', 'severity', 'certainty']
      .filter((field) => got[field] !== want[field])
      .map((field) => `${field} is "${got[field]}", expected "${want[field]}"`);
    const [gotRelated, wantRelated] = [relatedOf(got), relatedOf(want)];
    if (gotRelated.join('\n') !== wantRelated.join('\n')) {
      differences.push(`relatedFindings are [${gotRelated.join(', ')}], expected [${wantRelated.join(', ')}]`);
    }
    return differences;
  },
};

const coverage = {
  keyOf: (entry) => (entry.ref == null ? `${entry.axis} (whole axis)` : `${entry.axis} ${entry.ref}`),
  describe: (entry) => entry.status,
  differ: (want, got) => (got.status === want.status ? [] : [`status is "${got.status}", expected "${want.status}"`]),
};

// Matches expected and actual entries by key. A key the report repeats is reported once, and not compared further.
function matchByKey(kind, expectedEntries, actualEntries, { keyOf, describe, differ }) {
  const differences = [];
  const actualByKey = new Map();
  const repeated = new Set();
  for (const entry of actualEntries) {
    const key = keyOf(entry);
    if (actualByKey.has(key) && !repeated.has(key)) {
      repeated.add(key);
      differences.push(`Duplicate ${kind} ${key}`);
    }
    actualByKey.set(key, entry);
  }
  const expectedKeys = new Set(expectedEntries.map(keyOf));
  for (const want of expectedEntries) {
    const key = keyOf(want);
    if (repeated.has(key)) continue;
    const got = actualByKey.get(key);
    if (!got) differences.push(`Missing ${kind} ${key}`);
    else differences.push(...differ(want, got).map((d) => `${kind} ${key}: ${d}`));
  }
  for (const [key, got] of actualByKey) {
    if (!expectedKeys.has(key)) differences.push(`Unexpected ${kind} ${key} (${describe(got)})`);
  }
  return differences;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
